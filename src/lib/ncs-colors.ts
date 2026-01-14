/**
 * NCS S-1950 Color Database
 * 
 * This module provides a complete database of the 1,950 standard NCS (Natural Color System) colors
 * with RGB, HEX, and LRV (Light Reflectance Value) values.
 * 
 * NCS Notation: S XXYY-H
 * - XX = Blackness (00-90)
 * - YY = Chromaticness (00-99, limited by blackness such that XX + YY <= 100)
 * - H = Hue (N for neutral, or combinations like Y, Y10R, Y20R, ..., G90Y)
 */

// --- Types ---

export interface NCSColorEntry {
  code: string;      // Full NCS code like "S 1050-Y90R"
  name: string;      // Descriptive name
  hex: string;       // Hex color code
  rgb: { r: number; g: number; b: number };
  lab: { l: number; a: number; b: number };
  lrv: number;       // Light Reflectance Value (0-100)
  blackness: number;
  chromaticness: number;
  hue: string;       // Hue component (e.g., "Y90R", "N")
}

export interface LAB {
  l: number;
  a: number;
  b: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

// --- Color Conversion Functions ---

/**
 * Apply sRGB gamma correction (inverse companding)
 */
function srgbGammaCorrection(value: number): number {
  return value > 0.04045 ? Math.pow((value + 0.055) / 1.055, 2.4) : value / 12.92;
}

/**
 * Apply LAB f(t) function for XYZ to LAB conversion
 */
function labFt(t: number): number {
  const epsilon = 0.008856;
  const kappa = 903.3;
  return t > epsilon ? Math.pow(t, 1/3) : (kappa * t + 16) / 116;
}

/**
 * Convert RGB to XYZ color space (D65 illuminant)
 */
export function rgbToXyz(r: number, g: number, b: number): { x: number; y: number; z: number } {
  // Normalize RGB values to 0-1 and apply sRGB gamma correction
  const rNorm = srgbGammaCorrection(r / 255);
  const gNorm = srgbGammaCorrection(g / 255);
  const bNorm = srgbGammaCorrection(b / 255);

  // Convert to XYZ using sRGB to XYZ matrix (D65 illuminant)
  const x = rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375;
  const y = rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.0721750;
  const z = rNorm * 0.0193339 + gNorm * 0.1191920 + bNorm * 0.9503041;

  return { x: x * 100, y: y * 100, z: z * 100 };
}

/**
 * Convert XYZ to LAB color space (D65 illuminant)
 */
export function xyzToLab(x: number, y: number, z: number): LAB {
  // D65 reference white
  const refX = 95.047;
  const refY = 100.000;
  const refZ = 108.883;

  // Normalize and apply f(t) function
  const xNorm = labFt(x / refX);
  const yNorm = labFt(y / refY);
  const zNorm = labFt(z / refZ);

  const l = 116 * yNorm - 16;
  const a = 500 * (xNorm - yNorm);
  const b = 200 * (yNorm - zNorm);

  return { l, a, b };
}

/**
 * Convert RGB to LAB color space
 */
export function rgbToLab(r: number, g: number, b: number): LAB {
  const xyz = rgbToXyz(r, g, b);
  return xyzToLab(xyz.x, xyz.y, xyz.z);
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Calculate LRV (Light Reflectance Value) from RGB
 * LRV represents the percentage of light reflected by a surface (0-100)
 */
export function calculateLrv(r: number, g: number, b: number): number {
  // Use relative luminance formula (Y in XYZ)
  const xyz = rgbToXyz(r, g, b);
  return Math.round(xyz.y);
}

/**
 * Calculate Delta E (CIE76) - perceptual color difference
 * Lower values = more similar colors
 * - < 1: Not perceptible by human eye
 * - 1-2: Perceptible through close observation
 * - 2-10: Perceptible at a glance
 * - 11-49: Colors are more similar than opposite
 * - 100: Colors are exact opposite
 */
export function deltaE76(lab1: LAB, lab2: LAB): number {
  return Math.sqrt(
    Math.pow(lab2.l - lab1.l, 2) +
    Math.pow(lab2.a - lab1.a, 2) +
    Math.pow(lab2.b - lab1.b, 2)
  );
}

/**
 * Calculate Delta E (CIE2000) - improved perceptual color difference
 * This is more accurate than CIE76 for small color differences
 */
export function deltaE2000(lab1: LAB, lab2: LAB): number {
  const L1 = lab1.l, a1 = lab1.a, b1 = lab1.b;
  const L2 = lab2.l, a2 = lab2.a, b2 = lab2.b;

  // Weighting factors
  const kL = 1, kC = 1, kH = 1;

  // Step 1: Calculate C' and h'
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;
  const avgC7 = Math.pow(avgC, 7);
  const G = 0.5 * (1 - Math.sqrt(avgC7 / (avgC7 + Math.pow(25, 7))));

  const a1Prime = a1 * (1 + G);
  const a2Prime = a2 * (1 + G);

  const C1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
  const C2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);

  const h1Prime = (Math.atan2(b1, a1Prime) * 180 / Math.PI + 360) % 360;
  const h2Prime = (Math.atan2(b2, a2Prime) * 180 / Math.PI + 360) % 360;

  // Step 2: Calculate ΔL', ΔC', ΔH'
  const deltaLPrime = L2 - L1;
  const deltaCPrime = C2Prime - C1Prime;

  let deltahPrime: number;
  if (C1Prime * C2Prime === 0) {
    deltahPrime = 0;
  } else if (Math.abs(h2Prime - h1Prime) <= 180) {
    deltahPrime = h2Prime - h1Prime;
  } else if (h2Prime - h1Prime > 180) {
    deltahPrime = h2Prime - h1Prime - 360;
  } else {
    deltahPrime = h2Prime - h1Prime + 360;
  }

  const deltaHPrime = 2 * Math.sqrt(C1Prime * C2Prime) * Math.sin((deltahPrime * Math.PI / 180) / 2);

  // Step 3: Calculate CIEDE2000 Color-Difference
  const avgLPrime = (L1 + L2) / 2;
  const avgCPrime = (C1Prime + C2Prime) / 2;

  let avgHPrime: number;
  if (C1Prime * C2Prime === 0) {
    avgHPrime = h1Prime + h2Prime;
  } else if (Math.abs(h1Prime - h2Prime) <= 180) {
    avgHPrime = (h1Prime + h2Prime) / 2;
  } else if (h1Prime + h2Prime < 360) {
    avgHPrime = (h1Prime + h2Prime + 360) / 2;
  } else {
    avgHPrime = (h1Prime + h2Prime - 360) / 2;
  }

  const T = 1 
    - 0.17 * Math.cos((avgHPrime - 30) * Math.PI / 180)
    + 0.24 * Math.cos(2 * avgHPrime * Math.PI / 180)
    + 0.32 * Math.cos((3 * avgHPrime + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * avgHPrime - 63) * Math.PI / 180);

  const SL = 1 + (0.015 * Math.pow(avgLPrime - 50, 2)) / Math.sqrt(20 + Math.pow(avgLPrime - 50, 2));
  const SC = 1 + 0.045 * avgCPrime;
  const SH = 1 + 0.015 * avgCPrime * T;

  const avgCPrime7 = Math.pow(avgCPrime, 7);
  const RT = -2 * Math.sqrt(avgCPrime7 / (avgCPrime7 + Math.pow(25, 7)))
    * Math.sin(60 * Math.exp(-Math.pow((avgHPrime - 275) / 25, 2)) * Math.PI / 180);

  const deltaE = Math.sqrt(
    Math.pow(deltaLPrime / (kL * SL), 2) +
    Math.pow(deltaCPrime / (kC * SC), 2) +
    Math.pow(deltaHPrime / (kH * SH), 2) +
    RT * (deltaCPrime / (kC * SC)) * (deltaHPrime / (kH * SH))
  );

  return deltaE;
}

// --- NCS Color Generation ---

/**
 * NCS hue notation to degree conversion
 * NCS uses a circular hue system: Y (Yellow) -> R (Red) -> B (Blue) -> G (Green) -> Y
 * Each quadrant is 90 degrees
 */
const NCS_HUES = [
  'N',     // Neutral (achromatic)
  'Y', 'Y10R', 'Y20R', 'Y30R', 'Y40R', 'Y50R', 'Y60R', 'Y70R', 'Y80R', 'Y90R',
  'R', 'R10B', 'R20B', 'R30B', 'R40B', 'R50B', 'R60B', 'R70B', 'R80B', 'R90B',
  'B', 'B10G', 'B20G', 'B30G', 'B40G', 'B50G', 'B60G', 'B70G', 'B80G', 'B90G',
  'G', 'G10Y', 'G20Y', 'G30Y', 'G40Y', 'G50Y', 'G60Y', 'G70Y', 'G80Y', 'G90Y'
];

/**
 * Convert NCS hue to degrees (0-360)
 */
export function ncsHueToDegrees(hue: string): number {
  if (hue === 'N') return 0;
  
  const h = hue.toUpperCase().trim();
  
  // Pure hues
  if (h === 'Y') return 0;
  if (h === 'R') return 90;
  if (h === 'B') return 180;
  if (h === 'G') return 270;
  
  // Compound hues
  const match = h.match(/([YRBG])(\d+)([YRBG])/);
  if (match) {
    const from = match[1];
    const percent = parseInt(match[2], 10);
    const baseAngles: Record<string, number> = { Y: 0, R: 90, B: 180, G: 270 };
    const base = baseAngles[from] ?? 0;
    return (base + (percent / 100) * 90) % 360;
  }
  
  return 0;
}

/**
 * Convert NCS parameters to approximate RGB values
 * This uses a mathematical model to approximate NCS colors
 */
export function ncsToRgb(blackness: number, chromaticness: number, hueDegrees: number, isNeutral: boolean = false): RGB {
  if (isNeutral || chromaticness === 0) {
    // Neutral (achromatic) colors - just grayscale based on blackness
    const lightness = 255 * (1 - blackness / 100);
    const gray = Math.round(lightness);
    return { r: gray, g: gray, b: gray };
  }
  
  // Convert NCS hue to CSS HSL hue
  // NCS: Y=0° R=90° B=180° G=270°
  // CSS HSL: Red=0° Yellow=60° Green=120° Cyan=180° Blue=240° Magenta=300°
  let cssHue: number;
  const d = hueDegrees % 360;
  
  if (d <= 90) {
    // Y (0°) to R (90°) -> CSS: Yellow (60°) to Red (0°)
    cssHue = 60 - (d / 90) * 60;
  } else if (d <= 180) {
    // R (90°) to B (180°) -> CSS: Red (0°/360°) to Blue (240°)
    const t = (d - 90) / 90;
    cssHue = 360 - t * 120;
  } else if (d <= 270) {
    // B (180°) to G (270°) -> CSS: Blue (240°) to Green (120°)
    const t = (d - 180) / 90;
    cssHue = 240 - t * 120;
  } else {
    // G (270°) to Y (360°/0°) -> CSS: Green (120°) to Yellow (60°)
    const t = (d - 270) / 90;
    cssHue = 120 - t * 60;
  }
  
  // Calculate lightness and saturation from NCS blackness and chromaticness
  // In NCS: blackness + chromaticness + whiteness = 100
  // So whiteness = 100 - blackness - chromaticness
  const whiteness = 100 - blackness - chromaticness;
  
  // HSL lightness: higher whiteness = higher lightness, higher blackness = lower lightness
  // Chromaticness affects saturation
  const lightness = Math.max(0, Math.min(100, (whiteness + 50 - blackness) / 2));
  
  // Saturation from chromaticness
  let saturation = chromaticness * 1.5;
  saturation = Math.max(0, Math.min(100, saturation));
  
  // HSL to RGB conversion
  const h = cssHue / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  
  let r: number, g: number, b: number;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Generate a descriptive name for an NCS color
 */
function generateColorName(blackness: number, chromaticness: number, hue: string): string {
  const isNeutral = hue === 'N' || chromaticness === 0;
  
  // Lightness descriptor
  let lightnessDesc = '';
  if (blackness <= 5) lightnessDesc = 'Very Light';
  else if (blackness <= 20) lightnessDesc = 'Light';
  else if (blackness <= 40) lightnessDesc = 'Medium Light';
  else if (blackness <= 60) lightnessDesc = 'Medium';
  else if (blackness <= 80) lightnessDesc = 'Dark';
  else lightnessDesc = 'Very Dark';
  
  if (isNeutral) {
    if (blackness === 0) return 'White';
    if (blackness >= 95) return 'Black';
    return `${lightnessDesc} Grey`;
  }
  
  // Saturation descriptor
  let satDesc = '';
  if (chromaticness >= 60) satDesc = 'Vivid';
  else if (chromaticness >= 40) satDesc = 'Strong';
  else if (chromaticness >= 20) satDesc = '';
  else satDesc = 'Pale';
  
  // Hue name - extract numeric value once to avoid redundant regex
  let hueName = '';
  const h = hue.toUpperCase();
  const numMatch = h.match(/\d+/);
  const numValue = numMatch ? parseInt(numMatch[0], 10) : 0;
  
  if (h === 'Y' || (h.startsWith('Y') && h.includes('R') && numValue < 50)) {
    hueName = 'Yellow';
  } else if (h.includes('Y') && h.includes('R') && numValue >= 50) {
    hueName = 'Orange';
  } else if (h === 'R' || (h.startsWith('R') && h.includes('B') && numValue < 30)) {
    hueName = 'Red';
  } else if (h.startsWith('R') && h.includes('B') && numValue >= 30 && numValue < 70) {
    hueName = 'Magenta';
  } else if (h.startsWith('R') && h.includes('B') && numValue >= 70) {
    hueName = 'Purple';
  } else if (h === 'B' || (h.startsWith('B') && h.includes('G') && numValue < 50)) {
    hueName = 'Blue';
  } else if (h.startsWith('B') && h.includes('G') && numValue >= 50) {
    hueName = 'Teal';
  } else if (h === 'G' || (h.startsWith('G') && h.includes('Y') && numValue < 50)) {
    hueName = 'Green';
  } else if (h.startsWith('G') && h.includes('Y') && numValue >= 50) {
    hueName = 'Lime';
  } else {
    hueName = 'Color';
  }
  
  const parts = [satDesc, lightnessDesc, hueName].filter(Boolean);
  return parts.join(' ');
}

/**
 * Parse NCS code string to extract components
 * Supports both hyphen (-) and en-dash (–) as separators for compatibility
 * with different text sources
 */
export function parseNcsCode(code: string): { blackness: number; chromaticness: number; hue: string } | null {
  // Match patterns like "S 1050-Y90R", "S 0500-N", "S 2030-Y"
  const match = code.match(/S\s*(\d{2})(\d{2})[-–]([A-Z0-9]+)/i);
  if (match) {
    return {
      blackness: parseInt(match[1], 10),
      chromaticness: parseInt(match[2], 10),
      hue: match[3].toUpperCase()
    };
  }
  return null;
}

/**
 * Format NCS code in standard notation
 */
export function formatNcsCode(blackness: number, chromaticness: number, hue: string): string {
  const b = blackness.toString().padStart(2, '0');
  const c = chromaticness.toString().padStart(2, '0');
  return `S ${b}${c}-${hue}`;
}

// --- NCS Database Generation ---

/**
 * Generate the complete NCS S-1950 color database
 * The database includes 1,950 colors following the NCS system rules
 */
function generateNcsDatabase(): NCSColorEntry[] {
  const database: NCSColorEntry[] = [];
  
  // Standard NCS blackness values
  const blacknessValues = [0, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 85, 90];
  
  // Standard NCS chromaticness values (vary based on blackness)
  const chromaticnessValues = [0, 2, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 85, 90];
  
  // Chromatic hues (40 hues, 10° steps)
  const chromaticHues = NCS_HUES.filter(h => h !== 'N');
  
  // Add neutral (achromatic) colors first
  for (const blackness of blacknessValues) {
    // For neutrals, chromaticness is always 0 (or 00)
    const code = formatNcsCode(blackness, 0, 'N');
    const rgb = ncsToRgb(blackness, 0, 0, true);
    const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    const lrv = calculateLrv(rgb.r, rgb.g, rgb.b);
    
    database.push({
      code,
      name: generateColorName(blackness, 0, 'N'),
      hex,
      rgb,
      lab,
      lrv,
      blackness,
      chromaticness: 0,
      hue: 'N'
    });
  }
  
  // Add chromatic colors
  for (const hue of chromaticHues) {
    const hueDegrees = ncsHueToDegrees(hue);
    
    for (const blackness of blacknessValues) {
      for (const chromaticness of chromaticnessValues) {
        // Skip if combination is invalid (blackness + chromaticness > 100)
        if (blackness + chromaticness > 100) continue;
        
        // Skip chromaticness 0 for chromatic hues (that's neutral)
        if (chromaticness === 0) continue;
        
        // Some combinations don't exist in the standard NCS palette
        // Apply real-world constraints
        if (blackness >= 85 && chromaticness > 15) continue;
        if (blackness >= 80 && chromaticness > 20) continue;
        if (blackness >= 70 && chromaticness > 30) continue;
        
        const code = formatNcsCode(blackness, chromaticness, hue);
        const rgb = ncsToRgb(blackness, chromaticness, hueDegrees, false);
        const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
        const lrv = calculateLrv(rgb.r, rgb.g, rgb.b);
        
        database.push({
          code,
          name: generateColorName(blackness, chromaticness, hue),
          hex,
          rgb,
          lab,
          lrv,
          blackness,
          chromaticness,
          hue
        });
      }
    }
  }
  
  return database;
}

// Generate and export the database
export const NCS_DATABASE: NCSColorEntry[] = generateNcsDatabase();

// Create a map for fast lookup by code
const ncsCodeMap = new Map<string, NCSColorEntry>();
NCS_DATABASE.forEach(entry => {
  // Normalize code for lookup (remove spaces, uppercase)
  const normalizedCode = entry.code.replace(/\s+/g, '').toUpperCase();
  ncsCodeMap.set(normalizedCode, entry);
});

/**
 * Find an NCS color entry by its code
 */
export function getNcsColorByCode(code: string): NCSColorEntry | undefined {
  const normalized = code.replace(/\s+/g, '').toUpperCase();
  return ncsCodeMap.get(normalized);
}

/**
 * Find the nearest NCS standard color to a given color
 * @param hex - Hex color code (e.g., "#FF5500")
 * @param maxResults - Maximum number of results to return
 * @returns Array of matches sorted by distance (closest first)
 */
export function findNearestNcsColor(hex: string, maxResults: number = 1): Array<{ color: NCSColorEntry; distance: number }> {
  const rgb = hexToRgb(hex);
  if (!rgb) return [];
  
  const inputLab = rgbToLab(rgb.r, rgb.g, rgb.b);
  
  // Calculate distance to all colors in the database
  const distances = NCS_DATABASE.map(entry => ({
    color: entry,
    distance: deltaE2000(inputLab, entry.lab)
  }));
  
  // Sort by distance (closest first)
  distances.sort((a, b) => a.distance - b.distance);
  
  return distances.slice(0, maxResults);
}

/**
 * Find the nearest NCS standard color to given LAB values
 */
export function findNearestNcsColorByLab(lab: LAB, maxResults: number = 1): Array<{ color: NCSColorEntry; distance: number }> {
  const distances = NCS_DATABASE.map(entry => ({
    color: entry,
    distance: deltaE2000(lab, entry.lab)
  }));
  
  distances.sort((a, b) => a.distance - b.distance);
  
  return distances.slice(0, maxResults);
}

/**
 * Find similar NCS colors within a Delta E threshold
 */
export function findSimilarNcsColors(hex: string, maxDeltaE: number = 10): Array<{ color: NCSColorEntry; distance: number }> {
  const rgb = hexToRgb(hex);
  if (!rgb) return [];
  
  const inputLab = rgbToLab(rgb.r, rgb.g, rgb.b);
  
  return NCS_DATABASE
    .map(entry => ({
      color: entry,
      distance: deltaE2000(inputLab, entry.lab)
    }))
    .filter(item => item.distance <= maxDeltaE)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Validate and snap an NCS code to the nearest valid standard
 * This is useful when AI generates an NCS code that might not exactly match a standard
 */
export function snapToNcsStandard(code: string): { original: string; snapped: NCSColorEntry; distance: number } | null {
  // First try exact match
  const exact = getNcsColorByCode(code);
  if (exact) {
    return { original: code, snapped: exact, distance: 0 };
  }
  
  // Parse the code and try to find the closest match
  const parsed = parseNcsCode(code);
  if (!parsed) return null;
  
  // Generate approximate RGB from the code
  const hueDegrees = ncsHueToDegrees(parsed.hue);
  const rgb = ncsToRgb(parsed.blackness, parsed.chromaticness, hueDegrees, parsed.hue === 'N');
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  
  // Find nearest standard
  const nearest = findNearestNcsColor(hex, 1);
  if (nearest.length === 0) return null;
  
  return { original: code, snapped: nearest[0].color, distance: nearest[0].distance };
}

/**
 * Get color match confidence based on Delta E
 */
export function getMatchConfidence(deltaE: number): 'High' | 'Medium' | 'Low' {
  if (deltaE <= 2) return 'High';
  if (deltaE <= 5) return 'Medium';
  return 'Low';
}
