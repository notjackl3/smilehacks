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

DENTAL KNOWLEDGE BASE - USE THIS TO ANSWER INTELLIGENT QUERIES:

🦷 FUNCTION-BASED QUERIES:
- "teeth for cutting food" / "cutting teeth" / "biting teeth" = central incisor + lateral incisor (all quadrants)
- "teeth that tear food" / "tearing teeth" / "ripping teeth" = canine (all quadrants)
- "teeth that crush food" / "grinding teeth" / "crushing teeth" / "chewing teeth" = first premolar + second premolar + first molar + second molar (all quadrants)
- "main chewing teeth" / "primary chewing teeth" = first molar + second molar (all quadrants)
- "teeth that guide the bite" / "guide teeth" = canine (all quadrants) - they provide canine guidance

💪 STRENGTH & SIZE QUERIES:
- "strongest tooth" / "strongest teeth" = first molar (all quadrants) - largest surface area, thickest enamel, strongest bite force
- "biggest surface area" / "largest surface area" = first molar (all quadrants)
- "most bite force" / "handle most force" = first molar + second molar (all quadrants, especially first molars)
- "longest teeth" / "longest roots" = canine (all quadrants)
- "weakest teeth" / "most fragile" = central incisor + lateral incisor (lower quadrants only) - thin enamel, small roots

📍 POSITION & SHAPE QUERIES:
- "front teeth" = central incisor + lateral incisor + canine (all quadrants)
- "back teeth" = first premolar + second premolar + first molar + second molar (all quadrants)
- "teeth with one root" / "single root" = central incisor + lateral incisor + canine + first premolar + second premolar (varies)
- "teeth with three roots" = first molar + second molar (upper quadrants only)
- "teeth with two roots" = first molar + second molar (lower quadrants only)

⚠️ COMMON DENTAL HEALTH QUERIES:
- "teeth that get cavities most" / "cavity prone" = first molar + second molar (all quadrants) - deep grooves, harder to clean
- "most visible when smiling" / "visible teeth" / "smile teeth" = central incisor + lateral incisor + canine (upper quadrants only)
- "most likely to chip" / "chip easily" = central incisor (upper quadrants only)
- "hardest to clean" / "difficult to clean" = first molar + second molar (all quadrants, especially back ones)
- "important for facial structure" / "face structure" = canine + first molar (all quadrants) - maintain vertical dimension

🧠 ADVANCED QUERIES:
- "teeth that come in first" / "first to erupt" / "six year molars" = first molar (all quadrants)
- "wisdom teeth" / "third molars" = NOT INCLUDED in this model, return unknown
- "single-rooted front teeth" = central incisor + lateral incisor (all quadrants)
- "most stable teeth" / "strongest anchorage" = canine (all quadrants) - longest roots
- "teeth for speech" / "pronunciation teeth" / "speech sounds" = central incisor + lateral incisor (all quadrants) - for "f" and "v" sounds

🦷 GUM QUERIES:
Note: Gums are separate from teeth. If user asks about gums, respond with unknown as gums cannot be selected via this tooth selection system.
- "upper gum" / "lower gum" / "gums" / "area that supports teeth" = return unknown (gums are not selectable teeth)

GENERAL MAPPINGS:
- "eye teeth" / "cuspid" = canine (all quadrants)
- "bicuspid" / "premolar" without first/second = first premolar + second premolar
- "incisor" without central/lateral = central incisor + lateral incisor
- "molar" without first/second = first molar + second molar
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
