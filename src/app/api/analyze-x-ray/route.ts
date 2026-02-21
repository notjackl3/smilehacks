import { NextResponse } from "next/server"
import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // IMPORTANT: server-side only
)

export async function POST(req: Request) {
  try {
    const { storagePath } = await req.json()

    if (!storagePath) {
      return NextResponse.json({ error: "Missing storagePath" }, { status: 400 })
    }

    // 1️⃣ Download image from Supabase Storage
    const { data, error } = await supabase
      .storage
      .from("xray-images")
      .download(storagePath)

    if (error || !data) {
      throw new Error("Failed to download image")
    }

    const buffer = Buffer.from(await data.arrayBuffer())
    const base64Image = buffer.toString("base64")

    // 2️⃣ Send to OpenAI Vision
    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
You are a dental radiograph analyzer.

Look at this panoramic dental X-ray.

Return ONLY valid JSON in this format:

{
  "removed": [list of missing tooth numbers using universal numbering 1-32]
}

If uncertain, make your best clinical estimate.
Return only JSON. No explanation.
              `,
            },
            {
              type: "input_image",
              image_base64: base64Image,
            },
          ],
        },
      ],
    })

    const textOutput = response.output_text

    // 3️⃣ Parse JSON safely
    let analysis
    try {
      analysis = JSON.parse(textOutput)
    } catch {
      throw new Error("Model did not return valid JSON")
    }

    // 4️⃣ Save analysis.json to Storage
    const analysisPath = storagePath.replace(/\.[^/.]+$/, ".analysis.json")

    await supabase.storage
      .from("xray-images")
      .upload(
        analysisPath,
        new Blob([JSON.stringify(analysis)], { type: "application/json" }),
        { upsert: true }
      )

    return NextResponse.json({ success: true, analysisPath })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}