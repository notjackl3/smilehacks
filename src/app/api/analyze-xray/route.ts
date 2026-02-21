import { NextResponse } from "next/server"
import OpenAI from "openai"

export const runtime = "nodejs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      )
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64Image = Buffer.from(arrayBuffer).toString("base64")

    const prompt = `
You are analyzing a dental X-ray image.

Identify missing teeth using Universal Numbering (1-32).
Return ONLY valid JSON in this format:

{ "removed": [ ... ] }

If uncertain, return:
{ "removed": [] }
`

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_url: `data:${file.type};base64,${base64Image}`,
            },
          ],
        },
      ],
    })

    const outputText = response.output_text?.trim()

    if (!outputText) {
      return NextResponse.json(
        { error: "No output from model" },
        { status: 500 }
      )
    }

    let parsed
    try {
      parsed = JSON.parse(outputText)
    } catch {
      return NextResponse.json(
        { error: "Model did not return valid JSON", raw: outputText },
        { status: 500 }
      )
    }

    return NextResponse.json(parsed)
  } catch (err: any) {
    console.error("analyze-xray error:", err)
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    )
  }
}