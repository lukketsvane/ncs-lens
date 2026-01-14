<script lang="ts">
  import { ncsToCss, generateTrianglePoints, type NCSColor } from './utils';

  interface Props {
    color: NCSColor;
    onchange: (blackness: number, chromaticness: number) => void;
    size: number;
  }

  let { color, onchange, size }: Props = $props();

  let svgRef: SVGSVGElement;
  let isDragging = $state(false);

  const paddingX = $derived(size * 0.17);
  const paddingY = $derived(size * 0.17);
  const triWidth = $derived((size - paddingX * 2) * 0.8);
  const triHeight = $derived((size - paddingY * 2) * 0.8);
  const offsetX = $derived((size - triWidth) / 2 + (size * 0.03));
  const offsetY = $derived((size - triHeight) / 2);
  const baseScale = $derived(size / 350);
  const dotRadius = $derived(3.5 * Math.max(0.7, baseScale));
  const cursorScale = $derived(Math.max(0.4, baseScale * 0.65));
  const points = generateTrianglePoints();

  function getCoordinates(s: number, c: number): { x: number; y: number } {
    const x = (c / 100) * triWidth;
    const y = (s / 100) * triHeight + (c / 100) * (triHeight / 2);
    return { x: x + offsetX, y: y + offsetY };
  }

  function getValueFromCoords(x: number, y: number): { s: number; c: number } {
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
  }

  function handlePointer(e: PointerEvent) {
    if (!svgRef) return;
    const rect = svgRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const { s, c } = getValueFromCoords(x, y);
    onchange(s, c);
  }

  function handlePointerDown(e: PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    e.stopPropagation();
    isDragging = true;
    handlePointer(e);
  }

  function handlePointerMove(e: PointerEvent) {
    if (isDragging) handlePointer(e);
  }

  function handlePointerUp(e: PointerEvent) {
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    isDragging = false;
  }

  const currentPos = $derived(getCoordinates(color.blackness, color.chromaticness));
  const pW = $derived(getCoordinates(0, 0));
  const pS = $derived(getCoordinates(100, 0));
  const pC = $derived(getCoordinates(0, 100));

  function getGridLines() {
    const lines: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }> = [];
    for (let c = 10; c < 100; c += 10) {
      const start = getCoordinates(0, c);
      const end = getCoordinates(100 - c, c);
      lines.push({ key: `v-${c}`, x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    }
    for (let s = 10; s < 100; s += 10) {
      const start = getCoordinates(s, 0);
      const end = getCoordinates(s, 100 - s);
      lines.push({ key: `h-${s}`, x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    }
    return lines;
  }

  const gridLines = $derived(getGridLines());
</script>

<div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
  <svg bind:this={svgRef} width={size} height={size} class="touch-none">
    <defs>
      <filter id="cursorShadow" x="-50%" y="-20%" width="200%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3" />
      </filter>
    </defs>
    
    <g 
      class="cursor-pointer"
      style="pointer-events: auto"
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
    >
      <path 
        d="M {pW.x} {pW.y} L {pS.x} {pS.y} L {pC.x} {pC.y} Z" 
        fill="#f8f8f8" 
        stroke="#dddddd" 
        stroke-width="1" 
        stroke-linejoin="round"
      />
    </g>
    
    {#each gridLines as line (line.key)}
      <line 
        x1={line.x1} 
        y1={line.y1} 
        x2={line.x2} 
        y2={line.y2} 
        stroke="#e5e5e5" 
        stroke-width="1" 
        pointer-events="none" 
      />
    {/each}
    
    {#each points as pt, i}
      {@const pos = getCoordinates(pt.s, pt.c)}
      {@const dotColor = ncsToCss({ hue: color.hue, blackness: pt.s, chromaticness: pt.c })}
      <circle 
        cx={pos.x} 
        cy={pos.y} 
        r={dotRadius} 
        fill={dotColor}
        class="transition-colors duration-200" 
        pointer-events="none"
      />
    {/each}
    
    <g 
      transform="translate({currentPos.x}, {currentPos.y}) scale({cursorScale})" 
      style="transition: {isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)'}; pointer-events: auto"
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      class="cursor-grab active:cursor-grabbing"
    >
      <path d="M 0 16 Q -16 26, -16 42 A 16 16 0 1 0 16 42 Q 16 26, 0 16 Z" fill="#8e8e93" filter="url(#cursorShadow)" />
      <g transform="translate(0, 44)" fill="rgba(255,255,255,0.4)">
        <circle cx="-5" cy="-4" r="1.5" />
        <circle cx="0" cy="-4" r="1.5" />
        <circle cx="5" cy="-4" r="1.5" />
        <circle cx="-5" cy="4" r="1.5" />
        <circle cx="0" cy="4" r="1.5" />
        <circle cx="5" cy="4" r="1.5" />
      </g>
      <rect x="-14" y="-14" width="28" height="28" fill="none" stroke="#333" stroke-width="1.5" />
      <circle cx="0" cy="0" r="5" fill={ncsToCss(color)} stroke="none" />
    </g>
  </svg>
</div>
