import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// All valid tooth names and their variations
const TOOTH_TYPES = [
  'central incisor',
  'lateral incisor',
  'canine',
  'first premolar',
  'second premolar',
  'first molar',
  'second molar',
];

const QUADRANTS = ['upper right', 'upper left', 'lower right', 'lower left'];

interface ToothSelection {
  toothType: string;
  quadrant: string;
}

interface ParsedCommand {
  action: 'select' | 'deselect' | 'clear' | 'unknown';
  teeth: ToothSelection[];
}

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json();

    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const systemPrompt = `You are a dental assistant AI that parses voice commands for selecting teeth in a 3D dental model viewer.

The user will give you a voice command about selecting teeth. Parse the command and extract:
1. The action: "select", "deselect", or "clear" (clear all selections)
2. The teeth mentioned, each with:
   - toothType: one of: "central incisor", "lateral incisor", "canine", "first premolar", "second premolar", "first molar", "second molar"
   - quadrant: one of: "upper right", "upper left", "lower right", "lower left"

TOOTH POSITION REFERENCE (front to back):
When users refer to teeth by position/number, use this mapping:
- 1st tooth / first tooth = "central incisor"
- 2nd tooth / second tooth = "lateral incisor"
- 3rd tooth / third tooth = "canine"
- 4th tooth / fourth tooth = "first premolar"
- 5th tooth / fifth tooth = "second premolar"
- 6th tooth / sixth tooth = "first molar"
- 7th tooth / seventh tooth = "second molar"

Examples:
- "the third tooth from upper right" = canine, upper right
- "select the 5th tooth on the lower left" = second premolar, lower left
- "the first two teeth upper left" = central incisor + lateral incisor, upper left

Important rules:
- "Cuspid" = "canine"
- "Bicuspid" or "premolar" without first/second = assume both first and second premolar
- "Incisor" without central/lateral = assume both central and lateral incisor
- "Molar" without first/second = assume both first and second molar
- If no quadrant is specified, include all 4 quadrants for that tooth type
- "All teeth" or "everything" = all tooth types in all quadrants
- "Upper teeth" = all tooth types in upper right and upper left
- "Lower teeth" = all tooth types in lower right and lower left
- "Right teeth" = all tooth types in upper right and lower right
- "Left teeth" = all tooth types in upper left and lower left
- "Front teeth" = central incisor and lateral incisor in all quadrants
- "Back teeth" = first molar and second molar in all quadrants

TOOTH FUNCTION DESCRIPTIONS:
When users describe teeth by their function, use this mapping:
- "chewing teeth" / "grinding teeth" / "teeth for chewing/grinding" = first molar + second molar (all quadrants)
- "biting teeth" / "cutting teeth" / "teeth for biting/cutting" = central incisor + lateral incisor (all quadrants)
- "tearing teeth" / "ripping teeth" / "pointy teeth" / "fangs" = canine (all quadrants)
- "strongest teeth" / "sharpest teeth" = canine (all quadrants)
- "biggest teeth" / "largest teeth" = first molar + second molar (all quadrants)
- "smallest teeth" = lateral incisor (all quadrants)
- "eye teeth" = canine (all quadrants)
- "wisdom teeth" / "third molars" = we don't have these in our model, return unknown
- "baby teeth" / "milk teeth" = return unknown (adult model only)

Respond ONLY with a JSON object in this exact format:
{
  "action": "select" | "deselect" | "clear" | "unknown",
  "teeth": [
    { "toothType": "...", "quadrant": "..." }
  ]
}

If the command is unclear or not about teeth selection, return:
{ "action": "unknown", "teeth": [] }`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript },
      ],
      temperature: 0,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0]?.message?.content || '';

    // Parse the JSON response
    let parsed: ParsedCommand;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = { action: 'unknown', teeth: [] };
      }
    } catch {
      parsed = { action: 'unknown', teeth: [] };
    }

    // Validate and normalize the parsed command
    const validatedTeeth: ToothSelection[] = [];
    for (const tooth of parsed.teeth || []) {
      const normalizedType = tooth.toothType?.toLowerCase();
      const normalizedQuadrant = tooth.quadrant?.toLowerCase();

      if (TOOTH_TYPES.includes(normalizedType) && QUADRANTS.includes(normalizedQuadrant)) {
        validatedTeeth.push({
          toothType: normalizedType,
          quadrant: normalizedQuadrant,
        });
      }
    }

    return NextResponse.json({
      action: ['select', 'deselect', 'clear'].includes(parsed.action) ? parsed.action : 'unknown',
      teeth: validatedTeeth,
      rawTranscript: transcript,
    });
  } catch (error) {
    console.error('Error parsing voice command:', error);
    return NextResponse.json(
      { error: 'Failed to parse voice command' },
      { status: 500 }
    );
  }
}
