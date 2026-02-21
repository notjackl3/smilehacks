import { NextResponse } from "next/server"

export const runtime = "nodejs"

function uniqSorted(nums: number[]) {
  const seen = new Set<number>()
  const out: number[] = []
  for (const n of nums) {
    if (!seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  out.sort((a, b) => a - b)
  return out
}

function extractJson(text: string) {
  const t = text.trim()

  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) return fenced[1].trim()

  const firstObjStart = t.indexOf("{")
  const lastObjEnd = t.lastIndexOf("}")
  if (firstObjStart !== -1 && lastObjEnd !== -1 && lastObjEnd > firstObjStart) {
    return t.slice(firstObjStart, lastObjEnd + 1).trim()
  }

  return t
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64Image = Buffer.from(arrayBuffer).toString("base64")
    const imageUrl = "data:" + file.type + ";base64," + base64Image

    const prompt = `
You are analyzing a PANORAMIC dental X-ray (full mouth).

Return ONLY valid JSON in this exact format:
{ "present": [ ... ] }

Rules:
- "present" is the list of permanent teeth you can reasonably see (Universal numbering 1–32).
- Use unique integers only, sorted ascending.
- Return JSON only. No extra text.
`

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: imageUrl },
            ],
          },
        ],
      }),
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      return NextResponse.json({ error: errorText }, { status: aiResponse.status })
    }

    const aiData = await aiResponse.json()

    const outputText =
      (aiData?.output_text && String(aiData.output_text)) ||
      aiData?.output?.[0]?.content?.[0]?.text ||
      ""

    const trimmed = String(outputText).trim()
    if (!trimmed) {
      return NextResponse.json({ error: "No output from model" }, { status: 500 })
    }

    let parsed: any
    try {
      const jsonText = extractJson(trimmed)
      parsed = JSON.parse(jsonText)
    } catch {
      return NextResponse.json(
        { error: "Model did not return valid JSON", raw: trimmed },
        { status: 500 }
      )
    }

    const presentRaw = parsed?.present
    const present: number[] = Array.isArray(presentRaw)
      ? uniqSorted(
          presentRaw
            .map((x: any) => Number(x))
            .filter((n: number) => Number.isInteger(n) && n >= 1 && n <= 32)
        )
      : []

    const presentSet = new Set<number>(present)

    const removedAll: number[] = []
    for (let t = 1; t <= 32; t++) {
      if (!presentSet.has(t)) removedAll.push(t)
    }

    // ✅ cap missing teeth at 7
    const removed = removedAll.slice(0, 7)

    const finalOutput = {
      scanId: "CT-2024-001",
      patientId: "P-12345",
      scanDate: new Date().toISOString().split("T")[0],
      removed,
      cavity: [],
    }

    return NextResponse.json(finalOutput)
  } catch (err: any) {
    console.error("analyze-xray error:", err)
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    )
  }
}