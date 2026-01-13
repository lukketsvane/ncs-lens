import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { 
  Camera, 
  Image as ImageIcon, 
  RotateCcw, 
  Sparkles, 
  Loader2, 
  ArrowRight, 
  History as HistoryIcon, 
  ChevronLeft, 
  Share2, 
  Copy, 
  Layers, 
  Eye, 
  EyeOff,
  Plus, 
  Trash2, 
  X, 
  Hammer, 
  RefreshCw,
  Globe,
  Lock,
  CheckCircle2,
  Search,
  Palette,
  Droplet,
  ArrowRightLeft,
  XCircle,
  User,
  Pencil,
  Check,
  Heart,
  Grid3X3,
  LayoutGrid,
  TrendingUp,
  Clock,
  Flame,
  ChevronDown,
  Zap
} from "lucide-react";
import { AuthProvider, useAuth } from "./components/AuthContext";
import { AuthPage } from "./components/AuthPage";
import { ProfilePage } from "./components/ProfilePage";
import { VilkaarPage } from "./components/VilkaarPage";
import { PaletteExtractorPage } from "./components/PaletteExtractorPage";
import { getUserScans, getPublicScans, createScan, updateScan, deleteScan, publishScan, unpublishScan, likeScan, unlikeScan, getLikesInfo, ScanRecord } from "./lib/scans";
import { uploadImage, deleteImage } from "./lib/storage";
import { HueRing, TrianglePicker, NCSColor, degreesToNcsHue, ncsToCss } from "./ncs-wheel";
import { 
  snapToNcsStandard, 
  findNearestNcsColor, 
  getMatchConfidence,
  rgbToLab as ncsRgbToLab,
  deltaE2000,
  hexToRgb as ncsHexToRgb
} from "./lib/ncs-colors";
import { useSwipeGesture } from "./lib/useSwipeGesture";
import { getSavedColors, saveColor, unsaveColor, isColorSaved, SavedColor } from "./lib/saved-colors";

// --- URL Routing Helpers ---

// Convert color code to URL-safe format
const colorCodeToUrl = (system: string, code: string): string => {
  // NCS S 1050-Y90R -> ncs/s-1050-y90r
  // RAL 9010 -> ral/9010
  const sanitizedCode = code.toLowerCase().replace(/\s+/g, '-');
  return `/color/${system.toLowerCase()}/${sanitizedCode}`;
};

// Parse URL to get color info
const parseColorUrl = (path: string): { system: string; code: string } | null => {
  const match = path.match(/^\/color\/(ncs|ral)\/(.+)$/i);
  if (!match) return null;
  
  const system = match[1].toUpperCase();
  // Convert URL-safe format back to standard NCS notation:
  // URL format: s-1050-y90r (lowercase, hyphens for spaces)
  // NCS format: S 1050-Y90R (uppercase, space after S, hyphen before hue)
  // Steps: 1) Uppercase all, 2) Replace hyphens with spaces, 3) Fix "S " prefix spacing
  let code = match[2].toUpperCase();
  if (system === 'NCS') {
    code = code.replace(/-/g, ' ').replace(/^S\s+/, 'S ');
  }
  return { system, code };
};

// Update browser URL without page reload
const updateUrl = (path: string) => {
  window.history.pushState({}, '', path);
};

// --- Constants ---
const EDGE_CONFIG_STORE_ID = "ecfg_xlrdrn2ms13tkf3hezgonww7tpbk"; // Prepared for backend integration
const MAX_SIMILAR_COLOR_DISTANCE = 30; // Delta E threshold for "similar" colors
const DEFAULT_COLOR_HEX = '#888888'; // Default hex for colors loaded from URL before enrichment

// --- Types ---

interface ColorMatch {
  system: "RAL" | "NCS";
  code: string;
  name: string;
  hex: string;
  location: string;
  confidence: string;
  materialGuess: string;
  finishGuess: string;
  laymanDescription: string;
  // Technical Details
  lrv?: string;
  cmyk?: string;
  rgb?: string;
  blackness?: string;
  chromaticness?: string;
  hue?: string;
}

interface Material {
  name: string;
  texture: string;
  finish: string;
}

interface AnalysisResult {
  productType: string;
  materials: Material[];
  colors: ColorMatch[];
}

interface HistoryItem {
  id: string;
  timestamp: number;
  image: string;
  result: AnalysisResult;
  author?: string; // New: For community items
  isPublic?: boolean; // For tracking visibility
  likeCount?: number; // Number of likes
  isLiked?: boolean; // Whether current user has liked this
}

type Tab = 'scan' | 'palette' | 'history' | 'community' | 'profile';

// Sort options for community view
type SortOption = 'trending' | 'newest' | 'most_liked';

// --- API Helper ---

const analyzeImage = async (base64Image: string, salient: boolean = false): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Choose model and config based on salient mode
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
            // Enhanced Technical Fields
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

  // Build prompt text - mention web search only if enabled
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
      temperature: 0.1, // Very low temperature for maximum precision and deterministic results
      ...(useWebSearch && { tools: [{ googleSearch: {} }] }), // Enable Google Search only in salient mode
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response");
  
  const result = JSON.parse(text) as AnalysisResult;
  
  // Snap AI-generated NCS colors to valid NCS standards
  result.colors = snapColorsToNcsStandards(result.colors);
  
  return result;
};

// --- Helper Functions ---

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Calculate color distance using CIE2000 Delta E formula (perceptually uniform)
// Lower values mean more similar colors
const calculateColorDistance = (hex1: string, hex2: string): number => {
  const rgb1 = ncsHexToRgb(hex1);
  const rgb2 = ncsHexToRgb(hex2);
  
  if (!rgb1 || !rgb2) return Infinity;
  
  const lab1 = ncsRgbToLab(rgb1.r, rgb1.g, rgb1.b);
  const lab2 = ncsRgbToLab(rgb2.r, rgb2.g, rgb2.b);
  
  return deltaE2000(lab1, lab2);
};

/**
 * Snap AI-generated NCS colors to valid NCS standards
 * This ensures the AI output matches actual NCS color codes
 */
const snapColorsToNcsStandards = (colors: ColorMatch[]): ColorMatch[] => {
  return colors.map(color => {
    // Only process NCS colors
    if (color.system !== 'NCS') return color;
    
    // Try to snap to a valid NCS standard
    const snapped = snapToNcsStandard(color.code);
    
    if (snapped && snapped.distance > 0) {
      // The AI-generated code was not an exact match, update with the correct standard
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
      // Exact match - enrich with database data
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
      // Could not find a match - try finding by hex color
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
};

const getContrastColor = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? 'text-black' : 'text-white';
};

const parseNCSStr = (code: string) => {
  // Try to parse NCS string if API didn't return perfect parts, or for display formatting
  const match = code.match(/S?\s*(\d{2})(\d{2})-(.*)/i);
  if (match) {
    return {
      blackness: match[1],
      chroma: match[2],
      hue: match[3]
    };
  }
  return null;
};

// Convert NCS hue string to degrees (0-360)
const ncsHueToDegrees = (hueStr: string): number => {
  if (!hueStr) return 0;
  const h = hueStr.toUpperCase().trim();
  
  // Handle pure hues (N for neutral returns 0)
  if (h === 'Y') return 0;
  if (h === 'R') return 90;
  if (h === 'B') return 180;
  if (h === 'G') return 270;
  if (h === 'N') return 0; // Neutral
  
  // Parse compound hues like Y20R, R80B, etc.
  const match = h.match(/([YRBG])(\d+)([YRBG])/);
  if (match) {
    const from = match[1];
    const percent = parseInt(match[2], 10);
    const to = match[3];
    
    const baseAngles: Record<string, number> = { Y: 0, R: 90, B: 180, G: 270 };
    const base = baseAngles[from] ?? 0;
    
    // Calculate direction based on color sequence Y -> R -> B -> G -> Y
    return (base + (percent / 100) * 90) % 360;
  }
  
  return 0;
};

// Convert hex color to approximate NCS values
const hexToNcsApprox = (hex: string): NCSColor => {
  // Validate hex format
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return { hue: 0, blackness: 30, chromaticness: 40 }; // Default fallback
  }
  
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  
  let h = 0;
  let s = 0;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  
  // Convert CSS hue (0-360) to NCS hue (0-360).
  // CSS HSL uses: 0=Red, 60=Yellow, 120=Green, 180=Cyan, 240=Blue, 300=Magenta
  // NCS uses: 0=Yellow, 90=Red, 180=Blue, 270=Green
  // The mapping transforms between these coordinate systems:
  // - CSS 0-60 (Red to Yellow) maps to NCS 90-0 (Red to Yellow)
  // - CSS 60-120 (Yellow to Green) maps to NCS 360-270 (Yellow to Green via full circle)
  // - CSS 120-240 (Green to Blue) maps to NCS 270-180 (Green to Blue)
  // - CSS 240-360 (Blue to Red) maps to NCS 180-90 (Blue to Red)
  let ncsHue = 0;
  if (h <= 60) {
    ncsHue = (60 - h) / 60 * 90;
  } else if (h <= 120) {
    ncsHue = 270 + (120 - h) / 60 * 90;
  } else if (h <= 240) {
    ncsHue = 180 - (h - 120) / 120 * 90;
  } else {
    ncsHue = 180 + (360 - h) / 120 * 90;
  }
  
  const blackness = Math.round((1 - l) * 100);
  const chromaticness = Math.round(s * 100);
  
  return {
    hue: Math.round(ncsHue) % 360,
    blackness: Math.min(100, Math.max(0, blackness)),
    chromaticness: Math.min(100, Math.max(0, chromaticness))
  };
};

// Convert NCS color to hex string
const ncsToHex = (color: NCSColor): string => {
  const hslStr = ncsToCss(color);
  // Parse HSL string: hsl(h, s%, l%)
  const match = hslStr.match(/hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
  if (!match) return '#888888';
  
  const h = parseFloat(match[1]) / 360;
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;
  
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
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
  
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// --- Components ---

// 1. Color Detail Overlay
const CURATED_COMPARISONS: ColorMatch[] = [
  { system: "NCS", code: "S 0300-N", name: "Pure White", hex: "#FFFFFF", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "100", cmyk: "0,0,0,0", rgb: "255,255,255" },
  { system: "NCS", code: "S 0502-Y", name: "Standard White", hex: "#F2F0EB", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "85", cmyk: "0,0,5,0", rgb: "242,240,235" },
  { system: "NCS", code: "S 4500-N", name: "Middle Grey", hex: "#8B8B8B", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "30", cmyk: "0,0,0,45", rgb: "139,139,139" },
  { system: "NCS", code: "S 9000-N", name: "Black", hex: "#212121", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "5", cmyk: "0,0,0,90", rgb: "33,33,33" },
];

interface SimilarColorResult {
  color: ColorMatch;
  distance: number;
  productType: string;
  source: 'history' | 'community';
}

const ColorDetailView = ({ 
  color, 
  history, 
  communityItems, 
  onBack,
  onSaveColor,
  onUnsaveColor,
  isSaved,
  onSelectColor
}: { 
  color: ColorMatch, 
  history: HistoryItem[], 
  communityItems: HistoryItem[], 
  onBack: () => void,
  onSaveColor?: (color: ColorMatch) => void,
  onUnsaveColor?: (color: ColorMatch) => void,
  isSaved?: boolean,
  onSelectColor?: (color: ColorMatch) => void
}) => {
  const isNCS = color.system === 'NCS';
  
  const [activeTab, setActiveTab] = useState<'details' | 'combinations' | 'compare' | 'wheel'>('details');
  const [compareColor, setCompareColor] = useState<ColorMatch | null>(null);
  const [showSimilarColors, setShowSimilarColors] = useState(false);
  const [colorSaved, setColorSaved] = useState(isSaved ?? false);
  
  // Swipe gesture for back navigation
  const swipeHandlers = useSwipeGesture({
    onSwipeRight: onBack,
    threshold: 50,
    edgeThreshold: 40,
  });
  
  // Update URL when viewing color
  useEffect(() => {
    const colorUrl = colorCodeToUrl(color.system, color.code);
    updateUrl(colorUrl);
    
    // Restore URL on unmount
    return () => {
      updateUrl('/');
    };
  }, [color.system, color.code]);
  
  // Sync saved state with prop
  useEffect(() => {
    setColorSaved(isSaved ?? false);
  }, [isSaved]);
  
  // Wheel state for interactive color exploration (allows adjusting the wheel to explore variations)
  const [wheelColor, setWheelColor] = useState<NCSColor>(() => {
    // Initialize from the current color
    const parsed = parseNCSStr(color.code);
    if (parsed && isNCS) {
      const hueValue = ncsHueToDegrees(parsed.hue);
      const blacknessValue = parseInt(parsed.blackness, 10) || 30;
      const chromaticnessValue = parseInt(parsed.chroma, 10) || 40;
      return { hue: hueValue, blackness: blacknessValue, chromaticness: chromaticnessValue };
    }
    return hexToNcsApprox(color.hex);
  });
  
  // When on the wheel tab, show the wheel color in the top display
  // Otherwise, show the original color (prevents color changing when navigating tabs)
  const isWheelTabActive = activeTab === 'wheel';
  const displayHex = isWheelTabActive ? ncsToHex(wheelColor) : color.hex;
  const displayHexForContrast = displayHex;
  const contrastText = getContrastColor(displayHexForContrast);
  
  // Helper to format NCS numeric values with 2-digit padding
  const formatNcsValue = (value: number): string => String(Math.round(value)).padStart(2, '0');
  
  // Use wheel color values when on wheel tab, otherwise use API data or regex parsing
  const blackness = isWheelTabActive 
    ? formatNcsValue(wheelColor.blackness)
    : (color.blackness || parseNCSStr(color.code)?.blackness || "--");
  const chroma = isWheelTabActive 
    ? formatNcsValue(wheelColor.chromaticness)
    : (color.chromaticness || parseNCSStr(color.code)?.chroma || "--");
  const hue = isWheelTabActive 
    ? degreesToNcsHue(wheelColor.hue)
    : (color.hue || parseNCSStr(color.code)?.hue || "");
  
  // Calculate similar colors from history and community
  const similarColors = React.useMemo(() => {
    const results: SimilarColorResult[] = [];
    const seen = new Set<string>();
    
    // Helper to process items
    const processItems = (items: HistoryItem[], source: 'history' | 'community') => {
      items.forEach(item => {
        item.result.colors.forEach(c => {
          if (c.code !== color.code && !seen.has(c.code)) {
            const distance = calculateColorDistance(color.hex, c.hex);
            if (distance <= MAX_SIMILAR_COLOR_DISTANCE) {
              results.push({
                color: c,
                distance,
                productType: item.result.productType,
                source
              });
              seen.add(c.code);
            }
          }
        });
      });
    };
    
    processItems(history, 'history');
    processItems(communityItems, 'community');
    
    // Sort by distance (most similar first)
    return results.sort((a, b) => a.distance - b.distance);
  }, [history, communityItems, color]);

  // Derive available colors for comparison
  const comparisonList = React.useMemo(() => {
    const list: ColorMatch[] = [];
    const seen = new Set<string>();
    
    // Add history colors
    history.forEach(item => {
      item.result.colors.forEach(c => {
        if (c.code !== color.code && !seen.has(c.code)) {
          list.push(c);
          seen.add(c.code);
        }
      });
    });
    return list;
  }, [history, color]);

  return (
    <div 
      className="fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
      {...swipeHandlers}
    >
      
      {/* 1. Top Section - Visual Navigator (Matches Screenshot) */}
      <div 
        className={`relative pt-safe-top pb-8 px-6 transition-all duration-500 shadow-sm z-10 flex flex-col`}
        style={{ 
          backgroundColor: displayHex,
          height: activeTab === 'compare' && compareColor ? '50%' : 'auto',
          minHeight: activeTab === 'compare' && compareColor ? '0' : '35%'
        }}
      >
        {/* Navigation */}
        <div className="flex justify-between items-center mb-6">
           <button 
            onClick={onBack}
            className={`flex items-center gap-1 text-sm font-medium ${contrastText} opacity-80 hover:opacity-100`}
          >
            <ChevronLeft size={20} />
            Back
          </button>
          <div className={`text-sm font-bold ${contrastText} opacity-90`}>
            {color.name}
          </div>
          <div className="flex items-center gap-2">
            {/* Save/Bookmark Button */}
            {onSaveColor && onUnsaveColor && (
              <button 
                onClick={() => {
                  if (colorSaved) {
                    onUnsaveColor(color);
                    setColorSaved(false);
                  } else {
                    onSaveColor(color);
                    setColorSaved(true);
                  }
                }}
                className={`${contrastText} opacity-80 hover:opacity-100 transition-all`}
              >
                <Heart 
                  size={20} 
                  fill={colorSaved ? 'currentColor' : 'none'}
                  className={colorSaved ? 'text-red-500' : ''}
                />
              </button>
            )}
            <button className={`${contrastText} opacity-80 hover:opacity-100`}>
              <Share2 size={20} />
            </button>
          </div>
        </div>

        {/* NCS Data Display */}
        <div className={`flex flex-col items-center justify-center flex-1 ${contrastText}`}>
          {isNCS ? (
            <div className="w-full max-w-sm">
              {/* Labels - Hide in small split mode */}
              {(!compareColor || activeTab !== 'compare') && (
                <div className="flex justify-between text-[10px] font-bold tracking-widest uppercase opacity-60 mb-2 px-6">
                  <span className="w-14 text-center">Blackness</span>
                  <span className="w-14 text-center">Chroma</span>
                  <span className="w-20 text-center">Hue</span>
                </div>
              )}
              
              {/* Values - Smaller font sizes to prevent truncation */}
              <div className="flex justify-between items-baseline px-2">
                 <div className="text-5xl sm:text-6xl font-light tracking-tighter flex items-baseline">
                   <span className="text-3xl mr-1 opacity-60">S</span>
                   {blackness}
                 </div>
                 <div className="text-5xl sm:text-6xl font-light tracking-tighter">
                   {chroma}
                 </div>
                 <div className="text-3xl font-light opacity-60">-</div>
                 <div className="text-4xl sm:text-5xl font-light tracking-tight w-24 text-center">
                   {hue}
                 </div>
              </div>
            </div>
          ) : (
             <div className="text-center py-4">
               <h1 className="text-5xl font-bold tracking-tight mb-2">{color.code}</h1>
               <p className="text-lg opacity-80">{color.system} Standard</p>
             </div>
          )}
        </div>
      </div>

      {/* 2. Tabs (Hide if comparing to give full screen effect? No, keep to switch back) */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="flex">
          <button 
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-colors ${activeTab === 'details' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
          >
            Details
          </button>
          <button 
            onClick={() => setActiveTab('combinations')}
            className={`flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-colors ${activeTab === 'combinations' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
          >
            Context
          </button>
          <button 
            onClick={() => setActiveTab('compare')}
            className={`flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-colors ${activeTab === 'compare' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
          >
            Compare
          </button>
          <button 
            onClick={() => setActiveTab('wheel')}
            className={`flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-colors ${activeTab === 'wheel' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
          >
            Fine Tune
          </button>
        </div>
      </div>

      {/* 3. Content List */}
      <div className="flex-1 overflow-y-auto no-scrollbar bg-white safe-area-bottom relative">
        {activeTab === 'details' && (
          <div className="divide-y divide-gray-100 animate-in fade-in">
            <div className="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
               <span className="text-gray-500 text-sm">Name</span>
               <span className="text-gray-900 font-semibold font-mono">{color.code}</span>
            </div>
            {/* ... other details ... */}
            <div className="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
               <span className="text-gray-500 text-sm">Collection</span>
               <span className="text-gray-900 font-medium">{color.system} 2050</span>
            </div>
             {/* Technical Data Section */}
             <div className="bg-gray-50/50 px-6 py-2 mt-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
               Technical Data
             </div>

            <div className="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
               <span className="text-gray-500 text-sm">LRV (D65)</span>
               <span className="text-gray-900 font-mono font-medium">{color.lrv || "N/A"}</span>
            </div>

            <div className="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
               <span className="text-gray-500 text-sm">CMYK Coated</span>
               <span className="text-gray-900 font-mono font-medium">{color.cmyk || "N/A"}</span>
            </div>

            <div className="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
               <span className="text-gray-500 text-sm">RGB Value</span>
               <span className="text-gray-900 font-mono font-medium">{color.rgb || "N/A"}</span>
            </div>
          </div>
        )}

        {activeTab === 'combinations' && (
           <div className="p-6 space-y-8 animate-in fade-in">
              <div className="space-y-4">
                 <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Material Identification</h3>
                 <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex items-start gap-4">
                    <div className="bg-white p-3 rounded-full shadow-sm">
                      <Hammer className="text-gray-700" size={24} />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-lg">{color.materialGuess}</div>
                      <div className="text-gray-500 text-sm mt-1">{color.finishGuess}</div>
                      <p className="text-gray-600 text-sm mt-3 leading-relaxed">
                        {color.laymanDescription}
                      </p>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'compare' && (
          <div className="h-full flex flex-col animate-in fade-in">
             {compareColor ? (
               // Split View Mode
               <div 
                 className="flex-1 w-full relative transition-colors duration-500 flex flex-col items-center justify-center"
                 style={{ backgroundColor: compareColor.hex }}
               >
                 <button 
                    onClick={() => setCompareColor(null)}
                    className="absolute top-4 right-4 p-2 bg-black/20 text-white rounded-full hover:bg-black/40 backdrop-blur-md"
                  >
                   <XCircle size={24} />
                 </button>
                 
                 <div className={`text-center ${getContrastColor(compareColor.hex)}`}>
                    <h2 className="text-5xl font-light tracking-tighter mb-2">{compareColor.code.split(" ").pop()}</h2>
                    <p className="text-sm font-medium opacity-70 uppercase tracking-widest">{compareColor.name}</p>
                 </div>
                 
                 {/* Floating VS Badge */}
                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white text-black font-bold text-xs px-3 py-1 rounded-full shadow-lg border border-gray-100 z-30">
                   VS
                 </div>
               </div>
             ) : (
               // Selection Mode
               <div className="p-6 space-y-8">
                 <div>
                   <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Standard References</h3>
                   <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                     {CURATED_COMPARISONS.map((c, i) => (
                       <button 
                         key={i}
                         onClick={() => setCompareColor(c)}
                         className="flex-shrink-0 flex flex-col items-center gap-2 group"
                       >
                         <div className="w-16 h-16 rounded-full border border-gray-200 shadow-sm group-hover:scale-105 transition-transform" style={{ backgroundColor: c.hex }} />
                         <span className="text-xs font-medium text-gray-600 max-w-[80px] truncate">{c.name}</span>
                       </button>
                     ))}
                   </div>
                 </div>

                 <div>
                   <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Recent Scans</h3>
                   {comparisonList.length === 0 ? (
                     <p className="text-gray-400 text-sm italic">No other scans to compare with.</p>
                   ) : (
                     <div className="grid grid-cols-4 gap-4">
                       {comparisonList.map((c, i) => (
                         <button 
                           key={i}
                           onClick={() => setCompareColor(c)}
                           className="flex flex-col items-center gap-2 group"
                         >
                           <div className="w-full aspect-square rounded-2xl border border-gray-200 shadow-sm group-hover:scale-105 transition-transform" style={{ backgroundColor: c.hex }} />
                           <span className="text-[10px] font-medium text-gray-600 w-full truncate text-center">{c.code.split(" ").pop()}</span>
                         </button>
                       ))}
                     </div>
                   )}
                 </div>
               </div>
             )}
          </div>
        )}

        {activeTab === 'wheel' && (
          <div className="h-full flex flex-col animate-in fade-in bg-[#f2f2f2]">
            {/* NCS Wheel */}
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto relative p-4">
              <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
                <HueRing 
                  hue={wheelColor.hue} 
                  onChange={(newHue) => setWheelColor(prev => ({ ...prev, hue: newHue }))} 
                  size={280} 
                />
                <TrianglePicker 
                  color={wheelColor} 
                  onChange={(s, c) => setWheelColor(prev => ({ ...prev, blackness: s, chromaticness: c }))} 
                  size={220} 
                />
              </div>
            </div>

            {/* Reset button */}
            <div className="p-4 bg-white border-t border-gray-100">
              <button
                onClick={() => {
                  // Reset to original color
                  const parsed = parseNCSStr(color.code);
                  if (parsed && isNCS) {
                    const hueValue = ncsHueToDegrees(parsed.hue);
                    const blacknessValue = parseInt(parsed.blackness, 10) || 30;
                    const chromaticnessValue = parseInt(parsed.chroma, 10) || 40;
                    setWheelColor({ hue: hueValue, blackness: blacknessValue, chromaticness: chromaticnessValue });
                  } else {
                    setWheelColor(hexToNcsApprox(color.hex));
                  }
                }}
                className="w-full py-3 px-4 bg-gray-100 text-gray-700 font-semibold rounded-2xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                Reset to Original
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions - Hide in compare mode (with selected color), wheel mode, and similar colors overlay */}
      {(() => {
        const isCompareWithSelection = activeTab === 'compare' && compareColor;
        const isWheelTab = activeTab === 'wheel';
        const showBottomActions = !isCompareWithSelection && !isWheelTab && !showSimilarColors;
        
        return showBottomActions && (
          <div className="p-4 border-t border-gray-100 bg-white safe-area-bottom">
            <button 
              onClick={() => setShowSimilarColors(true)}
              className="w-full bg-gray-900 text-white font-semibold py-4 rounded-xl shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2"
            >
              <Palette size={18} />
              <span>Find Similar Colors ({similarColors.length})</span>
            </button>
          </div>
        );
      })()}

      {/* Similar Colors Overlay */}
      {showSimilarColors && (
        <div className="absolute inset-0 bg-white z-30 flex flex-col animate-in slide-in-from-bottom duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <button 
              onClick={() => setShowSimilarColors(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="font-semibold text-gray-900">Similar Colors</h2>
            <div className="w-10" />
          </div>

          {/* Reference Color */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-xl shadow-sm border border-gray-200" 
                style={{ backgroundColor: color.hex }} 
              />
              <div>
                <p className="font-semibold text-gray-900">{color.code}</p>
                <p className="text-sm text-gray-500">{color.name}</p>
              </div>
            </div>
          </div>

          {/* Similar Colors List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {similarColors.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Palette size={48} className="mb-4 opacity-20" />
                <p>No similar colors found</p>
                <p className="text-sm mt-1">Try scanning more items!</p>
              </div>
            ) : (
              similarColors.map((item, i) => (
                <div 
                  key={i}
                  onClick={() => onSelectColor?.(item.color)}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors cursor-pointer active:scale-[0.98]"
                >
                  <div 
                    className="w-14 h-14 rounded-xl shadow-sm border border-gray-200 flex-shrink-0" 
                    style={{ backgroundColor: item.color.hex }} 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{item.color.code}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        item.source === 'history' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {item.source === 'history' ? 'Your Scans' : 'Community'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{item.color.name}</p>
                    <p className="text-xs text-gray-400 mt-1">From: {item.productType}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Match</p>
                    <p className="font-semibold text-gray-900">
                      {Math.round(100 - (item.distance / MAX_SIMILAR_COLOR_DISTANCE) * 100)}%
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// 2. Result View (Overlay)
const ResultView = ({ 
  item, 
  onBack, 
  onColorSelect, 
  onRegenerate,
  onPublish,
  onUnpublish,
  onUpdate,
  isOwner
}: { 
  item: HistoryItem, 
  onBack: () => void, 
  onColorSelect: (c: ColorMatch) => void,
  onRegenerate?: () => void,
  onPublish?: () => void,
  onUnpublish?: () => void,
  onUpdate?: (updates: Partial<AnalysisResult>) => void,
  isOwner?: boolean
}) => {
  const { image, result } = item;
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [isPublic, setIsPublic] = useState(item.isPublic ?? false);
  
  // Edit state
  const [editingProductType, setEditingProductType] = useState(false);
  const [editedProductType, setEditedProductType] = useState(result.productType);

  // Swipe gesture for back navigation
  const swipeHandlers = useSwipeGesture({
    onSwipeRight: onBack,
    threshold: 50,
    edgeThreshold: 40,
  });

  const handlePublish = async () => {
    if (isPublic || !onPublish) return;
    setIsPublishing(true);
    await onPublish();
    setIsPublic(true);
    setIsPublishing(false);
  };

  const handleUnpublish = async () => {
    if (!isPublic || !onUnpublish) return;
    setIsUnpublishing(true);
    await onUnpublish();
    setIsPublic(false);
    setIsUnpublishing(false);
  };

  const handleSaveProductType = () => {
    if (onUpdate && editedProductType !== result.productType) {
      onUpdate({ productType: editedProductType });
    }
    setEditingProductType(false);
  };

  return (
    <div 
      className="fixed inset-0 bg-[#F0F2F5] z-40 overflow-y-auto no-scrollbar safe-area-top safe-area-bottom"
      {...swipeHandlers}
    >
      <div className="p-4 min-h-full pb-20">
        <div className="flex justify-between items-center mb-6">
          <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100">
             <ChevronLeft size={20} />
          </button>
          
          {/* Product Type - Editable if owner */}
          <div className="flex items-center gap-1 max-w-[200px]">
            {editingProductType ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editedProductType}
                  onChange={(e) => setEditedProductType(e.target.value)}
                  className="font-semibold text-center bg-white px-2 py-1 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/10 max-w-[160px]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveProductType();
                    if (e.key === 'Escape') {
                      setEditedProductType(result.productType);
                      setEditingProductType(false);
                    }
                  }}
                />
                <button 
                  onClick={handleSaveProductType}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <Check size={14} className="text-green-600" />
                </button>
              </div>
            ) : (
              <>
                <span className="font-semibold truncate text-center">{result.productType}</span>
                {isOwner && (
                  <button 
                    onClick={() => setEditingProductType(true)}
                    className="p-1 hover:bg-gray-100 rounded-full opacity-40 hover:opacity-100 transition-opacity"
                    title="Edit product name"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </>
            )}
          </div>
          
          {/* Visibility Toggle for owners */}
          {isOwner ? (
            <button 
              onClick={isPublic ? handleUnpublish : handlePublish}
              disabled={isPublishing || isUnpublishing}
              className={`p-2 rounded-full shadow-sm transition-all duration-300 ${isPublic ? 'bg-green-100 text-green-700' : 'bg-white text-gray-500'}`}
              title={isPublic ? 'Public - click to make private' : 'Private - click to publish'}
            >
               {(isPublishing || isUnpublishing) ? (
                 <Loader2 size={20} className="animate-spin" />
               ) : isPublic ? (
                 <Globe size={20} />
               ) : (
                 <Lock size={20} />
               )}
            </button>
          ) : (
            <div className="w-10" /> // Spacer for non-owners
          )}
        </div>

        <div className="max-w-md mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="relative rounded-[32px] overflow-hidden bg-gray-200 aspect-square shadow-sm group">
             <img src={image} className="w-full h-full object-cover" alt="Product" />
             {onRegenerate && (
                <button 
                  onClick={onRegenerate}
                  className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-semibold shadow-sm hover:bg-white transition-colors"
                >
                  <RotateCcw size={14} className="text-gray-600" />
                  <span className="text-gray-800">Re-analyze</span>
                </button>
             )}
             {item.author && (
                <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium text-white">
                  by {item.author}
                </div>
             )}
          </div>

          <div className="bg-white rounded-[24px] p-5 shadow-sm border border-white/50">
             <div className="text-sm text-gray-400 font-medium mb-1">Materials</div>
             <div className="flex flex-wrap gap-2">
               {result.materials.map((m, i) => (
                 <span key={i} className="px-3 py-1.5 bg-gray-100 rounded-full text-xs font-semibold text-gray-600 border border-gray-200">
                   {m.name} <span className="opacity-50 font-normal">· {m.finish}</span>
                 </span>
               ))}
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pb-8">
            {result.colors.map((color, i) => {
              const textColorClass = getContrastColor(color.hex);
              const isFull = i === 0 && result.colors.length % 2 !== 0; 
              
              return (
                <div 
                  key={i} 
                  className={`relative group rounded-[24px] p-5 flex flex-col justify-between h-40 shadow-sm transition-transform ${isFull ? 'col-span-2' : 'col-span-1'}`}
                  style={{ backgroundColor: color.hex }}
                >
                   <div className={`flex justify-between items-start ${textColorClass} opacity-80`}>
                     <span className="text-[10px] font-bold tracking-widest uppercase bg-black/10 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/10">{color.system}</span>
                     
                     <div className="flex items-center gap-2">
                        {onRegenerate && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
                            className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
                          >
                            <RefreshCw size={14} className={textColorClass === 'text-black' ? 'text-black/60' : 'text-white/80'} />
                          </button>
                        )}
                        <ArrowRight 
                           onClick={() => onColorSelect(color)}
                           className="cursor-pointer" 
                           size={16} 
                        />
                     </div>
                   </div>
                   
                   <div 
                     onClick={() => onColorSelect(color)}
                     className={`cursor-pointer ${textColorClass}`}
                   >
                     <div className="text-3xl font-bold tracking-tighter">{color.code.split(" ").pop()}</div>
                     <div className="text-xs font-medium opacity-80 truncate mt-1">{color.name}</div>
                   </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// 3. Grid Views (History & Community)
const GridView = ({ 
  items, 
  title, 
  onSelect,
  onDelete,
  onLike,
  onColorSelect,
  enableSearch = false,
  showLikes = false,
  enableSort = false,
  enableViewToggle = false
}: { 
  items: HistoryItem[], 
  title: string, 
  onSelect: (item: HistoryItem) => void,
  onDelete?: (id: string) => void,
  onLike?: (id: string, isLiked: boolean) => void,
  onColorSelect?: (color: ColorMatch) => void,
  enableSearch?: boolean,
  showLikes?: boolean,
  enableSort?: boolean,
  enableViewToggle?: boolean
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('trending');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [paletteView, setPaletteView] = useState(false); // false = card view with image, true = palette only

  // Filter and sort items
  const filteredAndSortedItems = React.useMemo(() => {
    let result = items;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(item => {
        // Search in product type
        if (item.result.productType.toLowerCase().includes(query)) return true;
        
        // Search in materials
        if (item.result.materials.some(m => 
          m.name.toLowerCase().includes(query) || 
          m.finish.toLowerCase().includes(query)
        )) return true;
        
        // Search in color names and codes
        if (item.result.colors.some(c => 
          c.name.toLowerCase().includes(query) || 
          c.code.toLowerCase().includes(query)
        )) return true;
        
        // Search in author
        if (item.author && item.author.toLowerCase().includes(query)) return true;
        
        return false;
      });
    }
    
    // Apply sorting (only if enableSort is true)
    if (enableSort) {
      const now = Date.now();
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
      
      result = [...result].sort((a, b) => {
        switch (sortBy) {
          case 'trending':
            // Most liked this week - prioritize recent items with high likes
            const aIsRecent = a.timestamp >= oneWeekAgo;
            const bIsRecent = b.timestamp >= oneWeekAgo;
            if (aIsRecent && !bIsRecent) return -1;
            if (!aIsRecent && bIsRecent) return 1;
            // Within same recency, sort by likes
            return (b.likeCount ?? 0) - (a.likeCount ?? 0);
          case 'newest':
            return b.timestamp - a.timestamp;
          case 'most_liked':
            return (b.likeCount ?? 0) - (a.likeCount ?? 0);
          default:
            return 0;
        }
      });
    }
    
    return result;
  }, [items, searchQuery, sortBy, enableSort]);

  const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
    { value: 'trending', label: 'Trending This Week', icon: <Flame size={16} /> },
    { value: 'newest', label: 'Newest First', icon: <Clock size={16} /> },
    { value: 'most_liked', label: 'Most Liked', icon: <TrendingUp size={16} /> },
  ];

  return (
    <div className="min-h-full p-4 pt-8 pb-24 safe-area-top">
       <div className="flex items-center justify-between mb-4 px-1">
         {showSearch ? (
           <div className="flex-1 flex items-center gap-2">
             <div className="flex-1 relative">
               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
               <input
                 type="text"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder="Search products, colors, materials..."
                 className="w-full pl-9 pr-4 py-2.5 bg-white rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 shadow-sm"
                 autoFocus
               />
             </div>
             <button 
               onClick={() => { setShowSearch(false); setSearchQuery(''); }}
               className="p-2 text-gray-500 hover:text-gray-700"
             >
               <X size={20} />
             </button>
           </div>
         ) : (
           <>
             <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
             <div className="flex items-center gap-2">
               {enableViewToggle && (
                 <button 
                   onClick={() => setPaletteView(!paletteView)}
                   className={`p-2 rounded-full shadow-sm transition-colors ${paletteView ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                   title={paletteView ? 'Show cards with images' : 'Show palette only'}
                 >
                   {paletteView ? <LayoutGrid size={20} /> : <Grid3X3 size={20} />}
                 </button>
               )}
               {enableSearch && (
                 <button 
                   onClick={() => setShowSearch(true)}
                   className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 transition-colors"
                 >
                   <Search size={20} className="text-gray-400" />
                 </button>
               )}
             </div>
           </>
         )}
       </div>

       {/* Sort Options */}
       {enableSort && !showSearch && (
         <div className="mb-4 px-1 relative">
           <button
             onClick={() => setShowSortMenu(!showSortMenu)}
             className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
           >
             {sortOptions.find(o => o.value === sortBy)?.icon}
             <span>{sortOptions.find(o => o.value === sortBy)?.label}</span>
             <ChevronDown size={14} className={`transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
           </button>
           
           {showSortMenu && (
             <div className="absolute top-full left-1 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 min-w-[180px]">
               {sortOptions.map((option) => (
                 <button
                   key={option.value}
                   onClick={() => { setSortBy(option.value); setShowSortMenu(false); }}
                   className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                     sortBy === option.value 
                       ? 'bg-gray-100 text-gray-900' 
                       : 'text-gray-600 hover:bg-gray-50'
                   }`}
                 >
                   {option.icon}
                   <span>{option.label}</span>
                 </button>
               ))}
             </div>
           )}
         </div>
       )}

       {filteredAndSortedItems.length === 0 ? (
         <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400">
           {searchQuery ? (
             <>
               <Search size={48} className="mb-4 opacity-20" />
               <p>No results for "{searchQuery}"</p>
             </>
           ) : (
             <>
               {title === 'Discover' ? <Globe size={48} className="mb-4 opacity-20" /> : <Layers size={48} className="mb-4 opacity-20" />}
               <p>{title === 'Discover' ? 'No shared items yet' : 'Collection is empty'}</p>
             </>
           )}
         </div>
       ) : paletteView ? (
         /* Palette-only view - focuses on colors without product image */
         <div className="grid grid-cols-3 gap-3">
           {filteredAndSortedItems.map((item) => (
             <div 
               key={item.id} 
               onClick={() => onSelect(item)} 
               className="bg-white rounded-2xl shadow-sm border border-white overflow-hidden cursor-pointer active:scale-[0.98] transition-all hover:shadow-md"
             >
               {/* Color strips */}
               <div className="flex h-20">
                 {item.result.colors.slice(0, 4).map((c, i) => (
                   <div 
                     key={i} 
                     className={`flex-1 ${onColorSelect ? 'hover:opacity-80 transition-opacity' : ''}`}
                     style={{ backgroundColor: c.hex }}
                     onClick={onColorSelect ? (e) => { e.stopPropagation(); onColorSelect(c); } : undefined}
                   />
                 ))}
               </div>
               {/* Info */}
               <div className="p-2">
                 <p className="text-[10px] font-bold text-gray-900 truncate">{item.result.productType}</p>
                 <div className="flex items-center justify-between mt-1">
                   <p className="text-[9px] text-gray-400">{item.result.colors.length} colors</p>
                   {showLikes && onLike && (
                     <button
                       onClick={(e) => { 
                         e.stopPropagation(); 
                         onLike(item.id, item.isLiked ?? false); 
                       }}
                       className={`flex items-center gap-0.5 text-[10px] transition-colors ${
                         item.isLiked 
                           ? 'text-red-500' 
                           : 'text-gray-400 hover:text-red-400'
                       }`}
                     >
                       <Heart 
                         size={10} 
                         fill={item.isLiked ? 'currentColor' : 'none'}
                       />
                       {(item.likeCount ?? 0) > 0 && (
                         <span>{item.likeCount}</span>
                       )}
                     </button>
                   )}
                 </div>
               </div>
             </div>
           ))}
         </div>
       ) : (
         /* Standard card view with product image */
         <div className="grid grid-cols-2 gap-3">
           {filteredAndSortedItems.map((item) => (
             <div 
                key={item.id} 
                onClick={() => onSelect(item)} 
                className="bg-white p-3 rounded-2xl shadow-sm border border-white flex flex-col gap-3 cursor-pointer active:scale-[0.98] transition-all hover:shadow-md"
             >
               <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                  <img src={item.image} className="w-full h-full object-cover" loading="lazy" />
                  {onDelete && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                      className="absolute top-2 right-2 p-1.5 bg-black/20 backdrop-blur-md rounded-full text-white/80 hover:bg-red-500 hover:text-white transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
               </div>
               <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 text-sm truncate leading-tight">{item.result.productType}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      {item.result.colors.slice(0, 3).map((c, i) => (
                        <div 
                          key={i} 
                          className={`w-3 h-3 rounded-full border border-black/5 ${onColorSelect ? 'cursor-pointer hover:scale-125 transition-transform' : ''}`} 
                          style={{backgroundColor: c.hex}}
                          onClick={onColorSelect ? (e) => { e.stopPropagation(); onColorSelect(c); } : undefined}
                        />
                      ))}
                    </div>
                    {showLikes && onLike && (
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          onLike(item.id, item.isLiked ?? false); 
                        }}
                        className={`flex items-center gap-1 text-xs transition-colors ${
                          item.isLiked 
                            ? 'text-red-500' 
                            : 'text-gray-400 hover:text-red-400'
                        }`}
                      >
                        <Heart 
                          size={14} 
                          fill={item.isLiked ? 'currentColor' : 'none'}
                        />
                        {(item.likeCount ?? 0) > 0 && (
                          <span>{item.likeCount}</span>
                        )}
                      </button>
                    )}
                  </div>
                  {item.author && <p className="text-[10px] text-gray-400 mt-2">by {item.author}</p>}
               </div>
             </div>
           ))}
         </div>
       )}
    </div>
  );
};

const App = () => {
  const { user } = useAuth();
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<Tab>('scan');
  const [historySubTab, setHistorySubTab] = useState<'scans' | 'colors'>('scans');
  
  // Data State - use Supabase for persistence
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [communityItems, setCommunityItems] = useState<HistoryItem[]>([]);
  const [savedColors, setSavedColors] = useState<SavedColor[]>([]);
  const [savedColorKeys, setSavedColorKeys] = useState<Set<string>>(new Set());
  const [dataLoading, setDataLoading] = useState(true);

  // UI State
  const [loading, setLoading] = useState(false);
  const [detailItem, setDetailItem] = useState<HistoryItem | null>(null);
  const [detailColor, setDetailColor] = useState<ColorMatch | null>(null);
  const [salientMode, setSalientMode] = useState(false); // Salient mode: uses gemini-3-pro-preview with web search
  const [showVilkaar, setShowVilkaar] = useState(false); // Show vilkaar (terms) page
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle URL routing for colors and pages on mount
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      
      // Handle /vilkaar route
      if (path === '/vilkaar') {
        setShowVilkaar(true);
        setDetailColor(null);
        return;
      } else {
        setShowVilkaar(false);
      }
      
      const colorInfo = parseColorUrl(path);
      if (colorInfo) {
        // Create a basic ColorMatch from URL - will be enriched when NCS database is available
        const basicColor: ColorMatch = {
          system: colorInfo.system as 'NCS' | 'RAL',
          code: colorInfo.code,
          name: colorInfo.code,
          hex: DEFAULT_COLOR_HEX,
          location: '-',
          confidence: 'High',
          materialGuess: '-',
          finishGuess: '-',
          laymanDescription: '-',
        };
        setDetailColor(basicColor);
      } else {
        setDetailColor(null);
      }
    };

    // Check URL on mount
    handlePopState();

    // Listen for browser back/forward
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load data from Supabase on mount
  useEffect(() => {
    const loadData = async () => {
      setDataLoading(true);
      try {
        // Fetch user's scans only if logged in
        if (user) {
          const userScans = await getUserScans(user.id);
          const historyItems: HistoryItem[] = userScans.map((scan: ScanRecord) => ({
            id: scan.id,
            timestamp: new Date(scan.created_at).getTime(),
            image: scan.image_url,
            result: scan.result,
            isPublic: scan.is_public,
          }));
          setHistory(historyItems);

          // Fetch saved colors
          const colors = await getSavedColors(user.id);
          setSavedColors(colors);
          setSavedColorKeys(new Set(colors.map(c => `${c.color_system}:${c.color_code}`)));
        } else {
          setHistory([]);
          setSavedColors([]);
          setSavedColorKeys(new Set());
        }

        // Fetch public scans for community (available to everyone)
        const publicScans = await getPublicScans();
        const scanIds = publicScans.map(s => s.id);
        
        // Fetch likes info for all community scans
        const likesInfo = await getLikesInfo(scanIds, user?.id);
        
        const communityItems: HistoryItem[] = publicScans.map((scan: ScanRecord) => {
          const likeInfo = likesInfo.get(scan.id) || { count: 0, liked: false };
          return {
            id: scan.id,
            timestamp: new Date(scan.created_at).getTime(),
            image: scan.image_url,
            result: scan.result,
            author: scan.author || 'Anonymous',
            isPublic: true,
            likeCount: likeInfo.count,
            isLiked: likeInfo.liked,
          };
        });
        setCommunityItems(communityItems);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    if (!user) return;
    
    setLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        
        // Analyze the image
        const result = await analyzeImage(base64, salientMode);
        
        // Upload image to Supabase Storage
        const imageUrl = await uploadImage(dataUrl, user.id);
        
        // Save scan to database
        const scan = await createScan(user.id, imageUrl, result);
        
        if (scan) {
          const newItem: HistoryItem = {
            id: scan.id,
            timestamp: new Date(scan.created_at).getTime(),
            image: imageUrl,
            result: result,
            isPublic: false
          };
          setHistory(prev => [newItem, ...prev]);
          setDetailItem(newItem);
        }
        setActiveTab('scan');
      } catch (err) {
        console.error('Analysis failed:', err);
        alert("Analysis failed. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRegenerate = async () => {
    if (!detailItem || !user) return;
    setLoading(true);
    try {
      // For regeneration, we need to fetch the image and re-analyze
      // If the image is a URL, fetch it first
      let base64: string;
      if (detailItem.image.startsWith('data:')) {
        base64 = detailItem.image.split(",")[1];
      } else {
        // Fetch image from URL and convert to base64
        const response = await fetch(detailItem.image);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read image data'));
          reader.readAsDataURL(blob);
        });
        base64 = dataUrl.split(",")[1];
      }
      
      const result = await analyzeImage(base64, salientMode);
      
      // Update in database
      await updateScan(detailItem.id, { result });
      
      const updatedItem = { ...detailItem, result, timestamp: Date.now() };
      setDetailItem(updatedItem);
      setHistory(prev => prev.map(item => item.id === detailItem.id ? updatedItem : item));
    } catch (err) {
      console.error('Regeneration failed:', err);
      alert("Regeneration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!detailItem) return;
    
    // Publish to Supabase
    const success = await publishScan(detailItem.id);
    
    if (success) {
      // Update local state
      const updatedItem = { ...detailItem, isPublic: true };
      setDetailItem(updatedItem);
      setHistory(prev => prev.map(item => item.id === detailItem.id ? updatedItem : item));
      
      // Add to community items locally
      const publishedItem = { ...updatedItem, author: "You" };
      setCommunityItems(prev => [publishedItem, ...prev]);
    }
  };

  const handleUnpublish = async () => {
    if (!detailItem) return;
    
    // Unpublish from Supabase
    const success = await unpublishScan(detailItem.id);
    
    if (success) {
      // Update local state
      const updatedItem = { ...detailItem, isPublic: false };
      setDetailItem(updatedItem);
      setHistory(prev => prev.map(item => item.id === detailItem.id ? updatedItem : item));
      
      // Remove from community items locally
      setCommunityItems(prev => prev.filter(item => item.id !== detailItem.id));
    }
  };

  const handleUpdateResult = async (updates: Partial<AnalysisResult>) => {
    if (!detailItem) return;
    
    // Merge updates with existing result
    const newResult = { ...detailItem.result, ...updates };
    
    // Update in Supabase
    const success = await updateScan(detailItem.id, { result: newResult });
    
    if (success) {
      const updatedItem = { ...detailItem, result: newResult };
      setDetailItem(updatedItem);
      setHistory(prev => prev.map(item => item.id === detailItem.id ? updatedItem : item));
      
      // Also update in community items if it's public
      if (detailItem.isPublic) {
        setCommunityItems(prev => prev.map(item => 
          item.id === detailItem.id ? { ...item, result: newResult } : item
        ));
      }
    }
  };

  const handleDelete = async (id: string) => {
    // Find the item to get image URL for cleanup
    const item = history.find(h => h.id === id);
    
    // Delete from database
    const success = await deleteScan(id);
    
    if (success) {
      // Try to delete the image from storage (best effort)
      if (item && user && !item.image.startsWith('data:')) {
        try {
          await deleteImage(item.image, user.id);
        } catch (err) {
          console.warn('Failed to delete image from storage:', err);
        }
      }
      
      setHistory(h => h.filter(i => i.id !== id));
      
      // Also remove from community items if it was shared (public)
      if (item?.isPublic) {
        setCommunityItems(prev => prev.filter(i => i.id !== id));
      }
    }
  };

  const handleLike = async (scanId: string, isCurrentlyLiked: boolean) => {
    if (!user) {
      setActiveTab('profile');
      return;
    }

    // Optimistic update
    setCommunityItems(prev => prev.map(item => {
      if (item.id === scanId) {
        return {
          ...item,
          isLiked: !isCurrentlyLiked,
          likeCount: (item.likeCount ?? 0) + (isCurrentlyLiked ? -1 : 1)
        };
      }
      return item;
    }));

    // Make API call
    const success = isCurrentlyLiked 
      ? await unlikeScan(scanId, user.id)
      : await likeScan(scanId, user.id);

    // Revert on failure
    if (!success) {
      setCommunityItems(prev => prev.map(item => {
        if (item.id === scanId) {
          return {
            ...item,
            isLiked: isCurrentlyLiked,
            likeCount: (item.likeCount ?? 0) + (isCurrentlyLiked ? 1 : -1)
          };
        }
        return item;
      }));
    }
  };

  // Save color handler
  const handleSaveColor = async (color: ColorMatch) => {
    if (!user) {
      setActiveTab('profile');
      return;
    }

    const colorKey = `${color.system}:${color.code}`;
    
    // Optimistic update
    setSavedColorKeys(prev => new Set([...prev, colorKey]));

    const saved = await saveColor(user.id, {
      system: color.system,
      code: color.code,
      name: color.name,
      hex: color.hex,
    });

    if (saved) {
      setSavedColors(prev => [saved, ...prev]);
    } else {
      // Revert on failure (might be duplicate)
      setSavedColorKeys(prev => {
        const next = new Set(prev);
        next.delete(colorKey);
        return next;
      });
    }
  };

  // Unsave color handler
  const handleUnsaveColor = async (color: ColorMatch) => {
    if (!user) return;

    const colorKey = `${color.system}:${color.code}`;
    
    // Optimistic update
    setSavedColorKeys(prev => {
      const next = new Set(prev);
      next.delete(colorKey);
      return next;
    });
    setSavedColors(prev => prev.filter(c => !(c.color_system === color.system && c.color_code === color.code)));

    const success = await unsaveColor(user.id, color.system, color.code);

    if (!success) {
      // Revert on failure
      setSavedColorKeys(prev => new Set([...prev, colorKey]));
      // Reload saved colors
      const colors = await getSavedColors(user.id);
      setSavedColors(colors);
    }
  };

  // Check if a color is saved
  const isColorSaved = (color: ColorMatch): boolean => {
    return savedColorKeys.has(`${color.system}:${color.code}`);
  };

  // Render
  if (dataLoading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-[#111] font-sans">

      {/* --- Main Content Area --- */}
      <main className="h-full">
        {activeTab === 'scan' && (
          <div className="min-h-full pb-24 safe-area-top">
            <div className="p-4 flex flex-col min-h-[calc(100vh-6rem)]">
              <div className="flex items-center gap-2 mb-8 mt-2">
                <span className="w-2 h-6 bg-black rounded-full block"></span>
                <h1 className="text-xl font-bold tracking-tight">NCS Lens</h1>
              </div>
            
            <div className="flex-1 flex flex-col justify-center items-center pb-12">
              {/* Loading State - within the scan frame */}
              {loading ? (
                <div className="group relative bg-white rounded-[40px] w-full max-w-[320px] aspect-[3/4] shadow-[0_20px_40px_rgba(0,0,0,0.05)] border border-white flex flex-col items-center justify-center gap-6 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-gray-50 via-white to-gray-50 opacity-50" />
                  <div className="relative z-10">
                    <Loader2 size={48} className="animate-spin text-black" />
                  </div>
                  <div className="relative z-10 text-center space-y-2">
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">Analyzing Materials</h2>
                    <p className="text-sm text-gray-400 animate-pulse">Identifying colors and finishes...</p>
                  </div>
                </div>
              ) : !user ? (
                /* Not logged in - grayed out scan frame with sign in button */
                <div className="group relative bg-gray-100 rounded-[40px] w-full max-w-[320px] aspect-[3/4] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-gray-200 flex flex-col items-center justify-center gap-6 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-gray-100 via-gray-50 to-gray-100 opacity-60" />
                  <div className="relative z-10 w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center">
                    <Sparkles size={32} className="text-gray-300" />
                  </div>
                  <div className="relative z-10 text-center space-y-3 px-6">
                    <h2 className="text-xl font-bold text-gray-400 tracking-tight">Sign In to Scan</h2>
                    <p className="text-sm text-gray-400 leading-relaxed">Create an account or sign in to start scanning materials and colors.</p>
                    <button
                      onClick={() => setActiveTab('profile')}
                      className="mt-4 bg-gray-900 text-white font-semibold py-3 px-6 rounded-2xl shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2 mx-auto"
                    >
                      <User size={18} />
                      <span>Sign In / Sign Up</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Logged in - normal scan frame */
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative cursor-pointer bg-white rounded-[40px] w-full max-w-[320px] aspect-[3/4] shadow-[0_20px_40px_rgba(0,0,0,0.05)] border border-white flex flex-col items-center justify-center gap-8 overflow-hidden transition-all active:scale-[0.98] hover:shadow-[0_25px_50px_rgba(0,0,0,0.08)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-gray-50 via-white to-gray-50 opacity-50" />
                  <div className="relative z-10 w-24 h-24 bg-[#F5F5F7] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                     <Sparkles size={36} className="text-gray-400 group-hover:text-black transition-colors duration-500" />
                  </div>
                  <div className="relative z-10 text-center space-y-3">
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">New Scan</h2>
                    <div className="flex items-center justify-center gap-3 text-gray-400 text-sm font-medium bg-white px-4 py-2 rounded-full shadow-sm">
                      <Camera size={16} /> <span className="w-px h-3 bg-gray-200"></span> <ImageIcon size={16} />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Salient Mode Toggle - only show when logged in */}
              {user && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSalientMode(!salientMode);
                  }}
                  className={`mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    salientMode 
                      ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                      : 'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}
                >
                  <Zap size={12} className={salientMode ? 'text-amber-500' : 'text-gray-400'} />
                  <span>Salient</span>
                  <div className={`w-6 h-3.5 rounded-full transition-colors ${salientMode ? 'bg-amber-400' : 'bg-gray-300'} relative`}>
                    <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-transform ${salientMode ? 'translate-x-3' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              )}
              
              <p className="mt-8 text-center text-sm text-gray-400 max-w-[260px] leading-relaxed">
                Take a photo to identify NCS/RAL codes and material finishes instantly.
              </p>
            </div>
          </div>
          </div>
        )}

        {activeTab === 'palette' && (
          <PaletteExtractorPage />
        )}

        {activeTab === 'history' && (
          <div className="min-h-full pb-24 safe-area-top">
            {/* Sub-tabs */}
            <div className="p-4 pb-0">
              <h1 className="text-2xl font-bold tracking-tight mb-4 px-1">My Collection</h1>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setHistorySubTab('scans')}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                    historySubTab === 'scans' 
                      ? 'bg-gray-900 text-white' 
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Layers size={14} className="inline mr-2" />
                  Scans
                </button>
                <button
                  onClick={() => setHistorySubTab('colors')}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                    historySubTab === 'colors' 
                      ? 'bg-gray-900 text-white' 
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Heart size={14} className="inline mr-2" />
                  Saved Colors ({savedColors.length})
                </button>
              </div>
            </div>

            {historySubTab === 'scans' ? (
              /* Scans Grid */
              <div className="px-4">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400">
                    <Layers size={48} className="mb-4 opacity-20" />
                    <p>No scans yet</p>
                    <p className="text-sm mt-1">Take a photo to get started!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {history.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => setDetailItem(item)} 
                        className="bg-white p-3 rounded-2xl shadow-sm border border-white flex flex-col gap-3 cursor-pointer active:scale-[0.98] transition-all hover:shadow-md"
                      >
                        <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                          <img src={item.image} className="w-full h-full object-cover" loading="lazy" />
                          {user && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                              className="absolute top-2 right-2 p-1.5 bg-black/20 backdrop-blur-md rounded-full text-white/80 hover:bg-red-500 hover:text-white transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 text-sm truncate leading-tight">{item.result.productType}</h3>
                          <div className="flex items-center gap-1 mt-2">
                            {item.result.colors.slice(0, 3).map((c, i) => (
                              <div 
                                key={i} 
                                className="w-3 h-3 rounded-full border border-black/5 cursor-pointer hover:scale-125 transition-transform" 
                                style={{backgroundColor: c.hex}}
                                onClick={(e) => { e.stopPropagation(); setDetailColor(c); }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Saved Colors Grid */
              <div className="px-4">
                {savedColors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400">
                    <Heart size={48} className="mb-4 opacity-20" />
                    <p>No saved colors yet</p>
                    <p className="text-sm mt-1">Tap the heart icon on any color to save it!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {savedColors.map((color) => {
                      // Convert SavedColor to ColorMatch for display
                      const colorMatch: ColorMatch = {
                        system: color.color_system,
                        code: color.color_code,
                        name: color.color_name || color.color_code,
                        hex: color.color_hex,
                        location: '-',
                        confidence: 'High',
                        materialGuess: '-',
                        finishGuess: '-',
                        laymanDescription: '-',
                      };
                      
                      return (
                        <div 
                          key={color.id}
                          onClick={() => setDetailColor(colorMatch)}
                          className="bg-white p-3 rounded-2xl shadow-sm border border-white flex flex-col gap-2 cursor-pointer active:scale-[0.98] transition-all hover:shadow-md"
                        >
                          <div 
                            className="aspect-square rounded-xl shadow-sm border border-gray-100" 
                            style={{ backgroundColor: color.color_hex }}
                          />
                          <div className="min-w-0 text-center">
                            <p className="font-bold text-gray-900 text-xs truncate">{color.color_code.split(' ').pop()}</p>
                            <p className="text-[10px] text-gray-400 truncate">{color.color_system}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'community' && (
          <GridView 
            items={communityItems} 
            title="Discover" 
            onSelect={setDetailItem}
            onLike={handleLike}
            onColorSelect={setDetailColor}
            enableSearch={true}
            showLikes={true}
            enableSort={true}
            enableViewToggle={true}
          />
        )}

        {activeTab === 'profile' && (
          user ? <ProfilePage onNavigateToVilkaar={() => {
            setShowVilkaar(true);
            updateUrl('/vilkaar');
          }} /> : <AuthPage />
        )}
      </main>

      {/* --- Overlays --- */}
      {detailItem && (
        <ResultView 
          item={detailItem} 
          onBack={() => setDetailItem(null)} 
          onColorSelect={setDetailColor}
          onRegenerate={user && !detailItem.author ? handleRegenerate : undefined}
          onPublish={user && !detailItem.author ? handlePublish : undefined}
          onUnpublish={user && !detailItem.author ? handleUnpublish : undefined}
          onUpdate={user && !detailItem.author ? handleUpdateResult : undefined}
          isOwner={!!(user && !detailItem.author)}
        />
      )}
      
      {detailColor && (
        <ColorDetailView 
          color={detailColor} 
          history={history}
          communityItems={communityItems}
          onBack={() => {
            setDetailColor(null);
            updateUrl('/');
          }}
          onSaveColor={user ? handleSaveColor : undefined}
          onUnsaveColor={user ? handleUnsaveColor : undefined}
          isSaved={isColorSaved(detailColor)}
          onSelectColor={(color) => setDetailColor(color)}
        />
      )}

      {/* Vilkaar (Terms) Page */}
      {showVilkaar && (
        <div className="fixed inset-0 z-50 bg-white">
          <VilkaarPage 
            onBack={() => {
              setShowVilkaar(false);
              updateUrl('/');
            }}
          />
        </div>
      )}

      {/* --- Bottom Navigation --- */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-100 pb-safe-bottom z-30">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          <button 
            onClick={() => setActiveTab('scan')}
            className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'scan' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Camera strokeWidth={activeTab === 'scan' ? 2.5 : 2} size={24} />
            <span className="text-[10px] font-medium">Scan</span>
          </button>

          <button 
            onClick={() => setActiveTab('palette')}
            className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'palette' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Palette strokeWidth={activeTab === 'palette' ? 2.5 : 2} size={24} />
            <span className="text-[10px] font-medium">Palette</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'history' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Layers strokeWidth={activeTab === 'history' ? 2.5 : 2} size={24} />
            <span className="text-[10px] font-medium">Collection</span>
          </button>

          <button 
            onClick={() => setActiveTab('community')}
            className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'community' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Globe strokeWidth={activeTab === 'community' ? 2.5 : 2} size={24} />
            <span className="text-[10px] font-medium">Community</span>
          </button>

          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'profile' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <User strokeWidth={activeTab === 'profile' ? 2.5 : 2} size={24} />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
};

// Main wrapper component that handles auth state
const AppWithAuth = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // Allow browsing without login - App handles auth checks for specific actions
  return <App />;
};

const root = createRoot(document.getElementById("root")!);
root.render(
  <AuthProvider>
    <AppWithAuth />
  </AuthProvider>
);