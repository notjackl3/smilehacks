import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

interface DentistPatientRelationship {
  id?: string;
  dentist_id: string;
  patient_id: string;
  is_active: boolean;
  created_at?: string;
}

// GET - Fetch relationships (dentists see their patients, patients see their dentists)
export async function GET(request: NextRequest) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    let query = supabase.from('dentist_patient_relationships').select(`
      *,
      dentist:dentist_id(id, email),
      patient:patient_id(id, email)
    `);

    if (profile.role === 'dentist') {
      // Dentists see all their patient relationships
      query = query.eq('dentist_id', user.id);
    } else {
      // Patients see all their dentist relationships
      query = query.eq('patient_id', user.id);
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

// POST - Create new dentist-patient relationship (dentist only)
export async function POST(request: NextRequest) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a dentist
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    if (profile.role !== 'dentist') {
      return NextResponse.json({ error: 'Only dentists can create relationships' }, { status: 403 });
    }

    const body: { patient_id: string } = await request.json();

    if (!body.patient_id) {
      return NextResponse.json({ error: 'patient_id is required' }, { status: 400 });
    }

    // Verify patient exists and is actually a patient
    const { data: patientProfile, error: patientError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', body.patient_id)
      .single();

    if (patientError || !patientProfile) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    if (patientProfile.role !== 'patient') {
      return NextResponse.json({ error: 'Specified user is not a patient' }, { status: 400 });
    }

    // Check if relationship already exists
    const { data: existing } = await supabase
      .from('dentist_patient_relationships')
      .select('*')
      .eq('dentist_id', user.id)
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
        dentist_id: user.id,
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
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: { relationship_id: string; is_active: boolean } = await request.json();

    if (!body.relationship_id || body.is_active === undefined) {
      return NextResponse.json({ error: 'relationship_id and is_active are required' }, { status: 400 });
    }

    // Verify the relationship belongs to this dentist
    const { data: existing, error: fetchError } = await supabase
      .from('dentist_patient_relationships')
      .select('*')
      .eq('id', body.relationship_id)
      .eq('dentist_id', user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Relationship not found or unauthorized' }, { status: 404 });
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

// DELETE - Delete relationship (dentist only)
export async function DELETE(request: NextRequest) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const relationshipId = searchParams.get('id');

    if (!relationshipId) {
      return NextResponse.json({ error: 'Relationship ID is required' }, { status: 400 });
    }

    // Delete relationship (RLS ensures only dentist's own relationships can be deleted)
    const { error } = await supabase
      .from('dentist_patient_relationships')
      .delete()
      .eq('id', relationshipId)
      .eq('dentist_id', user.id);

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
