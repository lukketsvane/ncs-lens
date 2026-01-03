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
  RefreshCw 
} from "lucide-react";

// --- Types ---

interface ColorMatch {
  system: "RAL" | "NCS";
  code: string;
  name: string;
  hex: string;
  location: string;
  confidence: string;
  // New fields for material context
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
}

type ViewState = 'home' | 'result' | 'color-detail' | 'history';

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
  // Regex for NCS S 2030-Y90R pattern
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

// 1. Color Detail View
const ColorDetailView = ({ color, onBack }: { color: ColorMatch, onBack: () => void }) => {
  const contrastText = getContrastColor(color.hex);
  const ncsData = color.system === 'NCS' ? parseNCS(color.code) : null;
  const [activeTab, setActiveTab] = useState<'details' | 'material'>('details');

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
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
        {/* Tabs */}
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

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {activeTab === 'details' ? (
            <>
              {/* Details List */}
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
                  <span className="text-gray-400 font-medium text-sm">Collection</span>
                  <span className="text-gray-900 font-semibold uppercase">{color.system} 2025</span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-400 font-medium text-sm">Hex</span>
                  <span className="text-gray-900 font-mono text-sm">{color.hex}</span>
                </div>
              </div>

              {/* Action List (Valg) */}
              <div className="pt-2 space-y-1">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Actions</h2>
                
                <button className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group">
                  <Plus size={20} className="text-gray-400 group-hover:text-black" />
                  <span className="text-gray-600 font-medium group-hover:text-black">Save to collection</span>
                </button>
                
                <button className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group">
                  <Layers size={20} className="text-gray-400 group-hover:text-black" />
                  <span className="text-gray-600 font-medium group-hover:text-black">Find similar colors</span>
                </button>
                
                <button className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group">
                  <Eye size={20} className="text-gray-400 group-hover:text-black" />
                  <span className="text-gray-600 font-medium group-hover:text-black">Load to compare</span>
                </button>

                <button className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group">
                  <Share2 size={20} className="text-gray-400 group-hover:text-black" />
                  <span className="text-gray-600 font-medium group-hover:text-black">Share color</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Material Info Tab */}
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
                    
                     <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-400 font-medium text-sm">Confidence</span>
                      <span className={`font-semibold px-2 py-0.5 rounded-md text-xs ${color.confidence === 'High' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {color.confidence}
                      </span>
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

// 2. History View
const HistoryView = ({ history, onSelect, onBack, onDelete }: { history: HistoryItem[], onSelect: (item: HistoryItem) => void, onBack: () => void, onDelete: (id: string) => void }) => {
  return (
    <div className="min-h-screen bg-[#F0F2F5] p-4 safe-area-top safe-area-bottom">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold">Saved Collections</h1>
      </div>
      
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400">
          <HistoryIcon size={48} className="mb-4 opacity-20" />
          <p>No saved items yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {history.map((item) => (
            <div key={item.id} onClick={() => onSelect(item)} className="bg-white p-4 rounded-2xl shadow-sm flex gap-4 cursor-pointer active:scale-[0.98] transition-transform">
              <img src={item.image} className="w-20 h-20 rounded-xl object-cover bg-gray-100" />
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                 <h3 className="font-bold text-gray-900 truncate">{item.result.productType}</h3>
                 <p className="text-xs text-gray-500 mt-1">
                   {new Date(item.timestamp).toLocaleDateString()}
                 </p>
                 <div className="flex gap-1 mt-3">
                   {item.result.colors.slice(0, 4).map((c, i) => (
                     <div key={i} className="w-4 h-4 rounded-full border border-black/5" style={{backgroundColor: c.hex}} />
                   ))}
                 </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                className="self-start text-gray-300 hover:text-red-500 p-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const App = () => {
  // State
  const [viewState, setViewState] = useState<ViewState>('home');
  const [loading, setLoading] = useState(false);
  const [activeItem, setActiveItem] = useState<HistoryItem | null>(null);
  const [activeColor, setActiveColor] = useState<ColorMatch | null>(null);
  
  // History Persistence
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('cmf_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('cmf_history', JSON.stringify(history));
  }, [history]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const imageUri = reader.result as string;
      
      try {
        const result = await analyzeImage(base64);
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          image: imageUri,
          result: result
        };
        
        setHistory(prev => [newItem, ...prev]);
        setActiveItem(newItem);
        setViewState('result');
      } catch (err) {
        console.error(err);
        alert("Could not analyze image. Try again.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRegenerate = async () => {
    if (!activeItem) return;
    setLoading(true);
    try {
      // Extract base64 from data URI (data:image/jpeg;base64,...)
      const base64 = activeItem.image.split(",")[1];
      const result = await analyzeImage(base64);
      
      // Update the existing item instead of creating a new one
      const updatedItem = { ...activeItem, result, timestamp: Date.now() };
      
      setActiveItem(updatedItem);
      setHistory(prev => prev.map(item => item.id === activeItem.id ? updatedItem : item));
      
    } catch (err) {
      console.error(err);
      alert("Could not regenerate. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    if (activeItem?.id === id) {
      setActiveItem(null);
      setViewState('home');
    }
  };

  // Render Logic
  
  // 1. Loading State
  if (loading) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
         <Loader2 size={48} className="animate-spin text-black mb-4" />
         <p className="font-medium animate-pulse text-gray-500">Analyzing surfaces & colors...</p>
      </div>
    );
  }

  // 2. Color Detail View
  if (viewState === 'color-detail' && activeColor) {
    return <ColorDetailView color={activeColor} onBack={() => setViewState('result')} />;
  }

  // 3. History View
  if (viewState === 'history') {
    return (
      <HistoryView 
        history={history} 
        onSelect={(item) => { setActiveItem(item); setViewState('result'); }} 
        onBack={() => setViewState('home')}
        onDelete={deleteHistoryItem}
      />
    );
  }

  // 4. Result View (Bento)
  if (viewState === 'result' && activeItem) {
    const { image, result } = activeItem;
    return (
      <div className="min-h-screen bg-[#F0F2F5] text-[#111] p-4 font-sans safe-area-top safe-area-bottom">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setViewState('home')} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100">
             <ChevronLeft size={20} />
          </button>
          <div className="font-semibold">{result.productType}</div>
          <button className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100">
             <Share2 size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="max-w-md mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
          {/* Main Image with Regenerate Overlay */}
          <div className="relative rounded-[32px] overflow-hidden bg-gray-200 aspect-square shadow-sm group">
             <img src={image} className="w-full h-full object-cover" alt="Product" />
             <button 
               onClick={handleRegenerate}
               className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-semibold shadow-sm hover:bg-white transition-colors"
             >
               <RotateCcw size={14} className="text-gray-600" />
               <span className="text-gray-800">Re-analyze</span>
             </button>
          </div>

          {/* Info Card */}
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

          {/* Color Grid */}
          <div className="grid grid-cols-2 gap-3">
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
                        {/* Redo / Refresh Icon for this card */}
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRegenerate(); }}
                          className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
                          title="Redo analysis"
                        >
                          <RefreshCw size={14} className={textColorClass === 'text-black' ? 'text-black/60' : 'text-white/80'} />
                        </button>
                        <ArrowRight 
                           onClick={() => { setActiveColor(color); setViewState('color-detail'); }}
                           className="cursor-pointer" 
                           size={16} 
                        />
                     </div>
                   </div>
                   
                   <div 
                     onClick={() => { setActiveColor(color); setViewState('color-detail'); }}
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
    );
  }

  // 5. Home View (Default)
  return (
    <div className="min-h-screen bg-[#F0F2F5] text-[#111] p-4 font-sans safe-area-top safe-area-bottom">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <span className="w-2 h-6 bg-black rounded-full block"></span>
          CMF Lens
        </h1>
        <button onClick={() => setViewState('history')} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-colors">
          <HistoryIcon size={20} className="text-gray-600" />
        </button>
      </div>

      <main className="max-w-md mx-auto space-y-4">
        
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="group relative cursor-pointer bg-white rounded-[32px] aspect-[3/4] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col items-center justify-center gap-6 overflow-hidden transition-all active:scale-[0.98]"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-gray-50 to-white opacity-50" />
          
          <div className="relative z-10 w-20 h-20 bg-[#F5F5F7] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
             <Sparkles size={32} className="text-gray-400" />
          </div>
          
          <div className="relative z-10 text-center space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Scan Object</h2>
            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm font-medium">
              <Camera size={16} /> <span>Camera</span>
              <span className="w-1 h-1 bg-gray-300 rounded-full" />
              <ImageIcon size={16} /> <span>Upload</span>
            </div>
          </div>
        </div>

        {/* Recent mini-history (Optional, just 2 items) */}
        {history.length > 0 && (
          <div className="pt-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 ml-2">Recent</h3>
            <div className="grid grid-cols-2 gap-3">
              {history.slice(0, 2).map(item => (
                <div 
                  key={item.id}
                  onClick={() => { setActiveItem(item); setViewState('result'); }}
                  className="bg-white p-3 rounded-2xl border border-white shadow-sm flex items-center gap-3 cursor-pointer active:scale-95 transition-transform"
                >
                   <img src={item.image} className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                   <div className="overflow-hidden">
                     <div className="text-xs font-bold truncate">{item.result.productType}</div>
                     <div className="text-[10px] text-gray-400">{new Date(item.timestamp).toLocaleDateString()}</div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

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