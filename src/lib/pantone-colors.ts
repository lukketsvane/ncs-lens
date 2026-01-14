/**
 * Pantone Color Dataset
 * 
 * This module provides a dataset of popular Pantone colors for palette extraction
 * from images. Colors include Color of the Year selections and commonly used
 * Pantone colors for graphic design and print.
 */

export interface PantoneColor {
  code: string;
  name: string;
  hex: string;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface PantoneMatch {
  code: string;
  name: string;
  hex: string;
  distance: number;
}

// Pantone color dataset - subset of popular colors including Colors of the Year
export const PANTONE_COLORS: PantoneColor[] = [
  // Colors of the Year
  { code: "13-1023", name: "Peach Fuzz", hex: "#FFBE98" },
  { code: "18-1750", name: "Viva Magenta", hex: "#BB2649" },
  { code: "17-3938", name: "Very Peri", hex: "#6667AB" },
  { code: "17-5104", name: "Ultimate Gray", hex: "#939597" },
  { code: "13-0647", name: "Illuminating", hex: "#F5DF4D" },
  { code: "19-4052", name: "Classic Blue", hex: "#0F4C81" },
  { code: "16-1546", name: "Living Coral", hex: "#FF6F61" },
  { code: "18-3838", name: "Ultra Violet", hex: "#5F4B8B" },
  { code: "15-0343", name: "Greenery", hex: "#88B04B" },
  { code: "13-1520", name: "Rose Quartz", hex: "#F7CAC9" },
  { code: "15-3919", name: "Serenity", hex: "#92A8D1" },
  { code: "18-1438", name: "Marsala", hex: "#955251" },
  { code: "18-3224", name: "Radiant Orchid", hex: "#B565A7" },
  { code: "17-5641", name: "Emerald", hex: "#009473" },
  { code: "17-1463", name: "Tangerine Tango", hex: "#DD4124" },
  { code: "18-2120", name: "Honeysuckle", hex: "#D65076" },
  { code: "15-5519", name: "Turquoise", hex: "#45B5AA" },
  { code: "14-0848", name: "Mimosa", hex: "#F0C05A" },
  { code: "18-3943", name: "Blue Iris", hex: "#5A5B9F" },
  { code: "19-1557", name: "Chili Pepper", hex: "#9B1B30" },
  
  // Neutrals and basics
  { code: "13-1106", name: "Sand Dollar", hex: "#DECDBE" },
  { code: "15-4020", name: "Cerulean", hex: "#9BB7D4" },
  { code: "19-0303", name: "Jet Black", hex: "#2D2926" },
  { code: "11-0601", name: "Bright White", hex: "#F4F5F0" },
  { code: "19-4007", name: "Anthracite", hex: "#28282D" },
  { code: "14-4102", name: "Glacier Gray", hex: "#C5C6C7" },
  { code: "19-1664", name: "True Red", hex: "#BF1932" },
  { code: "15-1247", name: "Tangerine", hex: "#F88F58" },
  { code: "12-0752", name: "Buttercup", hex: "#F3E5AB" },
  { code: "19-4150", name: "Princess Blue", hex: "#00539C" },
  
  // Extended palette - Popular print colors
  { code: "17-1456", name: "Tigerlily", hex: "#E2583E" },
  { code: "19-3952", name: "Royal Blue", hex: "#4169E1" },
  { code: "15-1164", name: "Saffron", hex: "#FFA62F" },
  { code: "14-4318", name: "Sky Blue", hex: "#89CFF0" },
  { code: "18-1662", name: "Fiesta", hex: "#DD4132" },
  { code: "15-6340", name: "Mint", hex: "#6BFFB8" },
  { code: "19-3832", name: "Violet", hex: "#7F00FF" },
  { code: "16-5938", name: "Jade", hex: "#00A86B" },
  { code: "14-1231", name: "Peach", hex: "#FFCBA4" },
  { code: "19-4029", name: "Navy", hex: "#000080" },
  { code: "11-4302", name: "Blanc de Blanc", hex: "#F0EFE7" },
  { code: "18-0135", name: "Kale", hex: "#5A7247" },
  { code: "16-1548", name: "Coral", hex: "#FF7F50" },
  { code: "19-3950", name: "Liberty", hex: "#545AA7" },
  { code: "15-1334", name: "Shell Coral", hex: "#D2917B" },
  { code: "17-1502", name: "Storm Gray", hex: "#717374" },
  { code: "13-4200", name: "Glacier", hex: "#F0F8FF" },
  { code: "18-1658", name: "Bossa Nova", hex: "#973E52" },
  { code: "16-1632", name: "Lantana", hex: "#DA70D6" },
  { code: "17-4041", name: "Marina", hex: "#4169E1" },
];

// --- Color Conversion Utilities ---

export const hexToRgb = (hex: string): RGB => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
};

export const rgbToHsl = (r: number, g: number, b: number): HSL => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: h * 360, s, l };
};

export const calculateLRV = (rgb: RGB): number => {
  // Approximate LRV (Light Reflectance Value)
  return Math.round(((0.299 * rgb.r) + (0.587 * rgb.g) + (0.114 * rgb.b)) / 255 * 100);
};

export const calculateCMYK = (rgb: RGB): { c: number; m: number; y: number; k: number } => {
  let c = 0, m = 0, y = 0, k = 0;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  k = Math.min(1 - r, 1 - g, 1 - b);
  if (k !== 1) {
    c = (1 - r - k) / (1 - k);
    m = (1 - g - k) / (1 - k);
    y = (1 - b - k) / (1 - k);
  }

  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100)
  };
};

// Calculate Euclidean distance between two RGB colors
export const getColorDistance = (c1: RGB, c2: RGB): number => {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
};

// Find nearest Pantone color for a given RGB value
export const findNearestPantone = (rgb: RGB): PantoneMatch => {
  let minDist = Infinity;
  let nearest = PANTONE_COLORS[0];
  
  for (const p of PANTONE_COLORS) {
    const pRgb = hexToRgb(p.hex);
    const dist = getColorDistance(rgb, pRgb);
    if (dist < minDist) {
      minDist = dist;
      nearest = p;
    }
  }
  
  return { ...nearest, distance: minDist };
};

// --- Image Analysis Types ---

export interface ExtractedColor {
  rgb: RGB;
  hsl: HSL;
  hex: string;
  pantone: PantoneMatch;
  x: number; // normalized x position (0-1)
  y: number; // normalized y position (0-1)
}

export interface PaletteAnalysis {
  colors: ExtractedColor[];
  avgLightness: number;
  avgChroma: number;
  colorfulnessBias: number;
  lightDarkBias: number;
  sparseColor: boolean;
  src: string;
}

// --- Image Analysis Function ---

export const analyzeImageForPalette = (
  imageElement: HTMLImageElement, 
  sampleCount: number = 100
): Promise<PaletteAnalysis> => {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      const width = imageElement.naturalWidth;
      const height = imageElement.naturalHeight;
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(imageElement, 0, 0, width, height);

      const colors: ExtractedColor[] = [];
      const data = ctx.getImageData(0, 0, width, height).data;
      
      let attempts = 0;
      const maxAttempts = sampleCount * 10; // Prevent infinite loop for mostly transparent images
      
      while (colors.length < sampleCount && attempts < maxAttempts) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        const index = (y * width + x) * 4;
        
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        
        attempts++;
        
        // Skip transparent pixels
        if (a < 128) continue;

        const hsl = rgbToHsl(r, g, b);
        const rgb = { r, g, b };
        colors.push({
          rgb,
          hsl,
          hex: rgbToHex(r, g, b),
          pantone: findNearestPantone(rgb),
          x: x / width,
          y: y / height
        });
      }

      const avgLightness = colors.reduce((acc, c) => acc + c.hsl.l, 0) / colors.length;
      const avgChroma = colors.reduce((acc, c) => acc + c.hsl.s, 0) / colors.length;
      
      const varianceS = colors.reduce((acc, c) => acc + Math.pow(c.hsl.s - avgChroma, 2), 0) / colors.length;
      const colorfulnessBias = Math.sqrt(varianceS);

      const varianceL = colors.reduce((acc, c) => acc + Math.pow(c.hsl.l - avgLightness, 2), 0) / colors.length;
      const lightDarkBias = Math.sqrt(varianceL);

      const uniqueColors = new Set(colors.map(c => c.hex)).size;
      const sparseColor = (uniqueColors / sampleCount) < 0.2;

      resolve({
        colors,
        avgLightness,
        avgChroma,
        colorfulnessBias,
        lightDarkBias,
        sparseColor,
        src: imageElement.src
      });

    } catch (e) {
      reject(e);
    }
  });
};

// Get unique Pantone colors from analysis (deduplicated by code)
export const getUniquePantoneColors = (colors: ExtractedColor[], maxColors: number = 10): ExtractedColor[] => {
  const seen = new Set<string>();
  const unique: ExtractedColor[] = [];
  
  // Sort by saturation (most saturated first) for more vibrant palette
  const sorted = [...colors].sort((a, b) => b.hsl.s - a.hsl.s);
  
  for (const color of sorted) {
    if (!seen.has(color.pantone.code)) {
      seen.add(color.pantone.code);
      unique.push(color);
      if (unique.length >= maxColors) break;
    }
  }
  
  return unique;
};
