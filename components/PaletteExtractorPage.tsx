import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  ChevronLeft, 
  Heart, 
  Share2, 
  Copy, 
  Loader2,
  Check
} from 'lucide-react';
import {
  ExtractedColor,
  PaletteAnalysis,
  analyzeImageForPalette,
  getUniquePantoneColors,
  hexToRgb,
  calculateLRV,
  calculateCMYK
} from '../lib/pantone-colors';

// --- Components ---

// PantoneChip - Individual color chip in the palette
const PantoneChip: React.FC<{ color: ExtractedColor; onClick: () => void }> = ({ color, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className="flex-shrink-0 w-28 h-40 bg-white shadow-sm rounded-xl overflow-hidden flex flex-col transition-all hover:scale-105 active:scale-95 mx-2 ring-1 ring-black/5 text-left group"
    >
      {/* Color Swatch */}
      <div 
        className="h-24 w-full"
        style={{ backgroundColor: color.pantone.hex }}
      />
      {/* Pantone Info */}
      <div className="flex-1 p-3 flex flex-col justify-center bg-white">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pantone</p>
        <p className="text-xs font-bold text-slate-900 leading-tight">{color.pantone.code}</p>
        <p className="text-[10px] text-slate-500 truncate mt-1">{color.pantone.name}</p>
      </div>
    </button>
  );
};

// Metrics row helper
const MetricRow = ({ label, value, isLast = false }: { label: string; value: string | number | React.ReactNode; isLast?: boolean }) => (
  <div className={`flex justify-between items-center py-3.5 ${!isLast ? 'border-b border-slate-50' : ''}`}>
    <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</span>
    <span className="font-semibold text-slate-700 tabular-nums text-sm">{value}</span>
  </div>
);

// Metrics Panel
const MetricsPanel: React.FC<{ analysis: PaletteAnalysis | null }> = ({ analysis }) => {
  if (!analysis) return (
    <div className="h-full flex flex-col justify-center items-center opacity-40 space-y-3">
        <div className="w-full h-8 bg-slate-100 rounded-lg animate-pulse"></div>
        <div className="w-full h-8 bg-slate-100 rounded-lg animate-pulse delay-75"></div>
        <div className="w-full h-8 bg-slate-100 rounded-lg animate-pulse delay-150"></div>
    </div>
  );

  return (
    <div className="w-full flex flex-col">
      <MetricRow label="Avg Lightness" value={`${(analysis.avgLightness * 100).toFixed(1)}%`} />
      <MetricRow label="Avg Chroma" value={analysis.avgChroma.toFixed(3)} />
      <MetricRow label="Bias (Color)" value={analysis.colorfulnessBias.toFixed(2)} />
      <MetricRow label="Bias (Light)" value={analysis.lightDarkBias.toFixed(2)} />
      <MetricRow label="Diversity" value={analysis.sparseColor ? 'High' : 'Low'} isLast />
    </div>
  );
};

// Detailed Color Modal
const DetailedColorModal: React.FC<{ color: ExtractedColor; onClose: () => void }> = ({ color, onClose }) => {
  const [copied, setCopied] = useState<string | null>(null);
  const pantoneRgb = hexToRgb(color.pantone.hex);
  const cmyk = calculateCMYK(pantoneRgb);
  const lrv = calculateLRV(pantoneRgb);

  // Determine if text should be white or black based on luminance
  const luminance = (0.299 * color.rgb.r + 0.587 * color.rgb.g + 0.114 * color.rgb.b) / 255;
  const textColorClass = luminance > 0.5 ? 'text-slate-900' : 'text-white';
  const subTextColorClass = luminance > 0.5 ? 'text-slate-600' : 'text-white/70';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white sm:p-4">
      <div className="w-full h-full max-w-md bg-white sm:rounded-[2rem] sm:h-[90vh] sm:shadow-2xl overflow-hidden flex flex-col relative ring-1 ring-black/5">
        
        {/* Header Color Block */}
        <div 
          className="h-[40%] w-full relative transition-colors duration-500"
          style={{ backgroundColor: color.pantone.hex }}
        >
          {/* Top Nav */}
          <div className={`absolute top-0 left-0 w-full p-6 flex justify-between items-center ${textColorClass}`}>
            <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-black/10 transition-colors">
              <ChevronLeft size={24} />
            </button>
            <div className="flex gap-4">
               <button className="p-2 rounded-full hover:bg-black/10 transition-colors"><Heart size={20} /></button>
               <button className="p-2 rounded-full hover:bg-black/10 transition-colors"><Share2 size={20} /></button>
            </div>
          </div>

          {/* Centered Title */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none ${textColorClass}`}>
            <h2 className="text-4xl font-bold tracking-tight mb-2">PANTONE</h2>
            <p className={`text-lg font-medium tracking-wide opacity-90`}>{color.pantone.code}</p>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Tabs */}
          <div className="flex border-b border-slate-100 px-2">
            {['Details', 'Context', 'Compare', 'Fine Tune'].map((tab, i) => (
              <div key={tab} className={`flex-1 py-4 text-center text-sm font-medium cursor-pointer relative ${i === 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                {tab}
                {i === 0 && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-slate-900"></div>}
              </div>
            ))}
          </div>

          {/* Details Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* Main Info Row */}
            <div className="flex justify-between items-baseline">
               <span className="text-slate-500 text-sm font-medium">Name</span>
               <span className="text-slate-900 font-bold text-lg">{color.pantone.name}</span>
            </div>

            <div className="flex justify-between items-baseline">
               <span className="text-slate-500 text-sm font-medium">Collection</span>
               <span className="text-slate-900 font-medium">Pantone Connect</span>
            </div>

            {/* Technical Data Section */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Technical Data</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                   <span className="text-slate-500 text-sm">LRV (D65)</span>
                   <span className="text-slate-900 font-mono font-medium">{lrv}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                   <span className="text-slate-500 text-sm">CMYK</span>
                   <span className="text-slate-900 font-mono font-medium">{cmyk.c}, {cmyk.m}, {cmyk.y}, {cmyk.k}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                   <span className="text-slate-500 text-sm">RGB</span>
                   <span className="text-slate-900 font-mono font-medium">{pantoneRgb.r}, {pantoneRgb.g}, {pantoneRgb.b}</span>
                </div>
                 <div 
                   className="flex justify-between items-center py-2 border-b border-slate-50 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded"
                   onClick={() => copyToClipboard(color.pantone.hex.toUpperCase(), 'hex')}
                 >
                   <span className="text-slate-500 text-sm">HEX</span>
                   <div className="flex items-center gap-2">
                     <span className="text-slate-900 font-mono font-medium uppercase">{color.pantone.hex}</span>
                     {copied === 'hex' ? (
                       <Check size={12} className="text-green-500" />
                     ) : (
                       <Copy size={12} className="text-slate-400" />
                     )}
                   </div>
                </div>
              </div>
            </div>

          </div>

          {/* Bottom Action */}
          <div className="p-6 border-t border-slate-100 bg-white pb-8 sm:pb-6">
            <button className="w-full bg-slate-900 text-white font-medium py-4 rounded-xl shadow-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
              <span>Find Similar Colors</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">10</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

// Image Overlay Component
const ImageOverlay: React.FC<{ src: string }> = ({ src }) => {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden select-none bg-slate-50 rounded-t-[2.5rem]">
       <div className="relative w-full h-full flex items-center justify-center p-8 pb-16">
         <img 
           src={src} 
           alt="Analysis Target" 
           className="max-h-[400px] max-w-full object-contain shadow-2xl rounded-lg transform transition-transform hover:scale-[1.02] duration-500"
         />
       </div>
    </div>
  );
};

// --- Main Component ---

export const PaletteExtractorPage: React.FC = () => {
  const [analysis, setAnalysis] = useState<PaletteAnalysis | null>(null);
  const [selectedColor, setSelectedColor] = useState<ExtractedColor | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef<number>(0);

  const processImage = async (img: HTMLImageElement) => {
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 50)); // Brief delay for UI update
      const result = await analyzeImageForPalette(img, 50); 
      setAnalysis(result);
    } catch (error) {
      console.error("Palette analysis failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const img = new Image();
      img.onload = () => processImage(img);
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      triggerUpload();
    }
    lastTapRef.current = now;
  };

  const uniquePantoneColors = analysis ? getUniquePantoneColors(analysis.colors, 10) : [];

  return (
    <div 
      className="min-h-full pb-24 safe-area-top flex items-start justify-center p-4 lg:p-8"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="w-full max-w-[900px] flex flex-col gap-6">
        
        {/* Main Card */}
        <div className="bg-white rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden ring-1 ring-slate-900/5 min-h-[600px] flex flex-col relative">
            
            {/* Drag Overlay */}
            {isDragging && (
            <div className="absolute inset-0 bg-blue-500/10 z-50 flex items-center justify-center backdrop-blur-md pointer-events-none transition-all">
                <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/50 text-center">
                <Upload className="w-16 h-16 mb-4 mx-auto text-blue-500" />
                <p className="text-xl font-semibold text-slate-800">Drop to Analyze</p>
                </div>
            </div>
            )}

            {/* Top Section: Image Display */}
            <div 
                className={`relative flex-1 bg-slate-50 flex flex-col group cursor-pointer transition-all duration-500 ${!analysis ? 'justify-center items-center' : ''}`}
                onDoubleClick={triggerUpload}
                onTouchEnd={handleTouchEnd}
            >
                {analysis ? (
                <ImageOverlay src={analysis.src} />
                ) : (
                <div 
                    onClick={triggerUpload}
                    className="flex flex-col items-center justify-center text-slate-400 gap-6 p-12 hover:scale-105 transition-transform duration-300"
                >
                    {loading ? (
                        <div className="relative">
                            <div className="w-20 h-20 rounded-full border-4 border-slate-200"></div>
                            <div className="absolute top-0 left-0 w-20 h-20 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                        </div>
                    ) : (
                        <>
                        <div className="w-32 h-32 bg-white rounded-[2rem] flex items-center justify-center shadow-lg ring-1 ring-slate-900/5">
                            <ImageIcon className="w-12 h-12 opacity-20 text-slate-900" />
                        </div>
                        <div className="text-center space-y-2">
                            <h2 className="text-xl font-semibold text-slate-700">Extract Palette</h2>
                            <p className="text-sm text-slate-400">Tap to upload or drop a file</p>
                        </div>
                        </>
                    )}
                </div>
                )}
                
                <input 
                    ref={fileInputRef}
                    type="file" 
                    className="hidden" 
                    onChange={handleInputChange}
                    accept="image/*"
                />
            </div>

            {/* Content Sections (Only visible when analyzed) */}
            {analysis && (
              <>
                {/* Middle Section: Pantone Deck */}
                <div className="relative w-full bg-white -mt-10 rounded-t-[2.5rem] pt-8 z-10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                  <div className="px-8 mb-4 flex justify-between items-end">
                      <h3 className="text-sm font-bold text-slate-900">Extracted Palette</h3>
                      <span className="text-xs text-slate-400 font-medium">{uniquePantoneColors.length} Colors</span>
                  </div>
                  
                  <div className="flex overflow-x-auto pb-8 pt-2 px-6 hide-scrollbar">
                        {uniquePantoneColors.map((color, i) => (
                           <PantoneChip 
                             key={i} 
                             color={color} 
                             onClick={() => setSelectedColor(color)}
                           />
                        ))}
                  </div>
                </div>

                {/* Bottom Section: Metrics */}
                <div className="p-6 md:p-8 bg-white border-t border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 mb-6">Chromatic Data</h3>
                    <MetricsPanel analysis={analysis} />
                </div>
              </>
            )}

        </div>

        {/* Tip */}
        {!analysis && (
          <p className="text-center text-sm text-gray-400 max-w-[300px] mx-auto leading-relaxed">
            Upload any image to extract a Pantone palette. No AI needed - runs locally in your browser.
          </p>
        )}

      </div>

      {/* Detailed Color View Modal */}
      {selectedColor && (
        <DetailedColorModal 
          color={selectedColor} 
          onClose={() => setSelectedColor(null)} 
        />
      )}

    </div>
  );
};

export default PaletteExtractorPage;
