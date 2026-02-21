import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

interface CavityData {
  toothNumber: number;
  severity: 'mild' | 'moderate' | 'severe';
  position: 'occlusal' | 'buccal' | 'lingual' | 'mesial' | 'distal';
}

interface PatientDentalRecord {
  id?: string;
  patient_id: string;
  dentist_id?: string;
  scan_id?: string;
  scan_date?: string;
  removed_teeth: number[];
  cavities: CavityData[];
  created_at?: string;
  updated_at?: string;
}

// GET - Fetch patient dental record
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    const searchParams = request.nextUrl.searchParams;
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json({ error: 'patientId parameter is required' }, { status: 400 });
    }

    // Fetch patient dental record
    const { data: record, error } = await supabase
      .from('patient_dental_records')
      .select('*')
      .eq('patient_id', patientId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No record found - return empty record
        return NextResponse.json({
          success: true,
          data: {
            patient_id: patientId,
            removed_teeth: [],
            cavities: [],
          },
        });
      }
      console.error('Error fetching patient dental record:', error);
      return NextResponse.json({ error: 'Failed to fetch patient dental record' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: record,
    });

  } catch (error) {
    console.error('Error in GET /api/patient-records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create or update patient dental record
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    const body: Partial<PatientDentalRecord> = await request.json();

    // Validate required fields
    if (!body.patient_id) {
      return NextResponse.json({ error: 'patient_id is required' }, { status: 400 });
    }

    // Validate removed_teeth if provided
    if (body.removed_teeth) {
      const validToothNumbers = [2,3,4,5,6,7,8,9,10,11,12,13,14,15,18,19,20,21,22,23,24,25,26,27,28,29,30,31];
      const invalidTeeth = body.removed_teeth.filter(t => !validToothNumbers.includes(t));
      if (invalidTeeth.length > 0) {
        return NextResponse.json(
          { error: `Invalid tooth numbers in removed_teeth: ${invalidTeeth.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate cavities if provided
    if (body.cavities) {
      for (const cavity of body.cavities) {
        const validToothNumbers = [2,3,4,5,6,7,8,9,10,11,12,13,14,15,18,19,20,21,22,23,24,25,26,27,28,29,30,31];
        if (!validToothNumbers.includes(cavity.toothNumber)) {
          return NextResponse.json(
            { error: `Invalid tooth number in cavity: ${cavity.toothNumber}` },
            { status: 400 }
          );
        }
      }
    }

    // Check if record already exists
    const { data: existing } = await supabase
      .from('patient_dental_records')
      .select('id')
      .eq('patient_id', body.patient_id)
      .single();

    let result;

    if (existing) {
      // Update existing record
      const updates: Partial<PatientDentalRecord> = {};
      if (body.dentist_id) updates.dentist_id = body.dentist_id;
      if (body.scan_id) updates.scan_id = body.scan_id;
      if (body.scan_date) updates.scan_date = body.scan_date;
      if (body.removed_teeth !== undefined) updates.removed_teeth = body.removed_teeth;
      if (body.cavities !== undefined) updates.cavities = body.cavities;

      const { data, error } = await supabase
        .from('patient_dental_records')
        .update(updates)
        .eq('patient_id', body.patient_id)
        .select()
        .single();

      if (error) {
        console.error('Error updating patient dental record:', error);
        return NextResponse.json({ error: 'Failed to update patient dental record' }, { status: 500 });
      }

      result = data;
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('patient_dental_records')
        .insert({
          patient_id: body.patient_id,
          dentist_id: body.dentist_id,
          scan_id: body.scan_id,
          scan_date: body.scan_date || new Date().toISOString().split('T')[0],
          removed_teeth: body.removed_teeth || [],
          cavities: body.cavities || [],
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating patient dental record:', error);
        return NextResponse.json({ error: 'Failed to create patient dental record' }, { status: 500 });
      }

      result = data;
    }

    return NextResponse.json({
      success: true,
      message: 'Patient dental record saved successfully',
      data: result,
    }, { status: existing ? 200 : 201 });

  } catch (error) {
    console.error('Error in POST /api/patient-records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Partially update patient dental record
// Useful for adding/removing individual teeth or cavities without overwriting entire arrays
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    const body: {
      patient_id: string;
      action: 'add_removed_tooth' | 'remove_removed_tooth' | 'add_cavity' | 'remove_cavity';
      tooth_number?: number;
      cavity?: CavityData;
    } = await request.json();

    if (!body.patient_id || !body.action) {
      return NextResponse.json({ error: 'patient_id and action are required' }, { status: 400 });
    }

    // Fetch current record
    const { data: currentRecord, error: fetchError } = await supabase
      .from('patient_dental_records')
      .select('*')
      .eq('patient_id', body.patient_id)
      .single();

    if (fetchError || !currentRecord) {
      return NextResponse.json({ error: 'Patient dental record not found' }, { status: 404 });
    }

    const updates: Partial<PatientDentalRecord> = {};

    switch (body.action) {
      case 'add_removed_tooth':
        if (!body.tooth_number) {
          return NextResponse.json({ error: 'tooth_number is required' }, { status: 400 });
        }
        const newRemovedTeeth = [...(currentRecord.removed_teeth || [])];
        if (!newRemovedTeeth.includes(body.tooth_number)) {
          newRemovedTeeth.push(body.tooth_number);
        }
        updates.removed_teeth = newRemovedTeeth;
        break;

      case 'remove_removed_tooth':
        if (!body.tooth_number) {
          return NextResponse.json({ error: 'tooth_number is required' }, { status: 400 });
        }
        updates.removed_teeth = (currentRecord.removed_teeth || []).filter(t => t !== body.tooth_number);
        break;

      case 'add_cavity':
        if (!body.cavity) {
          return NextResponse.json({ error: 'cavity is required' }, { status: 400 });
        }
        const newCavities = [...(currentRecord.cavities || [])];
        newCavities.push(body.cavity);
        updates.cavities = newCavities;
        break;

      case 'remove_cavity':
        if (!body.tooth_number) {
          return NextResponse.json({ error: 'tooth_number is required' }, { status: 400 });
        }
        updates.cavities = (currentRecord.cavities || []).filter(c => c.toothNumber !== body.tooth_number);
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Update record
    const { data: updatedRecord, error: updateError } = await supabase
      .from('patient_dental_records')
      .update(updates)
      .eq('patient_id', body.patient_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating patient dental record:', updateError);
      return NextResponse.json({ error: 'Failed to update patient dental record' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Patient dental record updated successfully',
      data: updatedRecord,
    });

  } catch (error) {
    console.error('Error in PATCH /api/patient-records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
