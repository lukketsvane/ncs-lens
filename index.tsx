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
  Plus, 
  Trash2, 
  X, 
  Hammer, 
  RefreshCw,
  Globe,
  CheckCircle2,
  Search
} from "lucide-react";

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
}

type Tab = 'scan' | 'history' | 'community';

// --- Curated Data (Simulating Edge Config Content) ---
const CURATED_COMMUNITY_ITEMS: HistoryItem[] = [
  {
    id: "demo-1",
    timestamp: Date.now() - 86400000,
    author: "DesignArchive_Oslo",
    image: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?q=80&w=600&auto=format&fit=crop", 
    result: {
      productType: "Eames Lounge Chair (Classic)",
      materials: [
        { name: "Plywood", texture: "Smooth", finish: "Oiled Palisander" },
        { name: "Leather", texture: "Grainy", finish: "Semi-aniline" }
      ],
      colors: [
         { system: "NCS", code: "S 8505-Y20R", name: "Espresso", hex: "#3E332E", location: "Leather", confidence: "High", materialGuess: "Full Grain Leather", finishGuess: "Satin", laymanDescription: "Deep, rich brown with soft highlights." },
         { system: "NCS", code: "S 4040-Y20R", name: "Rosewood", hex: "#785640", location: "Shell", confidence: "High", materialGuess: "Rosewood Veneer", finishGuess: "Oiled", laymanDescription: "Warm, reddish wood tone with dark grain." }
      ]
    }
  },
  {
    id: "demo-2",
    timestamp: Date.now() - 172800000,
    author: "Dieter_Fan",
    image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=600&auto=format&fit=crop", 
    result: {
      productType: "Modern Minimalist Interior",
      materials: [
        { name: "Plaster", texture: "Matte", finish: "Paint" },
        { name: "Oak", texture: "Natural", finish: "White Oil" }
      ],
      colors: [
         { system: "NCS", code: "S 1002-Y", name: "Warm White", hex: "#F2F0EB", location: "Walls", confidence: "High", materialGuess: "Gypsum Plaster", finishGuess: "Matte", laymanDescription: "Soft, chalky white that reflects light gently." },
         { system: "NCS", code: "S 3010-G30Y", name: "Sage Green", hex: "#9CAea9", location: "Cabinet", confidence: "Medium", materialGuess: "Painted MDF", finishGuess: "Satin", laymanDescription: "Muted, earthy green with grey undertones." }
      ]
    }
  }
];

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
            laymanDescription: { type: Type.STRING, description: "A sensory description of the look and feel for non-experts." }
          },
          required: ["system", "code", "name", "hex", "location", "confidence", "materialGuess", "finishGuess", "laymanDescription"],
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
          text: `Act as a world-class Color, Material, and Finish (CMF) Designer. Analyze the uploaded product image with extreme precision for a professional design database.

1. **Product Identification**: Identify the specific design object or describe its style and type accurately.

2. **Material Analysis**: Break down the object into its primary materials. Distinguish subtle differences:
   - Wood: Is it Oiled Oak, Soap Treated Beech, Walnut Veneer?
   - Metal: Is it Brushed Aluminum, Chrome Plated Steel, Powder Coated?
   - Plastic: Is it Matte Polypropylene, High Gloss ABS?
   - Textile: Is it Wool Felt, Bouclé, Canvas?

3. **Color Matching (Crucial)**:
   - For **Paints, Plastics, Coatings, Textiles**: You MUST provide the closest **NCS S-series** code (Natural Color System). Format MUST be 'S XXXX-YZZR' (e.g., 'S 2030-Y90R').
   - For **Industrial Metals**: Provide **RAL Classic** codes (e.g., 'RAL 9005 Jet Black').
   - For **Natural Materials** (Wood, Stone): Provide the nearest NCS equivalent that matches the visual dominance of the material.
   
4. **Contextual Description**:
   - 'laymanDescription': Explain the surface sensation and look in simple, sensory terms (e.g., "A warm, honey-colored wood with visible grain patterns and a smooth matte touch").
   - 'finishGuess': Be specific about the reflection and texture (e.g., 'Matte Lacquer', 'Satin', 'High Gloss', 'Raw').

5. **Lighting Correction**:
   - Account for the lighting in the photo (e.g., warm indoor light, cool shadow). Try to predict the *true* object color as if seen in neutral daylight (D65).

Ensure high accuracy. If the image quality is poor, deduce the likely standard specification for this object type.`,
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.4, 
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

const parseNCS = (code: string) => {
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
const ColorDetailView = ({ color, onBack }: { color: ColorMatch, onBack: () => void }) => {
  const contrastText = getContrastColor(color.hex);
  const ncsData = color.system === 'NCS' ? parseNCS(color.code) : null;
  const [activeTab, setActiveTab] = useState<'details' | 'material'>('details');

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Top Half - Color Surface */}
      <div 
        className="flex-1 relative flex flex-col items-center justify-center p-6 transition-colors duration-500"
        style={{ backgroundColor: color.hex }}
      >
        <button 
          onClick={onBack}
          className={`absolute top-safe-top left-4 p-2 rounded-full bg-black/10 backdrop-blur-md border border-white/10 ${contrastText} hover:bg-black/20 transition-all`}
        >
          <ChevronLeft size={24} />
        </button>

        <div className={`text-center space-y-4 ${contrastText}`}>
          {ncsData && (
             <div className="flex items-center gap-8 text-[10px] uppercase font-medium tracking-widest opacity-60">
                <div className="flex flex-col items-center">
                  <span>Blackness</span>
                  <span className="text-xl mt-1">{ncsData.blackness}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span>Chroma</span>
                  <span className="text-xl mt-1">{ncsData.chroma}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span>Hue</span>
                  <span className="text-xl mt-1">{ncsData.hue}</span>
                </div>
             </div>
          )}
          
          <div className="flex items-center justify-center gap-4">
            <h1 className="text-6xl font-light tracking-tight">{ncsData ? ncsData.blackness : color.code.split(' ')[0]}</h1>
            {ncsData && <div className="text-6xl font-light">-</div>}
            <h1 className="text-6xl font-light tracking-tight">{ncsData ? ncsData.hue : (color.code.split(' ')[1] || '')}</h1>
          </div>
          
          {!ncsData && <h1 className="text-4xl font-light tracking-tight">{color.code}</h1>}
          
          <div className="text-xs font-medium tracking-widest uppercase opacity-70">
            {color.system === 'NCS' ? 'Natural Color System' : 'RAL Classic'}
          </div>
        </div>
      </div>

      {/* Bottom Half - Details & Actions */}
      <div className="bg-white pb-safe-bottom">
        <div className="flex border-b border-gray-100">
          <button 
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === 'details' ? 'text-gray-900 border-b-2 border-black' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Details
          </button>
          <button 
            onClick={() => setActiveTab('material')}
            className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === 'material' ? 'text-gray-900 border-b-2 border-black' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Material
          </button>
        </div>

        <div className="p-6 space-y-6 h-[40vh] overflow-y-auto no-scrollbar">
          {activeTab === 'details' ? (
            <>
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Properties</h2>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-400 font-medium text-sm">Name</span>
                  <span className="text-gray-900 font-semibold text-right">{color.name}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-400 font-medium text-sm">System</span>
                  <span className="text-gray-900 font-semibold">{color.system}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-400 font-medium text-sm">Hex</span>
                  <span className="text-gray-900 font-mono text-sm">{color.hex}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                   <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Likely Material</h3>
                   <div className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                     <Hammer size={24} className="text-gray-600" />
                     {color.materialGuess}
                   </div>
                   <p className="mt-2 text-gray-600 leading-relaxed">
                     {color.laymanDescription}
                   </p>
                 </div>
                 <div className="space-y-4">
                    <h2 className="text-lg font-bold text-gray-900">Finish Details</h2>
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-400 font-medium text-sm">Applied To</span>
                      <span className="text-gray-900 font-semibold">{color.location}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-400 font-medium text-sm">Finish Type</span>
                      <span className="text-gray-900 font-semibold">{color.finishGuess}</span>
                    </div>
                 </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// 2. Result View (Overlay)
const ResultView = ({ 
  item, 
  onBack, 
  onColorSelect, 
  onRegenerate,
  onPublish
}: { 
  item: HistoryItem, 
  onBack: () => void, 
  onColorSelect: (c: ColorMatch) => void,
  onRegenerate?: () => void,
  onPublish?: () => void
}) => {
  const { image, result } = item;
  const [isPublishing, setIsPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const handlePublish = async () => {
    if (published || !onPublish) return;
    setIsPublishing(true);
    // Simulate API delay
    await new Promise(r => setTimeout(r, 1200));
    onPublish();
    setPublished(true);
    setIsPublishing(false);
  };

  return (
    <div className="fixed inset-0 bg-[#F0F2F5] z-40 overflow-y-auto no-scrollbar safe-area-top safe-area-bottom">
      <div className="p-4 min-h-full pb-20">
        <div className="flex justify-between items-center mb-6">
          <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100">
             <ChevronLeft size={20} />
          </button>
          <div className="font-semibold truncate max-w-[200px] text-center">{result.productType}</div>
          
          <button 
            onClick={handlePublish}
            disabled={isPublishing || published || !onPublish}
            className={`p-2 rounded-full shadow-sm transition-all duration-300 ${published ? 'bg-green-100 text-green-700' : 'bg-white text-gray-900'}`}
          >
             {isPublishing ? <Loader2 size={20} className="animate-spin" /> : published ? <CheckCircle2 size={20} /> : <Share2 size={20} />}
          </button>
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
  onDelete
}: { 
  items: HistoryItem[], 
  title: string, 
  onSelect: (item: HistoryItem) => void,
  onDelete?: (id: string) => void
}) => {
  return (
    <div className="min-h-full p-4 pb-24 safe-area-top">
       <div className="flex items-center justify-between mb-6 px-1">
         <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
         <div className="p-2 bg-white rounded-full shadow-sm">
           <Search size={20} className="text-gray-400" />
         </div>
       </div>

       {items.length === 0 ? (
         <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400">
           <Layers size={48} className="mb-4 opacity-20" />
           <p>Collection is empty</p>
         </div>
       ) : (
         <div className="grid grid-cols-2 gap-3">
           {items.map((item) => (
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
  // Navigation State
  const [activeTab, setActiveTab] = useState<Tab>('scan');
  
  // Data State
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('cmf_history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const [communityItems, setCommunityItems] = useState<HistoryItem[]>(() => {
    // Initial load: Mix curated items with any locally "published" items
    const localPublished = localStorage.getItem('cmf_community_local');
    const parsedLocal = localPublished ? JSON.parse(localPublished) : [];
    return [...parsedLocal, ...CURATED_COMMUNITY_ITEMS];
  });

  // UI State
  const [loading, setLoading] = useState(false);
  const [detailItem, setDetailItem] = useState<HistoryItem | null>(null);
  const [detailColor, setDetailColor] = useState<ColorMatch | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('cmf_history', JSON.stringify(history));
  }, [history]);

  // Handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1];
        const result = await analyzeImage(base64);
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          image: reader.result as string,
          result: result
        };
        setHistory(prev => [newItem, ...prev]);
        setDetailItem(newItem);
        setActiveTab('scan'); // Ensure we are on a tab that makes sense, though detail overlay covers it
      } catch (err) {
        alert("Analysis failed. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRegenerate = async () => {
    if (!detailItem) return;
    setLoading(true);
    try {
      const base64 = detailItem.image.split(",")[1];
      const result = await analyzeImage(base64);
      const updatedItem = { ...detailItem, result, timestamp: Date.now() };
      setDetailItem(updatedItem);
      setHistory(prev => prev.map(item => item.id === detailItem.id ? updatedItem : item));
    } catch {
      alert("Regeneration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = () => {
    if (!detailItem) return;
    // Simulate publishing to Edge Config
    const publishedItem = { ...detailItem, author: "You", id: `pub-${Date.now()}` };
    
    // Update local community state
    const newCommunityList = [publishedItem, ...communityItems];
    setCommunityItems(newCommunityList);
    
    // Persist "locally published" items to simulate a server
    const localOnly = newCommunityList.filter(i => i.author === "You");
    localStorage.setItem('cmf_community_local', JSON.stringify(localOnly));
    
    // Optional: Switch to community tab to show it appeared
    // setActiveTab('community');
    // setDetailItem(null);
  };

  // Render
  if (loading) {
    return (
      <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-[100] flex flex-col items-center justify-center">
         <Loader2 size={48} className="animate-spin text-black mb-4" />
         <p className="font-medium animate-pulse text-gray-500">Analyzing materials...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-[#111] font-sans">
      
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
            onDelete={(id) => setHistory(h => h.filter(i => i.id !== id))}
          />
        )}

        {activeTab === 'community' && (
          <GridView 
            items={communityItems} 
            title="Discover" 
            onSelect={setDetailItem} 
          />
        )}
      </main>

      {/* --- Overlays --- */}
      {detailItem && (
        <ResultView 
          item={detailItem} 
          onBack={() => setDetailItem(null)} 
          onColorSelect={setDetailColor}
          onRegenerate={detailItem.author ? undefined : handleRegenerate} // Only regenerate own items
          onPublish={detailItem.author ? undefined : handlePublish} // Only publish own items
        />
      )}
      
      {detailColor && (
        <ColorDetailView 
          color={detailColor} 
          onBack={() => setDetailColor(null)} 
        />
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

const root = createRoot(document.getElementById("root")!);
root.render(<App />);