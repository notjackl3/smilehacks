import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

// Tooth naming map for parsing filenames
// Maps tooth descriptions to their tooth numbers
const TOOTH_NAME_MAP: Record<string, number> = {
  // Upper Right (2-8)
  'second-molar-upper-right': 2,
  'first-molar-upper-right': 3,
  'second-premolar-upper-right': 4,
  'first-premolar-upper-right': 5,
  'canine-upper-right': 6,
  'lateral-incisor-upper-right': 7,
  'central-incisor-upper-right': 8,

  // Upper Left (9-15)
  'central-incisor-upper-left': 9,
  'lateral-incisor-upper-left': 10,
  'canine-upper-left': 11,
  'first-premolar-upper-left': 12,
  'second-premolar-upper-left': 13,
  'first-molar-upper-left': 14,
  'second-molar-upper-left': 15,

  // Lower Left (18-24) - skipping wisdom teeth
  'second-molar-lower-left': 18,
  'first-molar-lower-left': 19,
  'second-premolar-lower-left': 20,
  'first-premolar-lower-left': 21,
  'canine-lower-left': 22,
  'lateral-incisor-lower-left': 23,
  'central-incisor-lower-left': 24,

  // Lower Right (25-31)
  'central-incisor-lower-right': 25,
  'lateral-incisor-lower-right': 26,
  'canine-lower-right': 27,
  'first-premolar-lower-right': 28,
  'second-premolar-lower-right': 29,
  'first-molar-lower-right': 30,
  'second-molar-lower-right': 31,
}

/**
 * Parse filename to determine which teeth should be removed
 * Examples:
 *  - "missing-second-molar-lower-right.png" → [31]
 *  - "good-teeth.jpeg" → []
 *  - "bad-teeth.png" → [3, 9, 10, 11, 19, 30] (hardcoded)
 *  - "missing-central-incisor-upper-left.png" → [9]
 */
function parseFilenameForMissingTeeth(filename: string): number[] {
  const lowerFilename = filename.toLowerCase()

  // Check for "good teeth" or similar - no missing teeth
  if (lowerFilename.includes('good') || lowerFilename.includes('healthy') || lowerFilename.includes('complete')) {
    return []
  }

  // Hardcoded case for "bad-teeth" - removes specific 6 teeth
  if (lowerFilename.includes('bad-teeth') || lowerFilename.includes('bad_teeth')) {
    // First Molar Upper Right (#3), First Molar Lower Right (#30), First Molar Lower Left (#19)
    // Central Incisor Upper Left (#9), Lateral Incisor Upper Left (#10), Canine Upper Left (#11)
    return [3, 9, 10, 11, 19, 30]
  }

  // Check for "missing" keyword
  if (!lowerFilename.includes('missing')) {
    console.warn(`Filename "${filename}" doesn't contain "missing", "good", or "bad-teeth" - assuming no missing teeth`)
    return []
  }

  const removedTeeth: number[] = []

  // Try to match each tooth pattern in the filename
  for (const [toothName, toothNumber] of Object.entries(TOOTH_NAME_MAP)) {
    if (lowerFilename.includes(toothName)) {
      removedTeeth.push(toothNumber)
    }
  }

  if (removedTeeth.length === 0) {
    console.warn(`Filename "${filename}" contains "missing" but no recognizable tooth names found`)
  }

  return removedTeeth.sort((a, b) => a - b)
}

export async function POST(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get("file")
    const patientId = formData.get("patientId")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!patientId || typeof patientId !== "string") {
      return NextResponse.json({ error: "No patient ID provided" }, { status: 400 })
    }

    // Parse filename to determine which teeth are missing
    const removed = parseFilenameForMissingTeeth(file.name)
    console.log(`Parsed filename "${file.name}":`, { removed })

    // Calculate present teeth (all teeth minus removed teeth)
    const allTeeth = Array.from({ length: 30 }, (_, i) => {
      const num = i + 2 // Start from 2
      // Skip wisdom teeth: 1, 16, 17, 32 (but we start from 2 so skip 16, 17)
      if (num === 16 || num === 17) return -1
      return num
    }).filter(n => n > 0)

    const removedSet = new Set(removed)
    const present = allTeeth.filter(n => !removedSet.has(n))

    // Update Supabase with the removed teeth data
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // Check if record exists in patient_dental_records
    const { data: existingRecord } = await supabase
      .from("patient_dental_records")
      .select("id")
      .eq("patient_id", patientId)
      .single()

    if (existingRecord) {
      // Update existing record
      const { error: updateError } = await supabase
        .from("patient_dental_records")
        .update({
          removed_teeth: removed,
          scan_date: new Date().toISOString().split("T")[0],
        })
        .eq("patient_id", patientId)

      if (updateError) {
        console.error("Supabase update error:", updateError)
        return NextResponse.json(
          { error: "Failed to update teeth data", details: updateError.message },
          { status: 500 }
        )
      }
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from("patient_dental_records")
        .insert({
          patient_id: patientId,
          removed_teeth: removed,
          cavities: [],
          scan_date: new Date().toISOString().split("T")[0],
        })

      if (insertError) {
        console.error("Supabase insert error:", insertError)
        return NextResponse.json(
          { error: "Failed to save teeth data", details: insertError.message },
          { status: 500 }
        )
      }
    }

    const finalOutput = {
      patientId,
      scanDate: new Date().toISOString().split("T")[0],
      removed,
      present,
      cavity: [],
    }

    console.log('Analysis complete (filename-based):', finalOutput)
    return NextResponse.json(finalOutput)
  } catch (err: any) {
    console.error("analyze-xray error:", err)
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    )
  }
}
