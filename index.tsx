import React, { useState, useEffect, useRef } from "react";
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
  Check
} from "lucide-react";
import { AuthProvider, useAuth } from "./components/AuthContext";
import { AuthPage } from "./components/AuthPage";
import { ProfilePage } from "./components/ProfilePage";
import { getUserScans, getPublicScans, createScan, updateScan, deleteScan, publishScan, unpublishScan, ScanRecord } from "./lib/scans";
import { uploadImage, deleteImage } from "./lib/storage";

// --- Constants ---
const EDGE_CONFIG_STORE_ID = "ecfg_xlrdrn2ms13tkf3hezgonww7tpbk"; // Prepared for backend integration

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
}

type Tab = 'scan' | 'history' | 'community' | 'profile';

// --- API Helper ---

const analyzeImage = async (base64Image: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      productType: { type: Type.STRING, description: "Specific product name (e.g. 'Herman Miller Aeron') or precise generic description." },
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
            code: { type: Type.STRING, description: "The exact standard code (e.g. 'NCS S 2005-Y20R' or 'RAL 9010')." },
            name: { type: Type.STRING, description: "Official color name." },
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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image,
            mimeType: "image/jpeg",
          },
        },
        {
          text: `Act as a precision Colorimeter and CMF Expert. Analyze the image to identify materials and colors with database-level accuracy.

**CRITICAL: Lighting Correction**
Before identifying colors, mathematically compensate for the lighting in the image (e.g., remove yellow cast from warm indoor lights, correct exposure). Identify the *true* underlying color of the object as if viewed under D65 standard daylight.

**Analysis Steps:**
1. **Product**: Identify the object.
2. **Materials**: Analyze surface texture and finish.
3. **Exact Color Matching**: 
   - Identify the closest **NCS S-Series** or **RAL Classic** code.
   - **Precision**: If a wall looks like "white", determine if it's "S 0500-N" (Pure White) or "S 0502-Y" (Standard White). Look for subtle undertones.
   - **Technical Data**: Provide standard technical specifications (LRV, CMYK) associated with the identified code, NOT just the pixel values.

**NCS Notation Rules:**
- Format: "S BBCC-H" (e.g., S 1050-Y90R).
- BB = Blackness (00-99).
- CC = Chromaticness (00-99).
- H = Hue (e.g., Y, Y10R, R, R80B, B, G).

Return the data in the specified JSON schema.`,
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.2, // Lower temperature for more deterministic/accurate technical data
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response");
  return JSON.parse(text) as AnalysisResult;
};

// --- Helper Functions ---

const getContrastColor = (hex: string) => {
  const r = parseInt(hex.substr(1, 2), 16);
  const g = parseInt(hex.substr(3, 2), 16);
  const b = parseInt(hex.substr(5, 2), 16);
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

// --- Components ---

// 1. Color Detail Overlay
const CURATED_COMPARISONS: ColorMatch[] = [
  { system: "NCS", code: "S 0300-N", name: "Pure White", hex: "#FFFFFF", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "100", cmyk: "0,0,0,0", rgb: "255,255,255" },
  { system: "NCS", code: "S 0502-Y", name: "Standard White", hex: "#F2F0EB", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "85", cmyk: "0,0,5,0", rgb: "242,240,235" },
  { system: "NCS", code: "S 4500-N", name: "Middle Grey", hex: "#8B8B8B", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "30", cmyk: "0,0,0,45", rgb: "139,139,139" },
  { system: "NCS", code: "S 9000-N", name: "Black", hex: "#212121", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "5", cmyk: "0,0,0,90", rgb: "33,33,33" },
];

const ColorDetailView = ({ color, history, onBack }: { color: ColorMatch, history: HistoryItem[], onBack: () => void }) => {
  const contrastText = getContrastColor(color.hex);
  const isNCS = color.system === 'NCS';
  
  // Use API data if available, fallback to regex parsing
  const blackness = color.blackness || parseNCSStr(color.code)?.blackness || "--";
  const chroma = color.chromaticness || parseNCSStr(color.code)?.chroma || "--";
  const hue = color.hue || parseNCSStr(color.code)?.hue || "";
  
  const [activeTab, setActiveTab] = useState<'details' | 'combinations' | 'compare'>('details');
  const [compareColor, setCompareColor] = useState<ColorMatch | null>(null);

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
    <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
      
      {/* 1. Top Section - Visual Navigator (Matches Screenshot) */}
      <div 
        className={`relative pt-safe-top pb-8 px-6 transition-all duration-500 shadow-sm z-10 flex flex-col`}
        style={{ 
          backgroundColor: color.hex,
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
          <button className={`${contrastText} opacity-80 hover:opacity-100`}>
            <Share2 size={20} />
          </button>
        </div>

        {/* NCS Data Display */}
        <div className={`flex flex-col items-center justify-center flex-1 ${contrastText}`}>
          {isNCS ? (
            <div className="w-full max-w-sm">
              {/* Labels - Hide in small split mode */}
              {(!compareColor || activeTab !== 'compare') && (
                <div className="flex justify-between text-[10px] font-bold tracking-widest uppercase opacity-60 mb-2 px-8">
                  <span className="w-16 text-center">Blackness</span>
                  <span className="w-16 text-center">Chroma</span>
                  <span className="w-24 text-center">Hue</span>
                </div>
              )}
              
              {/* Values */}
              <div className="flex justify-between items-baseline px-2">
                 <div className="text-7xl font-light tracking-tighter flex items-baseline">
                   <span className="text-4xl mr-2 opacity-60">S</span>
                   {blackness}
                 </div>
                 <div className="text-7xl font-light tracking-tighter">
                   {chroma}
                 </div>
                 <div className="text-4xl font-light opacity-60">-</div>
                 <div className="text-6xl font-light tracking-tight w-28 text-center truncate">
                   {hue}
                 </div>
              </div>
            </div>
          ) : (
             <div className="text-center py-4">
               <h1 className="text-6xl font-bold tracking-tight mb-2">{color.code}</h1>
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
      </div>

      {/* Bottom Actions - Hide in compare mode to maximize space */}
      {!(activeTab === 'compare' && compareColor) && (
        <div className="p-4 border-t border-gray-100 bg-white safe-area-bottom">
          <button className="w-full bg-gray-900 text-white font-semibold py-4 rounded-xl shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2">
            <Palette size={18} />
            <span>Find Similar Colors</span>
          </button>
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
    <div className="fixed inset-0 bg-[#F0F2F5] z-40 overflow-y-auto no-scrollbar safe-area-top safe-area-bottom">
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
  enableSearch = false
}: { 
  items: HistoryItem[], 
  title: string, 
  onSelect: (item: HistoryItem) => void,
  onDelete?: (id: string) => void,
  enableSearch?: boolean
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Filter items based on search query
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return items;
    
    const query = searchQuery.toLowerCase().trim();
    return items.filter(item => {
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
  }, [items, searchQuery]);

  return (
    <div className="min-h-full p-4 pb-24 safe-area-top">
       <div className="flex items-center justify-between mb-6 px-1">
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
             {enableSearch && (
               <button 
                 onClick={() => setShowSearch(true)}
                 className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 transition-colors"
               >
                 <Search size={20} className="text-gray-400" />
               </button>
             )}
           </>
         )}
       </div>

       {filteredItems.length === 0 ? (
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
       ) : (
         <div className="grid grid-cols-2 gap-3">
           {filteredItems.map((item) => (
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
                  <div className="flex items-center gap-1 mt-2">
                    {item.result.colors.slice(0, 3).map((c, i) => (
                      <div key={i} className="w-3 h-3 rounded-full border border-black/5" style={{backgroundColor: c.hex}} />
                    ))}
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
  
  // Data State - use Supabase for persistence
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [communityItems, setCommunityItems] = useState<HistoryItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // UI State
  const [loading, setLoading] = useState(false);
  const [detailItem, setDetailItem] = useState<HistoryItem | null>(null);
  const [detailColor, setDetailColor] = useState<ColorMatch | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        } else {
          setHistory([]);
        }

        // Fetch public scans for community (available to everyone)
        const publicScans = await getPublicScans();
        const communityItems: HistoryItem[] = publicScans.map((scan: ScanRecord) => ({
          id: scan.id,
          timestamp: new Date(scan.created_at).getTime(),
          image: scan.image_url,
          result: scan.result,
          author: scan.author || 'Anonymous',
          isPublic: true,
        }));
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
        const result = await analyzeImage(base64);
        
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
      
      const result = await analyzeImage(base64);
      
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
    }
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
      
      {/* Loading Overlay - shown during analysis without hiding UI */}
      {loading && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-[100] flex flex-col items-center justify-center">
           <Loader2 size={48} className="animate-spin text-black mb-4" />
           <p className="font-medium animate-pulse text-gray-500">Analyzing materials...</p>
        </div>
      )}

      {/* --- Main Content Area --- */}
      <main className="h-full">
        {activeTab === 'scan' && (
          <div className="p-4 pt-safe-top flex flex-col h-screen pb-24">
            <div className="flex items-center gap-2 mb-8 mt-2">
              <span className="w-2 h-6 bg-black rounded-full block"></span>
              <h1 className="text-xl font-bold tracking-tight">CMF Lens</h1>
            </div>
            
            <div className="flex-1 flex flex-col justify-center items-center pb-12">
              <div 
                onClick={() => {
                  if (!user) {
                    setShowAuthPrompt(true);
                    return;
                  }
                  fileInputRef.current?.click();
                }}
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
              <p className="mt-8 text-center text-sm text-gray-400 max-w-[260px] leading-relaxed">
                Take a photo to identify NCS/RAL codes and material finishes instantly.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <GridView 
            items={history} 
            title="My Collection" 
            onSelect={setDetailItem} 
            onDelete={user ? handleDelete : undefined}
          />
        )}

        {activeTab === 'community' && (
          <GridView 
            items={communityItems} 
            title="Discover" 
            onSelect={setDetailItem}
            enableSearch={true}
          />
        )}

        {activeTab === 'profile' && (
          user ? <ProfilePage /> : <AuthPage />
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
          isOwner={user && !detailItem.author ? true : false}
        />
      )}
      
      {detailColor && (
        <ColorDetailView 
          color={detailColor} 
          history={history}
          onBack={() => setDetailColor(null)} 
        />
      )}

      {/* Auth Prompt Modal */}
      {showAuthPrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User size={32} className="text-gray-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in required</h2>
              <p className="text-sm text-gray-500">
                Create an account or sign in to scan and generate color palettes.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowAuthPrompt(false);
                  setActiveTab('profile');
                }}
                className="w-full bg-gray-900 text-white font-semibold py-4 rounded-2xl shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2"
              >
                <span>Sign In / Sign Up</span>
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => setShowAuthPrompt(false)}
                className="w-full text-gray-500 font-medium py-3 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
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