/**
 * API utility functions for interacting with the backend
 */

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getAuthHeaders(): Promise<HeadersInit> {
  const { supabase } = await import('./supabaseClient');
  const { data: { session } } = await supabase.auth.getSession();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  return headers;
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface CavityData {
  toothNumber: number;
  severity: 'mild' | 'moderate' | 'severe';
  position: 'occlusal' | 'buccal' | 'lingual' | 'mesial' | 'distal';
}

export interface Annotation {
  id: string;
  patient_id: string;
  dentist_id: string;
  tooth_number: number;
  annotation_text: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientDentalRecord {
  id: string;
  patient_id: string;
  dentist_id?: string;
  scan_id?: string;
  scan_date: string;
  removed_teeth: number[];
  cavities: CavityData[];
  created_at: string;
  updated_at: string;
}

export interface DentistPatientRelationship {
  id: string;
  dentist_id: string;
  patient_id: string;
  is_active: boolean;
  created_at: string;
}

// ============================================
// ANNOTATIONS API
// ============================================

export async function getAnnotations(patientId?: string, toothNumber?: number): Promise<Annotation[]> {
  const params = new URLSearchParams();
  if (patientId) params.append('patientId', patientId);
  if (toothNumber) params.append('toothNumber', toothNumber.toString());

  const headers = await getAuthHeaders();
  const response = await fetch(`/api/annotations?${params.toString()}`, { headers });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch annotations');
  }

  const data = await response.json();
  return data.data;
}

export async function createAnnotation(
  patientId: string,
  toothNumber: number,
  annotationText: string,
  isPublic: boolean = false
): Promise<Annotation> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/annotations', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      patient_id: patientId,
      tooth_number: toothNumber,
      annotation_text: annotationText,
      is_public: isPublic,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create annotation');
  }

  const data = await response.json();
  return data.data;
}

export async function updateAnnotation(
  annotationId: string,
  updates: { annotation_text?: string; is_public?: boolean }
): Promise<Annotation> {
  const response = await fetch('/api/annotations', {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      id: annotationId,
      ...updates,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update annotation');
  }

  const data = await response.json();
  return data.data;
}

export async function deleteAnnotation(annotationId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/annotations?id=${annotationId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete annotation');
  }
}

// ============================================
// PATIENT DENTAL RECORDS API
// ============================================

export async function getPatientRecord(patientId?: string): Promise<PatientDentalRecord> {
  const params = new URLSearchParams();
  if (patientId) params.append('patientId', patientId);

  const headers = await getAuthHeaders();
  const response = await fetch(`/api/patient-records?${params.toString()}`, { headers });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch patient record');
  }

  const data = await response.json();
  return data.data;
}

export async function savePatientRecord(
  patientId: string,
  record: {
    scan_id?: string;
    scan_date?: string;
    removed_teeth?: number[];
    cavities?: CavityData[];
  }
): Promise<PatientDentalRecord> {
  const response = await fetch('/api/patient-records', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      patient_id: patientId,
      ...record,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save patient record');
  }

  const data = await response.json();
  return data.data;
}

export async function addRemovedTooth(patientId: string, toothNumber: number): Promise<PatientDentalRecord> {
  const response = await fetch('/api/patient-records', {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      patient_id: patientId,
      action: 'add_removed_tooth',
      tooth_number: toothNumber,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add removed tooth');
  }

  const data = await response.json();
  return data.data;
}

export async function removeRemovedTooth(patientId: string, toothNumber: number): Promise<PatientDentalRecord> {
  const response = await fetch('/api/patient-records', {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      patient_id: patientId,
      action: 'remove_removed_tooth',
      tooth_number: toothNumber,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove tooth from removed list');
  }

  const data = await response.json();
  return data.data;
}

export async function addCavity(patientId: string, cavity: CavityData): Promise<PatientDentalRecord> {
  const response = await fetch('/api/patient-records', {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      patient_id: patientId,
      action: 'add_cavity',
      cavity,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add cavity');
  }

  const data = await response.json();
  return data.data;
}

export async function removeCavity(patientId: string, toothNumber: number): Promise<PatientDentalRecord> {
  const response = await fetch('/api/patient-records', {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      patient_id: patientId,
      action: 'remove_cavity',
      tooth_number: toothNumber,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove cavity');
  }

  const data = await response.json();
  return data.data;
}

// ============================================
// DENTIST-PATIENT RELATIONSHIPS API
// ============================================

export async function getRelationships(showInactive: boolean = false): Promise<DentistPatientRelationship[]> {
  const params = new URLSearchParams();
  if (showInactive) params.append('showInactive', 'true');

  const headers = await getAuthHeaders();
  const response = await fetch(`/api/relationships?${params.toString()}`, { headers });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch relationships');
  }

  const data = await response.json();
  return data.data;
}

export async function createRelationship(patientId: string): Promise<DentistPatientRelationship> {
  const response = await fetch('/api/relationships', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ patient_id: patientId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create relationship');
  }

  const data = await response.json();
  return data.data;
}

export async function updateRelationship(
  relationshipId: string,
  isActive: boolean
): Promise<DentistPatientRelationship> {
  const response = await fetch('/api/relationships', {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      relationship_id: relationshipId,
      is_active: isActive,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update relationship');
  }

  const data = await response.json();
  return data.data;
}

export async function deleteRelationship(relationshipId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/relationships?id=${relationshipId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete relationship');
  }
}
