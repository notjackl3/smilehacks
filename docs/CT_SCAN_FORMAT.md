# CT Scan Data Format

## Overview

The 3D dental model viewer can load and display CT scan data to visualize missing teeth and cavities. The data is provided in JSON format and automatically applied to the 3D model when loaded.

## JSON Format

```json
{
  "scanId": "string",
  "patientId": "string",
  "scanDate": "string (YYYY-MM-DD)",
  "removed": [tooth_numbers],
  "cavity": [cavity_objects]
}
```

### Tooth Numbering System

The system uses the Universal Numbering System for permanent teeth:

- **Upper Right**: 2-8 (back to front)
- **Upper Left**: 9-15 (front to back)
- **Lower Left**: 18-24 (back to front)
- **Lower Right**: 25-31 (front to back)

### Cavity Object Format

```json
{
  "toothNumber": number,
  "severity": "mild" | "moderate" | "severe",
  "position": "occlusal" | "buccal" | "lingual" | "mesial" | "distal"
}
```

**Severity Levels:**
- `mild`: Small cavity (size: 0.025-0.035)
- `moderate`: Medium cavity (size: 0.035-0.05)
- `severe`: Large cavity (size: 0.05-0.07)

**Position Types:**
- `occlusal`: Top chewing surface
- `buccal`: Outer surface (cheek side)
- `lingual`: Inner surface (tongue side)
- `mesial`: Front surface (towards the midline)
- `distal`: Back surface (away from the midline)

## Example CT Scan Data

```json
{
  "scanId": "CT-2024-001",
  "patientId": "P-12345",
  "scanDate": "2024-01-15",
  "removed": [8, 9, 15],
  "cavity": [
    {
      "toothNumber": 3,
      "severity": "moderate",
      "position": "occlusal"
    },
    {
      "toothNumber": 14,
      "severity": "mild",
      "position": "buccal"
    },
    {
      "toothNumber": 19,
      "severity": "severe",
      "position": "occlusal"
    },
    {
      "toothNumber": 25,
      "severity": "mild",
      "position": "lingual"
    }
  ]
}
```

This example shows:
- 3 missing teeth (upper right central incisor, upper left central incisor, upper left second molar)
- 4 cavities of varying severity on different teeth

## How It Works

1. The CT scan JSON file is placed in `/public/data/mock-ct-scan.json`
2. On component mount, the viewer automatically loads this data
3. Missing teeth are removed from the 3D model
4. Cavities are generated and positioned on the affected teeth based on:
   - Tooth geometry and bounding box
   - Specified position (occlusal, buccal, etc.)
   - Severity level (determines size and appearance)

## Future Enhancements

- Upload custom CT scan JSON files
- Real-time CT scan processing from image data
- Export cavity measurements and reports
- Integration with dental imaging systems
- Support for additional dental conditions (fractures, wear, etc.)
