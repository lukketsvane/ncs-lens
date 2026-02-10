<script lang="ts">
  interface Props {
    hue: number;
    onchange: (hue: number) => void;
    size: number;
  }

  let { hue, onchange, size }: Props = $props();

  const STEP = 5;
  
  let ringRef: HTMLDivElement;
  let isDragging = $state(false);
  let preciseHue = $state(hue);
  let lastAngle = $state(0);

  $effect(() => {
    if (!isDragging) {
      preciseHue = hue;
    }
  });

  const thickness = $derived(Math.round(size * 0.13));
  const rotation = $derived(-hue);
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);

  function getAngle(clientX: number, clientY: number): number {
    if (!ringRef) return 0;
    const rect = ringRef.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
  }

  function handlePointerDown(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDragging = true;
    lastAngle = getAngle(e.clientX, e.clientY);
    preciseHue = hue;
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const currentAngle = getAngle(e.clientX, e.clientY);
    
    let delta = currentAngle - lastAngle;
    if (delta < -180) delta += 360;
    if (delta > 180) delta -= 360;
    
    preciseHue -= delta;
    
    const snappedHue = Math.round(preciseHue / STEP) * STEP;
    const normalizedHue = (snappedHue % 360 + 360) % 360;
    
    if (normalizedHue !== hue) {
      onchange(normalizedHue);
    }
    lastAngle = currentAngle;
  }

  function handlePointerUp(e: PointerEvent) {
    isDragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  const majorMarkers = [
    { deg: 0, color: '#FFD700' },
    { deg: 90, color: '#FF4444' },
    { deg: 180, color: '#4444FF' },
    { deg: 270, color: '#22AA22' }
  ];
</script>

<div 
  class="absolute inset-0 flex items-center justify-center rounded-full touch-none select-none"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  style="cursor: {isDragging ? 'grabbing' : 'grab'}"
>
  <div 
    class="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
    style="top: -8px"
  >
    <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-gray-600"></div>
  </div>

  <div 
    bind:this={ringRef}
    class="relative rounded-full will-change-transform"
    style="width: {size}px; height: {size}px; transform: rotate({rotation}deg); transition: {isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'}"
  >
    <div 
      class="absolute inset-0 rounded-full"
      style="background: conic-gradient(#FFDD00 0deg, #FF5555 90deg, #5555FF 180deg, #55BB55 270deg, #FFDD00 360deg); mask-image: radial-gradient(transparent {size/2 - thickness}px, black {size/2 - thickness + 1}px)"
    ></div>
    <div 
      class="absolute inset-0 rounded-full bg-white/40"
      style="mask-image: radial-gradient(transparent {size/2 - thickness}px, black {size/2 - thickness + 1}px)"
    ></div>

    {#each ticks as deg}
      {#if deg % 90 !== 0}
        <div
          class="absolute left-1/2 top-0 origin-bottom"
          style="height: 50%; transform: translateX(-50%) rotate({deg}deg) translateY({thickness - (size * 0.035)}px)"
        >
          <div class="w-1 h-1 rounded-full bg-black/20"></div>
        </div>
      {/if}
    {/each}
    
    {#each majorMarkers as m}
      <div
        class="absolute left-1/2 top-0 origin-bottom"
        style="height: 50%; transform: translateX(-50%) rotate({m.deg}deg) translateY(4px)"
      >
        <div class="w-1 h-3 rounded-full" style="background-color: {m.color}"></div>
      </div>
    {/each}
  </div>
  
  <div 
    class="absolute rounded-full pointer-events-none"
    style="width: {size - thickness * 2}px; height: {size - thickness * 2}px"
  ></div>
</div>
