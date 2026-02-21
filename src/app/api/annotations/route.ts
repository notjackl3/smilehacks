import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

interface Annotation {
  id?: string;
  patient_id: string;
  dentist_id: string;
  tooth_number: number;
  annotation_text: string;
  is_public: boolean;
  created_at?: string;
  updated_at?: string;
}

// GET - Fetch annotations (dentist sees all their annotations, patient sees only public ones)
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const patientId = searchParams.get('patientId');
    const toothNumber = searchParams.get('toothNumber');

    // Get user's role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    let query = supabase.from('annotations').select('*');

    // Filter based on user role
    if (profile.role === 'dentist') {
      // Dentists see all their annotations
      query = query.eq('dentist_id', user.id);

      // Optionally filter by patient
      if (patientId) {
        query = query.eq('patient_id', patientId);
      }
    } else {
      // Patients only see public annotations about them
      query = query
        .eq('patient_id', user.id)
        .eq('is_public', true);
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

// POST - Create new annotation (dentist only)
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
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
      return NextResponse.json({ error: 'Only dentists can create annotations' }, { status: 403 });
    }

    const body: Omit<Annotation, 'id' | 'created_at' | 'updated_at'> = await request.json();

    // Validate required fields
    if (!body.patient_id || !body.tooth_number || !body.annotation_text) {
      return NextResponse.json(
        { error: 'Missing required fields: patient_id, tooth_number, annotation_text' },
        { status: 400 }
      );
    }

    // Validate tooth number
    const validToothNumbers = [2,3,4,5,6,7,8,9,10,11,12,13,14,15,18,19,20,21,22,23,24,25,26,27,28,29,30,31];
    if (!validToothNumbers.includes(body.tooth_number)) {
      return NextResponse.json(
        { error: `Invalid tooth number: ${body.tooth_number}. Must be one of: ${validToothNumbers.join(', ')}` },
        { status: 400 }
      );
    }

    // Create annotation
    const { data: annotation, error } = await supabase
      .from('annotations')
      .insert({
        patient_id: body.patient_id,
        dentist_id: user.id,
        tooth_number: body.tooth_number,
        annotation_text: body.annotation_text,
        is_public: body.is_public ?? false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating annotation:', error);
      return NextResponse.json({ error: 'Failed to create annotation' }, { status: 500 });
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

// PUT - Update annotation (dentist only, can only update their own)
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: { id: string; annotation_text?: string; is_public?: boolean } = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Annotation ID is required' }, { status: 400 });
    }

    // Verify the annotation belongs to this dentist
    const { data: existingAnnotation, error: fetchError } = await supabase
      .from('annotations')
      .select('*')
      .eq('id', body.id)
      .eq('dentist_id', user.id)
      .single();

    if (fetchError || !existingAnnotation) {
      return NextResponse.json({ error: 'Annotation not found or unauthorized' }, { status: 404 });
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

// DELETE - Delete annotation (dentist only, can only delete their own)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const annotationId = searchParams.get('id');

    if (!annotationId) {
      return NextResponse.json({ error: 'Annotation ID is required' }, { status: 400 });
    }

    // Delete annotation (RLS policy ensures only dentist's own annotations can be deleted)
    const { error } = await supabase
      .from('annotations')
      .delete()
      .eq('id', annotationId)
      .eq('dentist_id', user.id);

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
