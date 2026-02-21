# CT Scan Integration Guide

## Overview

This guide explains how to integrate CT scan data processing with the 3D dental model viewer.

## What I've Created

### 1. Mock CT Scan Data File
- **Location**: `/public/data/mock-ct-scan.json`
- **Purpose**: Hardcoded test data for development
- **Contains**:
  - 3 removed teeth (tooth #8, #9, #15)
  - 4 cavities on different teeth with varying severities

### 2. Updated 3D Model Viewer
- **File**: `/src/components/dental3d/JawViewer.tsx`
- **New Features**:
  - Automatically loads CT scan data on mount
  - Removes teeth based on the `removed` array
  - Generates and positions cavities based on the `cavity` array
  - Displays CT scan info in the top-left panel

### 3. API Endpoint for CT Scan Data
- **Endpoint**: `/api/ct-scan`
- **Methods**:
  - `POST`: Receive new CT scan data from backend
  - `GET`: Retrieve CT scan data by scanId

### 4. Documentation
- **CT Scan Format**: `/docs/CT_SCAN_FORMAT.md`
- **Integration Guide**: This file

## How It Works Now

1. Component loads at `/` (or wherever JawViewer is mounted)
2. Automatically fetches `/data/mock-ct-scan.json`
3. Applies removed teeth and cavities to the 3D model
4. Displays CT scan info in the UI

## Future Integration Steps

### Step 1: Process CT Scan Image
Your teammate will process the 2D CT scan image and extract:
- Which teeth are missing
- Which teeth have cavities
- Cavity severity (optional)

### Step 2: Send Data to Backend
```typescript
// Example: Send CT scan data to your API
const ctScanData = {
  scanId: "CT-2024-001",
  patientId: "P-12345",
  scanDate: "2024-01-15",
  removed: [8, 9, 15],  // Missing teeth
  cavity: [
    {
      toothNumber: 3,
      severity: "moderate",
      position: "occlusal"
    }
    // ... more cavities
  ]
};

const response = await fetch('/api/ct-scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(ctScanData)
});
```

### Step 3: Load Data in Frontend
You can either:
- **Option A**: Continue loading from `/data/mock-ct-scan.json` (replace file with real data)
- **Option B**: Fetch from API endpoint

To switch to API endpoint, update JawViewer.tsx:

```typescript
// Change this line in the useEffect:
const response = await fetch('/data/mock-ct-scan.json');

// To this:
const response = await fetch(`/api/ct-scan?scanId=${patientScanId}`);
const result = await response.json();
const data = result.data;
```

## Testing the Current Implementation

1. Start the development server:
```bash
npm run dev
```

2. Navigate to the page with the 3D viewer

3. You should see:
   - Top-left panel showing "CT Scan Loaded" with scan details
   - 3 missing teeth (upper front teeth)
   - 4 black cavities on different teeth
   - Cavities of different sizes based on severity

## Customizing the Mock Data

Edit `/public/data/mock-ct-scan.json`:

```json
{
  "scanId": "CT-2024-002",
  "patientId": "P-67890",
  "scanDate": "2024-02-20",
  "removed": [2, 14, 30],  // Change which teeth are missing
  "cavity": [
    {
      "toothNumber": 5,
      "severity": "severe",  // mild, moderate, or severe
      "position": "occlusal"  // occlusal, buccal, lingual, mesial, distal
    }
  ]
}
```

## API Endpoints

### POST /api/ct-scan
Submit new CT scan data

**Request Body**:
```json
{
  "scanId": "string",
  "patientId": "string",
  "scanDate": "YYYY-MM-DD",
  "removed": [tooth_numbers],
  "cavity": [cavity_objects]
}
```

**Response**:
```json
{
  "success": true,
  "message": "CT scan data received successfully",
  "data": { ... }
}
```

### GET /api/ct-scan?scanId=CT-2024-001
Retrieve CT scan data by ID

**Response**:
```json
{
  "success": true,
  "data": { ... }
}
```

## Next Steps

1. **Test Current Implementation**: Make sure the mock data loads correctly
2. **Image Processing**: Have your teammate process CT scan images
3. **Backend Integration**: Connect the image processing output to the API endpoint
4. **Database Storage**: Store CT scan data in a database
5. **Dynamic Loading**: Load different patient scans dynamically
6. **Upload Feature**: Add UI to upload new CT scan images

## Tooth Numbering Reference

```
        Upper Right  |  Upper Left
        -----------  |  -----------
Back    2  3  4  5   |  12 13 14 15
Front   6  7  8      |  9  10 11

Front   27 26 25     |  24 23 22
Back    28 29 30 31  |  21 20 19 18
        -----------  |  -----------
        Lower Right  |  Lower Left
```

## Questions?

If you need help with:
- Changing cavity appearance
- Adjusting tooth removal logic
- Adding new features to the viewer
- Integrating with your backend

Just let me know!
