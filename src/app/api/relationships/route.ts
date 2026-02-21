import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

interface DentistPatientRelationship {
  id?: string;
  dentist_id: string;
  patient_id: string;
  is_active: boolean;
  created_at?: string;
}

// GET - Fetch relationships
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    const searchParams = request.nextUrl.searchParams;
    const dentistId = searchParams.get('dentistId');
    const patientId = searchParams.get('patientId');

    let query = supabase.from('dentist_patient_relationships').select(`
      *,
      dentist:dentist_id(id, email),
      patient:patient_id(id, email)
    `);

    // Optionally filter by dentist or patient
    if (dentistId) {
      query = query.eq('dentist_id', dentistId);
    }
    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    // Only show active relationships by default
    const showInactive = request.nextUrl.searchParams.get('showInactive') === 'true';
    if (!showInactive) {
      query = query.eq('is_active', true);
    }

    const { data: relationships, error } = await query;

    if (error) {
      console.error('Error fetching relationships:', error);
      return NextResponse.json({ error: 'Failed to fetch relationships' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: relationships,
    });

  } catch (error) {
    console.error('Error in GET /api/relationships:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new dentist-patient relationship
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    const body: { dentist_id: string; patient_id: string } = await request.json();

    if (!body.dentist_id || !body.patient_id) {
      return NextResponse.json({ error: 'dentist_id and patient_id are required' }, { status: 400 });
    }

    // Check if relationship already exists
    const { data: existing } = await supabase
      .from('dentist_patient_relationships')
      .select('*')
      .eq('dentist_id', body.dentist_id)
      .eq('patient_id', body.patient_id)
      .single();

    if (existing) {
      // If exists but inactive, reactivate it
      if (!existing.is_active) {
        const { data: reactivated, error: reactivateError } = await supabase
          .from('dentist_patient_relationships')
          .update({ is_active: true })
          .eq('id', existing.id)
          .select()
          .single();

        if (reactivateError) {
          console.error('Error reactivating relationship:', reactivateError);
          return NextResponse.json({ error: 'Failed to reactivate relationship' }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: 'Relationship reactivated successfully',
          data: reactivated,
        });
      }

      return NextResponse.json({ error: 'Relationship already exists' }, { status: 409 });
    }

    // Create new relationship
    const { data: relationship, error } = await supabase
      .from('dentist_patient_relationships')
      .insert({
        dentist_id: body.dentist_id,
        patient_id: body.patient_id,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating relationship:', error);
      return NextResponse.json({ error: 'Failed to create relationship' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Relationship created successfully',
      data: relationship,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/relationships:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update relationship (toggle active status)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    const body: { relationship_id: string; is_active: boolean } = await request.json();

    if (!body.relationship_id || body.is_active === undefined) {
      return NextResponse.json({ error: 'relationship_id and is_active are required' }, { status: 400 });
    }

    // Update relationship
    const { data: updated, error: updateError } = await supabase
      .from('dentist_patient_relationships')
      .update({ is_active: body.is_active })
      .eq('id', body.relationship_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating relationship:', updateError);
      return NextResponse.json({ error: 'Failed to update relationship' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Relationship updated successfully',
      data: updated,
    });

  } catch (error) {
    console.error('Error in PATCH /api/relationships:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete relationship
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    const searchParams = request.nextUrl.searchParams;
    const relationshipId = searchParams.get('id');

    if (!relationshipId) {
      return NextResponse.json({ error: 'Relationship ID is required' }, { status: 400 });
    }

    // Delete relationship
    const { error } = await supabase
      .from('dentist_patient_relationships')
      .delete()
      .eq('id', relationshipId);

    if (error) {
      console.error('Error deleting relationship:', error);
      return NextResponse.json({ error: 'Failed to delete relationship' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Relationship deleted successfully',
    });

  } catch (error) {
    console.error('Error in DELETE /api/relationships:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
