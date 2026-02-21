# Backend Infrastructure Guide

## Overview

This document outlines the complete backend infrastructure for the dental annotation system, including API endpoints, database schema, and usage examples.

## Database Schema

### Tables Created

1. **`annotations`** - Stores dentist annotations on patient teeth
2. **`patient_dental_records`** - Stores patient dental data (removed teeth, cavities)
3. **`dentist_patient_relationships`** - Manages dentist-patient associations

All tables have Row Level Security (RLS) enabled with appropriate policies.

---

## API Endpoints

### 1. Annotations API (`/api/annotations`)

Manages tooth-specific annotations created by dentists.

#### GET - Fetch Annotations

**Dentist:** Fetches all their annotations (optionally filtered by patient)
**Patient:** Fetches only public annotations about them

```typescript
// Dentist: Get all annotations for a specific patient
const response = await fetch('/api/annotations?patientId=<patient_id>');

// Dentist: Get annotations for a specific tooth
const response = await fetch('/api/annotations?patientId=<patient_id>&toothNumber=3');

// Patient: Get all public annotations about me
const response = await fetch('/api/annotations');

// Response
{
  success: true,
  data: [
    {
      id: "uuid",
      patient_id: "uuid",
      dentist_id: "uuid",
      tooth_number: 3,
      annotation_text: "Moderate cavity, needs filling",
      is_public: true,
      created_at: "2024-01-15T10:30:00Z",
      updated_at: "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### POST - Create Annotation (Dentist Only)

```typescript
const response = await fetch('/api/annotations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    patient_id: 'patient-uuid',
    tooth_number: 14,
    annotation_text: 'Mild cavity on buccal surface, monitor for 6 months',
    is_public: false // Patient won't see this
  })
});

// Response (201 Created)
{
  success: true,
  message: "Annotation created successfully",
  data: { /* annotation object */ }
}
```

#### PUT - Update Annotation (Dentist Only)

```typescript
const response = await fetch('/api/annotations', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'annotation-uuid',
    annotation_text: 'Updated note text',
    is_public: true // Now make it visible to patient
  })
});
```

#### DELETE - Delete Annotation (Dentist Only)

```typescript
const response = await fetch('/api/annotations?id=<annotation_id>', {
  method: 'DELETE'
});
```

---

### 2. Patient Dental Records API (`/api/patient-records`)

Manages patient dental records including removed teeth and cavities.

#### GET - Fetch Patient Record

**Dentist:** Must provide `patientId` query parameter
**Patient:** Automatically fetches their own record

```typescript
// Dentist: Get a patient's dental record
const response = await fetch('/api/patient-records?patientId=<patient_id>');

// Patient: Get my own dental record
const response = await fetch('/api/patient-records');

// Response
{
  success: true,
  data: {
    id: "uuid",
    patient_id: "patient-uuid",
    dentist_id: "dentist-uuid",
    scan_id: "CT-2024-001",
    scan_date: "2024-01-15",
    removed_teeth: [8, 9, 15],
    cavities: [
      {
        toothNumber: 3,
        severity: "moderate",
        position: "occlusal"
      },
      {
        toothNumber: 14,
        severity: "mild",
        position: "buccal"
      }
    ],
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z"
  }
}
```

#### POST - Create/Update Full Record (Dentist Only)

This replaces the entire record or creates a new one.

```typescript
const response = await fetch('/api/patient-records', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    patient_id: 'patient-uuid',
    scan_id: 'CT-2024-002',
    scan_date: '2024-02-20',
    removed_teeth: [8, 15, 25],
    cavities: [
      {
        toothNumber: 3,
        severity: 'moderate',
        position: 'occlusal'
      }
    ]
  })
});

// Response (201 Created or 200 Updated)
{
  success: true,
  message: "Patient dental record saved successfully",
  data: { /* full record */ }
}
```

#### PATCH - Partially Update Record (Dentist Only)

Use this to add/remove individual teeth or cavities without overwriting the entire array.

```typescript
// Add a removed tooth
const response = await fetch('/api/patient-records', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    patient_id: 'patient-uuid',
    action: 'add_removed_tooth',
    tooth_number: 25
  })
});

// Remove a removed tooth (restore it)
const response = await fetch('/api/patient-records', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    patient_id: 'patient-uuid',
    action: 'remove_removed_tooth',
    tooth_number: 8
  })
});

// Add a cavity
const response = await fetch('/api/patient-records', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    patient_id: 'patient-uuid',
    action: 'add_cavity',
    cavity: {
      toothNumber: 19,
      severity: 'severe',
      position: 'occlusal'
    }
  })
});

// Remove all cavities from a specific tooth
const response = await fetch('/api/patient-records', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    patient_id: 'patient-uuid',
    action: 'remove_cavity',
    tooth_number: 19
  })
});
```

---

### 3. Dentist-Patient Relationships API (`/api/relationships`)

Manages the dentist-patient associations.

#### GET - Fetch Relationships

**Dentist:** Fetches all their patients
**Patient:** Fetches all their dentists

```typescript
// Get all active relationships
const response = await fetch('/api/relationships');

// Get all relationships (including inactive)
const response = await fetch('/api/relationships?showInactive=true');

// Response
{
  success: true,
  data: [
    {
      id: "uuid",
      dentist_id: "dentist-uuid",
      patient_id: "patient-uuid",
      is_active: true,
      created_at: "2024-01-01T00:00:00Z",
      dentist: { id: "uuid", email: "dentist@example.com" },
      patient: { id: "uuid", email: "patient@example.com" }
    }
  ]
}
```

#### POST - Create Relationship (Dentist Only)

```typescript
const response = await fetch('/api/relationships', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    patient_id: 'patient-uuid'
  })
});

// Response (201 Created)
{
  success: true,
  message: "Relationship created successfully",
  data: { /* relationship object */ }
}
```

#### PATCH - Update Relationship (Toggle Active Status)

```typescript
const response = await fetch('/api/relationships', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    relationship_id: 'relationship-uuid',
    is_active: false // Deactivate the relationship
  })
});
```

#### DELETE - Delete Relationship (Dentist Only)

```typescript
const response = await fetch('/api/relationships?id=<relationship_id>', {
  method: 'DELETE'
});
```

---

## Workflow Examples

### Dentist Workflow

```typescript
// 1. Dentist logs in and enters patient ID
const patientId = 'patient-uuid-from-input';

// 2. Create/verify relationship
await fetch('/api/relationships', {
  method: 'POST',
  body: JSON.stringify({ patient_id: patientId })
});

// 3. Fetch patient's dental record
const recordRes = await fetch(`/api/patient-records?patientId=${patientId}`);
const { data: dentalRecord } = await recordRes.json();

// 4. Display 3D mouth with removed teeth and cavities
// dentalRecord.removed_teeth => [8, 9, 15]
// dentalRecord.cavities => [{ toothNumber: 3, severity: 'moderate', ... }]

// 5. Dentist adds a cavity via UI
await fetch('/api/patient-records', {
  method: 'PATCH',
  body: JSON.stringify({
    patient_id: patientId,
    action: 'add_cavity',
    cavity: { toothNumber: 22, severity: 'mild', position: 'buccal' }
  })
});

// 6. Dentist adds annotation (private note)
await fetch('/api/annotations', {
  method: 'POST',
  body: JSON.stringify({
    patient_id: patientId,
    tooth_number: 22,
    annotation_text: 'Small cavity detected, schedule follow-up in 3 months',
    is_public: false
  })
});

// 7. Dentist adds public annotation for patient to see
await fetch('/api/annotations', {
  method: 'POST',
  body: JSON.stringify({
    patient_id: patientId,
    tooth_number: 14,
    annotation_text: 'Please floss more around this area',
    is_public: true
  })
});
```

### Patient Workflow

```typescript
// 1. Patient logs in and sees their user ID
const { data: { user } } = await supabase.auth.getUser();
console.log('Your Patient ID:', user.id); // Show this to patient

// 2. Fetch their dental record
const recordRes = await fetch('/api/patient-records');
const { data: dentalRecord } = await recordRes.json();

// 3. Display 3D mouth with their data
// dentalRecord.removed_teeth => [8, 9]
// dentalRecord.cavities => [{ toothNumber: 3, severity: 'moderate', ... }]

// 4. Fetch public annotations
const annotationsRes = await fetch('/api/annotations');
const { data: annotations } = await annotationsRes.json();

// 5. Display annotations to patient
// Only public annotations (is_public: true) are returned
annotations.forEach(annotation => {
  console.log(`Tooth #${annotation.tooth_number}: ${annotation.annotation_text}`);
});
```

---

## Security Features

### Row Level Security (RLS) Policies

All tables have RLS enabled:

- **Annotations:**
  - Dentists can view/edit/delete their own annotations
  - Patients can only view public annotations about them

- **Patient Dental Records:**
  - Dentists can view/edit all patient records
  - Patients can only view their own records

- **Relationships:**
  - Dentists can create/edit/delete their patient relationships
  - Both parties can view their relationships

### Authentication

All endpoints require authentication via Supabase Auth:

```typescript
// The user must be logged in
const { data: { user } } = await supabase.auth.getUser();
// User's JWT token is automatically sent with requests
```

---

## Error Handling

All endpoints return consistent error responses:

```typescript
// 400 Bad Request
{
  error: "Missing required fields: patient_id"
}

// 401 Unauthorized
{
  error: "Unauthorized"
}

// 403 Forbidden
{
  error: "Only dentists can create annotations"
}

// 404 Not Found
{
  error: "Patient not found"
}

// 500 Internal Server Error
{
  error: "Failed to create annotation"
}
```

---

## Next Steps

1. ✅ Database schema created
2. ✅ API endpoints implemented
3. 🔄 Frontend components (in progress)
   - Dentist dashboard with patient lookup
   - Patient dashboard with ID display
   - JawViewer integration with database
   - Annotation UI for dentists

4. 📋 Testing
   - Test all API endpoints
   - Test RLS policies
   - Test dentist and patient workflows

---

## Files Created

- `/src/app/api/annotations/route.ts` - Annotations CRUD API
- `/src/app/api/patient-records/route.ts` - Patient dental records API
- `/src/app/api/relationships/route.ts` - Dentist-patient relationships API
- `/docs/BACKEND_INFRASTRUCTURE.md` - This guide

## Database Migration SQL

The complete SQL schema can be found in the previous message and should be run in Supabase SQL Editor.
