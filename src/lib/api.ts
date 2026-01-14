import { GoogleGenAI, Type } from "@google/genai";
import type { Schema } from "@google/genai";
import { snapToNcsStandard, findNearestNcsColor, getMatchConfidence } from '$lib/ncs-colors';
import type { ColorMatch, AnalysisResult } from '$lib/stores/app';

/**
 * Snap AI-generated NCS colors to valid NCS standards
 */
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

export async function analyzeImage(base64Image: string, salient: boolean = false): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const modelName = salient ? "gemini-3-pro-preview" : "gemini-3-flash-preview";
  const useWebSearch = salient;
  
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      productType: { type: Type.STRING, description: "Specific product name (e.g. 'Herman Miller Aeron Chair') or precise generic description. If recognized, include manufacturer and model." },
      materials: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            texture: { type: Type.STRING },
            finish: { type: Type.STRING },
          },
          required: ["name", "texture", "finish"],
        },
      },
      colors: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            system: { type: Type.STRING, enum: ["RAL", "NCS"], description: "Use NCS S-Series for architecture/interior, RAL for industrial metal." },
            code: { type: Type.STRING, description: "The exact standard code (e.g. 'NCS S 2005-Y20R' or 'RAL 9010'). Must be a valid, existing code from official NCS or RAL catalogs." },
            name: { type: Type.STRING, description: "Official color name from NCS or RAL catalog." },
            hex: { type: Type.STRING, description: "Hexadecimal representation." },
            location: { type: Type.STRING, description: "Specific part of the object (e.g. 'Seat Shell', 'Legs')." },
            confidence: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
            materialGuess: { type: Type.STRING, description: "Precise material identification (e.g. 'Soap Treated Oak', 'Anodized Aluminum')." },
            finishGuess: { type: Type.STRING, description: "Surface finish (e.g. 'Satin Varnish', 'Matte Powder Coat', 'Brushed')." },
            laymanDescription: { type: Type.STRING, description: "A sensory description of the look and feel for non-experts." },
            lrv: { type: Type.STRING, description: "Light Reflectance Value (0-100) typical for this color standard." },
            cmyk: { type: Type.STRING, description: "Standard CMYK values (e.g. '0, 50, 100, 0')." },
            rgb: { type: Type.STRING, description: "Standard RGB values (e.g. '255, 120, 0')." },
            blackness: { type: Type.STRING, description: "NCS Blackness component (00-99)." },
            chromaticness: { type: Type.STRING, description: "NCS Chromaticness component (00-99)." },
            hue: { type: Type.STRING, description: "NCS Hue component (e.g. 'Y20R')." }
          },
          required: ["system", "code", "name", "hex", "location", "confidence", "materialGuess", "finishGuess", "laymanDescription", "lrv", "cmyk", "rgb"],
        },
      },
    },
    required: ["productType", "materials", "colors"],
  };

  const promptText = `You are a precision Colorimeter and CMF (Color, Material, Finish) Expert${useWebSearch ? ' with access to web search' : ''}. Your goal is to identify materials and colors with **database-level accuracy**.

**STEP 1: PRODUCT IDENTIFICATION (CRITICAL)**
First, identify the product in the image:
${useWebSearch ? `- If you recognize a specific product (e.g., furniture brand, car model, electronic device, appliance), use web search to find the **exact official color specifications** from the manufacturer.
- Search for terms like "[Product Name] color codes", "[Product Name] NCS code", "[Product Name] RAL color", "[Manufacturer] official colors".
- Many manufacturers publish exact NCS or RAL codes for their products. Find and use these official codes.` : `- If you recognize a specific product (e.g., furniture brand, car model, electronic device, appliance), identify it accurately.
- Use your knowledge of common manufacturer color specifications when available.`}

**STEP 2: LIGHTING CORRECTION**
Before identifying colors visually, mathematically compensate for the lighting in the image:
- Remove yellow/warm cast from indoor tungsten lights
- Correct for cool LED lighting
- Account for exposure differences
Identify the *true* underlying color as if viewed under D65 standard daylight.

**STEP 3: EXACT COLOR MATCHING**
For each distinct color area:
${useWebSearch ? '- If product was recognized: Use the official manufacturer color codes found via web search.' : '- If product was recognized: Use known manufacturer color codes if available.'}
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

  const response = await ai.models.generateContent({
    model: modelName,
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image,
            mimeType: "image/jpeg",
          },
        },
        {
          text: promptText,
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.1,
      ...(useWebSearch && { tools: [{ googleSearch: {} }] }),
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response");
  
  const result = JSON.parse(text) as AnalysisResult;
  result.colors = snapColorsToNcsStandards(result.colors);
  
  return result;
}
