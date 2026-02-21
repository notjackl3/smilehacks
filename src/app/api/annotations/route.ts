import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

interface Annotation {
  id?: string;
  patient_id: string;
  dentist_id: string;
  created_by: string;
  tooth_number: number;
  annotation_text: string;
  is_public: boolean;
  created_at?: string;
  updated_at?: string;
}

// GET - Fetch annotations
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    const searchParams = request.nextUrl.searchParams;
    const patientId = searchParams.get('patientId');
    const toothNumber = searchParams.get('toothNumber');

    // Join with users table to get creator's name
    let query = supabase
      .from('annotations')
      .select(`
        *,
        creator:created_by (
          username
        )
      `);

    // Optionally filter by patient
    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    // Optionally filter by tooth number
    if (toothNumber) {
      query = query.eq('tooth_number', parseInt(toothNumber));
    }

    // Order by creation date (newest first)
    query = query.order('created_at', { ascending: false });

    const { data: annotations, error } = await query;

    if (error) {
      console.error('Error fetching annotations:', error);
      return NextResponse.json({ error: 'Failed to fetch annotations' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: annotations,
    });

  } catch (error) {
    console.error('Error in GET /api/annotations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new annotation
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    const body: Omit<Annotation, 'id' | 'created_at' | 'updated_at'> = await request.json();

    // Validate required fields (tooth_number can be 0 for general notes)
    if (!body.patient_id || !body.dentist_id || !body.created_by || body.tooth_number === undefined || body.tooth_number === null || !body.annotation_text) {
      return NextResponse.json(
        { error: 'Missing required fields: patient_id, dentist_id, created_by, tooth_number, annotation_text' },
        { status: 400 }
      );
    }

    // Validate tooth number (0 = general note, not tied to specific tooth)
    const validToothNumbers = [0, 2,3,4,5,6,7,8,9,10,11,12,13,14,15,18,19,20,21,22,23,24,25,26,27,28,29,30,31];
    if (!validToothNumbers.includes(body.tooth_number)) {
      return NextResponse.json(
        { error: `Invalid tooth number: ${body.tooth_number}. Must be one of: ${validToothNumbers.join(', ')} (0 = general note)` },
        { status: 400 }
      );
    }

    // Create annotation
    console.log('Creating annotation with data:', {
      patient_id: body.patient_id,
      dentist_id: body.dentist_id,
      created_by: body.created_by,
      tooth_number: body.tooth_number,
      annotation_text: body.annotation_text,
      is_public: body.is_public ?? false,
    });

    const { data: annotation, error } = await supabase
      .from('annotations')
      .insert({
        patient_id: body.patient_id,
        dentist_id: body.dentist_id,
        created_by: body.created_by,
        tooth_number: body.tooth_number,
        annotation_text: body.annotation_text,
        is_public: body.is_public ?? false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating annotation:', error);
      return NextResponse.json({
        error: 'Failed to create annotation',
        details: error.message,
        code: error.code
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Annotation created successfully',
      data: annotation,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/annotations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update annotation
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    const body: { id: string; annotation_text?: string; is_public?: boolean } = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Annotation ID is required' }, { status: 400 });
    }

    // Build update object
    const updates: any = {};
    if (body.annotation_text !== undefined) updates.annotation_text = body.annotation_text;
    if (body.is_public !== undefined) updates.is_public = body.is_public;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Update annotation
    const { data: updatedAnnotation, error: updateError } = await supabase
      .from('annotations')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating annotation:', updateError);
      return NextResponse.json({ error: 'Failed to update annotation' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Annotation updated successfully',
      data: updatedAnnotation,
    });

  } catch (error) {
    console.error('Error in PUT /api/annotations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete annotation
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    const searchParams = request.nextUrl.searchParams;
    const annotationId = searchParams.get('id');

    if (!annotationId) {
      return NextResponse.json({ error: 'Annotation ID is required' }, { status: 400 });
    }

    // Delete annotation
    const { error } = await supabase
      .from('annotations')
      .delete()
      .eq('id', annotationId);

    if (error) {
      console.error('Error deleting annotation:', error);
      return NextResponse.json({ error: 'Failed to delete annotation' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Annotation deleted successfully',
    });

  } catch (error) {
    console.error('Error in DELETE /api/annotations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
