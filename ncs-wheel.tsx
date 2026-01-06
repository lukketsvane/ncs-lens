import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

// --- Types ---
export interface NCSColor {
  hue: number; // 0-360 degrees
  blackness: number; // 0-100
  chromaticness: number; // 0-100
}

export interface Point {
  x: number;
  y: number;
}

// --- Utils ---
export const degreesToNcsHue = (degrees: number): string => {
  let d = degrees % 360;
  if (d < 0) d += 360;

  const percent = Math.round((d % 90) / 90 * 100);
  
  if (d === 0) return 'Y';
  if (d === 90) return 'R';
  if (d === 180) return 'B';
  if (d === 270) return 'G';

  if (d < 90) return `Y${percent}R`;
  if (d < 180) return `R${percent}B`;
  if (d < 270) return `B${percent}G`;
  return `G${percent}Y`;
};

export const ncsToCss = (color: NCSColor): string => {
  const { hue, blackness, chromaticness } = color;
  
  let cssHue = 0;
  let d = hue % 360;
  if (d < 0) d += 360;

  if (d <= 90) { 
    const t = d / 90;
    cssHue = 60 - t * 60;
  } else if (d <= 180) {
    const t = (d - 90) / 90;
    cssHue = 360 - t * 120;
  } else if (d <= 270) {
    const t = (d - 180) / 90;
    cssHue = 240 - t * 120;
  } else {
    const t = (d - 270) / 90;
    cssHue = 120 - t * 60;
  }

  const l = Math.max(0, 100 - blackness - (chromaticness * 0.5));
  let s = 0;
  if (chromaticness > 0) {
      s = Math.min(100, chromaticness * 1.5); 
  }

  return `hsl(${cssHue.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`;
};

export const generateTrianglePoints = () => {
  const points: {s: number, c: number}[] = [];
  const step = 10;
  for (let s = 0; s <= 100; s += step) {
    for (let c = 0; c <= 100; c += step) {
      if (s + c <= 100) {
        points.push({ s, c });
      }
    }
  }
  return points;
};

// --- Components ---

// HueRing
interface HueRingProps {
  hue: number;
  onChange: (hue: number) => void;
  size: number;
}

const STEP = 5;

const HueRing: React.FC<HueRingProps> = ({ hue, onChange, size }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Track precise hue to avoid floating point drift when snapping
  const preciseHue = useRef(hue);
  const lastAngle = useRef(0);
  
  useEffect(() => {
    if (!isDragging) {
      preciseHue.current = hue;
    }
  }, [hue, isDragging]);

  const thickness = Math.round(size * 0.13);
  
  const getAngle = (clientX: number, clientY: number) => {
    if (!ref.current) return 0;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    // atan2 returns angle in degrees (-180 to 180)
    return Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    lastAngle.current = getAngle(e.clientX, e.clientY);
    preciseHue.current = hue;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const currentAngle = getAngle(e.clientX, e.clientY);
    
    // Calculate delta and handle wrapping for infinite scrolling
    let delta = currentAngle - lastAngle.current;
    if (delta < -180) delta += 360;
    if (delta > 180) delta -= 360;
    
    // Rotation = -Hue, so positive delta (clockwise) means hue decreases
    preciseHue.current -= delta;
    
    const snappedHue = Math.round(preciseHue.current / STEP) * STEP;
    const normalizedHue = (snappedHue % 360 + 360) % 360;
    
    if (normalizedHue !== hue) {
       onChange(normalizedHue);
    }
    lastAngle.current = currentAngle;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Visual rotation matches the negative of the hue so the selected hue is at top (12 o'clock)
  const rotation = -hue;
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);

  return (
    <div 
      className="absolute inset-0 flex items-center justify-center rounded-full touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
        <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            style={{ top: -8 }}
        >
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-gray-600" />
        </div>

        <div 
            ref={ref}
            className="relative rounded-full will-change-transform"
            style={{ 
                width: size, 
                height: size,
                transform: `rotate(${rotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
        >
            <div 
                className="absolute inset-0 rounded-full"
                style={{
                    background: `conic-gradient(#FFDD00 0deg, #FF5555 90deg, #5555FF 180deg, #55BB55 270deg, #FFDD00 360deg)`,
                    maskImage: `radial-gradient(transparent ${size/2 - thickness}px, black ${size/2 - thickness + 1}px)`
                }}
            />
             <div 
                className="absolute inset-0 rounded-full bg-white/40"
                style={{
                     maskImage: `radial-gradient(transparent ${size/2 - thickness}px, black ${size/2 - thickness + 1}px)`
                }}
             />

            {ticks.map((deg) => {
                const isMajor = deg % 90 === 0;
                if (isMajor) return null;
                return (
                    <div
                        key={deg}
                        className="absolute left-1/2 top-0 origin-bottom"
                        style={{
                            height: '50%',
                            transform: `translateX(-50%) rotate(${deg}deg) translateY(${thickness - (size * 0.035)}px)`
                        }}
                    >
                        <div className="w-1 h-1 rounded-full bg-black/20" />
                    </div>
                );
            })}
            
            {[
                { deg: 0, color: '#FFD700' },
                { deg: 90, color: '#FF4444' },
                { deg: 180, color: '#4444FF' },
                { deg: 270, color: '#22AA22' }
            ].map((m) => (
                 <div
                    key={m.deg}
                    className="absolute left-1/2 top-0 origin-bottom"
                    style={{
                        height: '50%',
                        transform: `translateX(-50%) rotate(${m.deg}deg) translateY(4px)`
                    }}
                 >
                    <div className="w-1 h-3 rounded-full shadow-sm" style={{ backgroundColor: m.color }} />
                 </div>
            ))}
        </div>
        
        <div 
            className="absolute rounded-full pointer-events-none shadow-[inset_0_0_15px_rgba(0,0,0,0.1)]"
            style={{
                width: size - thickness * 2,
                height: size - thickness * 2,
            }}
        />
    </div>
  );
};

// TrianglePicker
interface TrianglePickerProps {
  color: NCSColor;
  onChange: (s: number, c: number) => void;
  size: number;
}

const TrianglePicker: React.FC<TrianglePickerProps> = ({ color, onChange, size }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const paddingX = size * 0.17; 
  const paddingY = size * 0.17;
  const triWidth = (size - paddingX * 2) * 0.8; 
  const triHeight = (size - paddingY * 2) * 0.8;
  const offsetX = (size - triWidth) / 2 + (size * 0.03); 
  const offsetY = (size - triHeight) / 2;
  const baseScale = size / 350;
  const dotRadius = 3.5 * Math.max(0.7, baseScale);
  const cursorScale = Math.max(0.4, baseScale * 0.65);

  const getCoordinates = (s: number, c: number): Point => {
    const x = (c / 100) * triWidth;
    const y = (s / 100) * triHeight + (c / 100) * (triHeight / 2);
    return { x: x + offsetX, y: y + offsetY };
  };

  const getValueFromCoords = (x: number, y: number): { s: number, c: number } => {
    const relX = x - offsetX;
    const relY = y - offsetY;
    let c = (relX / triWidth) * 100;
    let s = (relY - (relX / triWidth) * (triHeight / 2)) / triHeight * 100;

    c = Math.max(0, Math.min(100, c));
    s = Math.max(0, Math.min(100, s));
    
    if (s + c > 100) {
      const diff = s + c - 100;
      s -= diff / 2;
      c -= diff / 2;
    }
    
    return { s: Math.round(s / 5) * 5, c: Math.round(c / 5) * 5 };
  };

  const handlePointer = (e: React.PointerEvent | PointerEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const { s, c } = getValueFromCoords(x, y);
    onChange(s, c);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation(); 
    setIsDragging(true);
    handlePointer(e);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (isDragging) handlePointer(e);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  const points = generateTrianglePoints(); 
  const currentPos = getCoordinates(color.blackness, color.chromaticness);
  
  const pW = getCoordinates(0, 0);   
  const pS = getCoordinates(100, 0); 
  const pC = getCoordinates(0, 100); 

  const renderGridLines = () => {
    const lines = [];
    for (let c = 10; c < 100; c += 10) {
        const start = getCoordinates(0, c);
        const end = getCoordinates(100 - c, c);
        lines.push(<line key={`v-${c}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#e5e5e5" strokeWidth="1" pointerEvents="none" />);
    }
    for (let s = 10; s < 100; s += 10) {
        const start = getCoordinates(s, 0);
        const end = getCoordinates(s, 100 - s);
        lines.push(<line key={`h-${s}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#e5e5e5" strokeWidth="1" pointerEvents="none" />);
    }
    return lines;
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
       <svg ref={svgRef} width={size} height={size} className="touch-none">
        <defs>
          <filter id="cursorShadow" x="-50%" y="-20%" width="200%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.3" />
          </filter>
        </defs>
        <g 
          className="cursor-pointer"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ pointerEvents: 'auto' }}
        >
            <path 
                d={`M ${pW.x} ${pW.y} L ${pS.x} ${pS.y} L ${pC.x} ${pC.y} Z`} 
                fill="#f8f8f8" stroke="#dddddd" strokeWidth="1" strokeLinejoin="round"
            />
        </g>
        {renderGridLines()}
        {points.map((pt, i) => {
          const pos = getCoordinates(pt.s, pt.c);
          const dotColor = ncsToCss({ hue: color.hue, blackness: pt.s, chromaticness: pt.c });
          return (
            <circle 
              key={i} cx={pos.x} cy={pos.y} r={dotRadius} fill={dotColor}
              className="transition-colors duration-200" pointerEvents="none"
            />
          );
        })}
        <g 
          transform={`translate(${currentPos.x}, ${currentPos.y}) scale(${cursorScale})`} 
          style={{ transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)', pointerEvents: 'auto' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="cursor-grab active:cursor-grabbing"
        >
          <path d="M 0 16 Q -16 26, -16 42 A 16 16 0 1 0 16 42 Q 16 26, 0 16 Z" fill="#8e8e93" filter="url(#cursorShadow)" />
           <g transform="translate(0, 44)" fill="rgba(255,255,255,0.4)">
             <circle cx="-5" cy="-4" r="1.5" /> <circle cx="0" cy="-4" r="1.5" /> <circle cx="5" cy="-4" r="1.5" />
             <circle cx="-5" cy="4" r="1.5" /> <circle cx="0" cy="4" r="1.5" /> <circle cx="5" cy="4" r="1.5" />
           </g>
          <rect x="-14" y="-14" width="28" height="28" fill="none" stroke="#333" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="5" fill={ncsToCss(color)} stroke="none" />
        </g>
      </svg>
    </div>
  );
};

// ColorHeader
const ColorHeader: React.FC<{ color: NCSColor }> = ({ color }) => {
  const ncsHue = degreesToNcsHue(color.hue);
  const sStr = Math.round(color.blackness).toString().padStart(2, '0');
  const cStr = Math.round(color.chromaticness).toString().padStart(2, '0');
  const isNeutral = color.chromaticness < 2;

  const bgColor = ncsToCss(color);
  const isDark = color.blackness > 40; 
  const textColor = isDark ? "text-white" : "text-gray-900";
  const labelColor = isDark ? "text-white/60" : "text-gray-600";
  const arrowColor = isDark ? "text-white/40" : "text-black/20";
  const dividerOpacity = isDark ? "opacity-40" : "opacity-20";

  return (
    <div 
      className="w-full pt-10 pb-8 px-6 transition-colors duration-300 relative z-20 shadow-sm"
      style={{ backgroundColor: bgColor }}
    >
      <div className={`max-w-md mx-auto flex items-center justify-between font-sans ${textColor}`}>
        <div className="flex flex-col">
           <div className={`flex gap-6 text-[10px] font-bold tracking-widest uppercase mb-1 ${labelColor}`}>
             <span>Blackness</span><span>Chroma</span>
           </div>
           <div className="flex items-baseline gap-2">
             <span className="text-6xl font-light">S</span>
             <div className="flex gap-3 ml-2">
               <span className="text-6xl font-normal tracking-tight">{sStr}</span>
               <span className="text-6xl font-normal tracking-tight">{cStr}</span>
             </div>
           </div>
           <div className={`text-[10px] mt-2 font-medium tracking-wide text-center w-full ${labelColor}`}>(nuance)</div>
        </div>
        <div className={`text-6xl font-light ${dividerOpacity} pb-6`}>-</div>
        <div className="flex flex-col items-center min-w-[100px]">
           <div className={`text-[10px] font-bold tracking-widest uppercase mb-1 ${labelColor}`}>{isNeutral ? 'Neutral' : 'Hue'}</div>
           <div className="flex items-center justify-center h-[60px]">
             <span className="text-5xl font-normal tracking-tight whitespace-nowrap">{isNeutral ? 'N' : ncsHue.replace(/(\d+)/, '$1')}</span>
           </div>
           <div className={`text-[10px] mt-2 font-medium tracking-wide ${labelColor}`}>(hue)</div>
        </div>
        <div className="ml-1"><ChevronRight size={48} strokeWidth={2} className={arrowColor} /></div>
      </div>
    </div>
  );
};

// Palette
const Palette: React.FC<{ currentColor: NCSColor }> = ({ currentColor }) => {
  const presets = [
    { s: 5, c: 5 }, { s: 10, c: 10 }, { s: 20, c: 20 }, { s: 10, c: 50 },
    { s: 30, c: 30 }, { s: 40, c: 40 }, { s: 60, c: 20 }, { s: 80, c: 0 },
  ];

  return (
    <div className="w-full px-6 py-10">
      <div className="max-w-md mx-auto flex justify-center items-center gap-5">
        {presets.slice(0, 4).map((item, idx) => (
           <div key={`l-${idx}`} className="w-3 h-3 rounded-full" style={{ backgroundColor: ncsToCss({ ...currentColor, blackness: item.s, chromaticness: item.c }) }} />
        ))}
        <div className="w-8 h-8 flex items-center justify-center border border-gray-400/50 rounded-sm">
           <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ncsToCss(currentColor) }} />
        </div>
        {presets.slice(4, 8).map((item, idx) => (
           <div key={`r-${idx}`} className="w-3 h-3 rounded-full" style={{ backgroundColor: ncsToCss({ ...currentColor, blackness: item.s, chromaticness: item.c }) }} />
        ))}
      </div>
      <div className="flex justify-center gap-2 mt-6 opacity-30">
          <div className="w-1.5 h-1.5 rounded-full bg-black"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
      </div>
    </div>
  );
};

// Main App
const App: React.FC = () => {
  const [color, setColor] = useState<NCSColor>({ hue: 80, blackness: 30, chromaticness: 40 });
  const handleHueChange = (newHue: number) => setColor(prev => ({ ...prev, hue: newHue }));
  const handleNuanceChange = (s: number, c: number) => setColor(prev => ({ ...prev, blackness: s, chromaticness: c }));

  const ringSize = 320; 
  const triangleSize = 260;

  return (
    <div className="min-h-screen bg-[#f2f2f2] flex flex-col items-center select-none overflow-hidden font-sans text-slate-800">
      <ColorHeader color={color} />
      <div className="flex-grow flex flex-col items-center justify-center w-full max-w-md relative p-4">
        <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
          <HueRing hue={color.hue} onChange={handleHueChange} size={ringSize} />
          <TrianglePicker color={color} onChange={handleNuanceChange} size={triangleSize} />
        </div>
      </div>
      <Palette currentColor={color} />
    </div>
  );
};

export default App;