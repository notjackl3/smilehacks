import { NextRequest, NextResponse } from 'next/server';

// This is a placeholder API endpoint for receiving CT scan data
// In the future, this will receive the processed CT scan data from your image processing pipeline

interface CTScanData {
  scanId: string;
  patientId: string;
  scanDate: string;
  removed: number[];
  cavity: {
    toothNumber: number;
    severity: 'mild' | 'moderate' | 'severe';
    position: 'occlusal' | 'buccal' | 'lingual' | 'mesial' | 'distal';
  }[];
}

export async function POST(request: NextRequest) {
  try {
    const data: CTScanData = await request.json();

    // Validate the data structure
    if (!data.scanId || !data.patientId || !data.scanDate) {
      return NextResponse.json(
        { error: 'Missing required fields: scanId, patientId, or scanDate' },
        { status: 400 }
      );
    }

    if (!Array.isArray(data.removed) || !Array.isArray(data.cavity)) {
      return NextResponse.json(
        { error: 'removed and cavity must be arrays' },
        { status: 400 }
      );
    }

    // Validate tooth numbers are in valid range (2-31, excluding wisdom teeth)
    const validToothNumbers = [...data.removed, ...data.cavity.map(c => c.toothNumber)];
    const invalidToothNumbers = validToothNumbers.filter(num => num < 2 || num > 31);

    if (invalidToothNumbers.length > 0) {
      return NextResponse.json(
        { error: `Invalid tooth numbers: ${invalidToothNumbers.join(', ')}. Must be between 2-31.` },
        { status: 400 }
      );
    }

    // TODO: Store the CT scan data in a database
    // For now, we'll just return the processed data

    console.log('Received CT scan data:', data);

    return NextResponse.json({
      success: true,
      message: 'CT scan data received successfully',
      data: data,
    });

  } catch (error) {
    console.error('Error processing CT scan data:', error);
    return NextResponse.json(
      { error: 'Failed to process CT scan data' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // This endpoint returns the mock CT scan data for testing
  // In production, this would fetch from a database based on patient ID or scan ID

  const scanId = request.nextUrl.searchParams.get('scanId');

  if (!scanId) {
    return NextResponse.json(
      { error: 'scanId parameter is required' },
      { status: 400 }
    );
  }

  // For now, return the mock data
  // TODO: Fetch from database based on scanId
  try {
    const mockData: CTScanData = {
      scanId: scanId,
      patientId: 'P-12345',
      scanDate: new Date().toISOString().split('T')[0],
      removed: [8, 9, 15],
      cavity: [
        {
          toothNumber: 3,
          severity: 'moderate',
          position: 'occlusal',
        },
        {
          toothNumber: 14,
          severity: 'mild',
          position: 'buccal',
        },
        {
          toothNumber: 19,
          severity: 'severe',
          position: 'occlusal',
        },
        {
          toothNumber: 25,
          severity: 'mild',
          position: 'lingual',
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: mockData,
    });

  } catch (error) {
    console.error('Error fetching CT scan data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CT scan data' },
      { status: 500 }
    );
  }
}
