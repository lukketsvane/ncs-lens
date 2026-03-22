import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import OpenAI from 'openai';
import { snapToNcsStandard, findNearestNcsColor, getMatchConfidence } from '$lib/ncs-colors';
import type { ColorMatch, AnalysisResult } from '$lib/stores/app';

function snapColorsToNcsStandards(colors: ColorMatch[]): ColorMatch[] {
  return colors.map(color => {
    if (color.system !== 'NCS') return color;

    const snapped = snapToNcsStandard(color.code);

    if (snapped && snapped.distance > 0) {
      const ncsColor = snapped.snapped;
      return {
        ...color,
        code: ncsColor.code,
        name: ncsColor.name || color.name,
        hex: ncsColor.hex,
        lrv: String(ncsColor.lrv),
        rgb: `${ncsColor.rgb.r}, ${ncsColor.rgb.g}, ${ncsColor.rgb.b}`,
        blackness: String(ncsColor.blackness).padStart(2, '0'),
        chromaticness: String(ncsColor.chromaticness).padStart(2, '0'),
        hue: ncsColor.hue,
        confidence: getMatchConfidence(snapped.distance)
      };
    } else if (snapped && snapped.distance === 0) {
      const ncsColor = snapped.snapped;
      return {
        ...color,
        hex: ncsColor.hex,
        lrv: String(ncsColor.lrv),
        rgb: `${ncsColor.rgb.r}, ${ncsColor.rgb.g}, ${ncsColor.rgb.b}`,
        blackness: String(ncsColor.blackness).padStart(2, '0'),
        chromaticness: String(ncsColor.chromaticness).padStart(2, '0'),
        hue: ncsColor.hue
      };
    } else {
      const nearest = findNearestNcsColor(color.hex, 1);
      if (nearest.length > 0) {
        const ncsColor = nearest[0].color;
        return {
          ...color,
          code: ncsColor.code,
          name: ncsColor.name || color.name,
          hex: ncsColor.hex,
          lrv: String(ncsColor.lrv),
          rgb: `${ncsColor.rgb.r}, ${ncsColor.rgb.g}, ${ncsColor.rgb.b}`,
          blackness: String(ncsColor.blackness).padStart(2, '0'),
          chromaticness: String(ncsColor.chromaticness).padStart(2, '0'),
          hue: ncsColor.hue,
          confidence: getMatchConfidence(nearest[0].distance)
        };
      }
    }

    return color;
  });
}

const responseSchema = {
  name: 'color_analysis',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      productType: { type: 'string' as const, description: "Specific product name (e.g. 'Herman Miller Aeron Chair') or precise generic description. If recognized, include manufacturer and model." },
      materials: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const },
            texture: { type: 'string' as const },
            finish: { type: 'string' as const }
          },
          required: ['name', 'texture', 'finish'],
          additionalProperties: false
        }
      },
      colors: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            system: { type: 'string' as const, enum: ['RAL', 'NCS'], description: 'Use NCS S-Series for architecture/interior, RAL for industrial metal.' },
            code: { type: 'string' as const, description: "The exact standard code (e.g. 'NCS S 2005-Y20R' or 'RAL 9010'). Must be a valid, existing code from official NCS or RAL catalogs." },
            name: { type: 'string' as const, description: 'Official color name from NCS or RAL catalog.' },
            hex: { type: 'string' as const, description: 'Hexadecimal representation.' },
            location: { type: 'string' as const, description: "Specific part of the object (e.g. 'Seat Shell', 'Legs')." },
            confidence: { type: 'string' as const, enum: ['High', 'Medium', 'Low'] },
            materialGuess: { type: 'string' as const, description: "Precise material identification (e.g. 'Soap Treated Oak', 'Anodized Aluminum')." },
            finishGuess: { type: 'string' as const, description: "Surface finish (e.g. 'Satin Varnish', 'Matte Powder Coat', 'Brushed')." },
            laymanDescription: { type: 'string' as const, description: 'A sensory description of the look and feel for non-experts.' },
            lrv: { type: 'string' as const, description: 'Light Reflectance Value (0-100) typical for this color standard.' },
            cmyk: { type: 'string' as const, description: "Standard CMYK values (e.g. '0, 50, 100, 0')." },
            rgb: { type: 'string' as const, description: "Standard RGB values (e.g. '255, 120, 0')." },
            blackness: { type: 'string' as const, description: 'NCS Blackness component (00-99).' },
            chromaticness: { type: 'string' as const, description: 'NCS Chromaticness component (00-99).' },
            hue: { type: 'string' as const, description: "NCS Hue component (e.g. 'Y20R')." }
          },
          required: ['system', 'code', 'name', 'hex', 'location', 'confidence', 'materialGuess', 'finishGuess', 'laymanDescription', 'lrv', 'cmyk', 'rgb', 'blackness', 'chromaticness', 'hue'],
          additionalProperties: false
        }
      }
    },
    required: ['productType', 'materials', 'colors'],
    additionalProperties: false
  }
};

function buildPrompt(salient: boolean): string {
  return `You are a precision Colorimeter and CMF (Color, Material, Finish) Expert. Your goal is to identify materials and colors with **database-level accuracy**.

**STEP 1: PRODUCT IDENTIFICATION (CRITICAL)**
First, identify the product in the image:
${salient
    ? `- If you recognize a specific product (e.g., furniture brand, car model, electronic device, appliance), use your extensive knowledge to find the **exact official color specifications** from the manufacturer.
- Think about terms like "[Product Name] color codes", "[Product Name] NCS code", "[Product Name] RAL color", "[Manufacturer] official colors".
- Many manufacturers publish exact NCS or RAL codes for their products. Use these official codes when known.`
    : `- If you recognize a specific product (e.g., furniture brand, car model, electronic device, appliance), identify it accurately.
- Use your knowledge of common manufacturer color specifications when available.`}

**STEP 2: LIGHTING CORRECTION**
Before identifying colors visually, mathematically compensate for the lighting in the image:
- Remove yellow/warm cast from indoor tungsten lights
- Correct for cool LED lighting
- Account for exposure differences
Identify the *true* underlying color as if viewed under D65 standard daylight.

**STEP 3: EXACT COLOR MATCHING**
For each distinct color area:
${salient ? '- If product was recognized: Use the official manufacturer color codes from your knowledge.' : '- If product was recognized: Use known manufacturer color codes if available.'}
- If generic product: Match to the closest **NCS S-Series** or **RAL Classic** code.
- **PRECISION IS CRITICAL**:
  - A "white" wall could be "NCS S 0500-N" (Pure White), "NCS S 0502-Y" (Standard White with yellow undertone), or "NCS S 0502-B" (with blue undertone).
  - Look for subtle undertones and match precisely.
  - Only use codes that actually exist in the official NCS or RAL catalogs.

**STEP 4: TECHNICAL DATA**
Provide standard technical specifications:
- Use official LRV values from NCS/RAL databases (not estimated from pixels)
- Include accurate CMYK and RGB conversions

**NCS Notation Rules:**
- Format: "S BBCC-H" (e.g., NCS S 1050-Y90R)
- S = Second edition
- BB = Blackness (00-90, in steps: 00, 05, 10, 15, 20, 30, 40, 50, 60, 70, 80, 85, 90)
- CC = Chromaticness (00-90, depends on blackness)
- H = Hue (N for neutral, or: Y, Y10R, Y20R... to G90Y)

**RAL Classic Rules:**
- Format: "RAL XXXX" (e.g., RAL 9010, RAL 7016)
- Use 4-digit codes from RAL Classic palette

**Examples of precision:**
- IKEA Kallax: Often uses NCS S 0500-N or close
- Herman Miller Aeron: Graphite is approximately RAL 7016
- Apple products: Often matched to specific Pantone/RAL codes

Return the data in the specified JSON schema.`;
}

export const POST: RequestHandler = async ({ request }) => {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw error(500, 'OPENAI_API_KEY is not configured');
  }

  const { base64Image, salient } = await request.json();
  if (!base64Image) {
    throw error(400, 'Missing base64Image');
  }

  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1,
    response_format: {
      type: 'json_schema',
      json_schema: responseSchema
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
              detail: 'high'
            }
          },
          {
            type: 'text',
            text: buildPrompt(!!salient)
          }
        ]
      }
    ]
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw error(500, 'No response from OpenAI');

  const result = JSON.parse(text) as AnalysisResult;
  result.colors = snapColorsToNcsStandards(result.colors);

  return json(result);
};
