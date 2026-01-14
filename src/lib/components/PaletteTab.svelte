<script lang="ts">
  import { Upload, Image as ImageIcon, ChevronLeft, Heart, Share2, Copy, Check, Loader2 } from 'lucide-svelte';
  import { 
    analyzeImageForPalette, 
    getUniquePantoneColors, 
    hexToRgb, 
    calculateLRV, 
    calculateCMYK,
    type ExtractedColor,
    type PaletteAnalysis
  } from '$lib/pantone-colors';

  let analysis = $state<PaletteAnalysis | null>(null);
  let selectedColor = $state<ExtractedColor | null>(null);
  let isDragging = $state(false);
  let loading = $state(false);
  let fileInput: HTMLInputElement;
  let lastTap = 0;
  let copied = $state<string | null>(null);

  function processImage(img: HTMLImageElement) {
    loading = true;
    setTimeout(async () => {
      try {
        const result = await analyzeImageForPalette(img, 50);
        analysis = result;
      } catch (error) {
        console.error("Palette analysis failed:", error);
      } finally {
        loading = false;
      }
    }, 50);
  }

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const img = new Image();
      img.onload = () => processImage(img);
      img.src = result;
    };
    reader.readAsDataURL(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    if (e.dataTransfer?.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  function handleInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files?.[0]) {
      handleFile(target.files[0]);
    }
  }

  function triggerUpload() {
    fileInput?.click();
  }

  function handleTouchEnd(e: TouchEvent) {
    const now = Date.now();
    if (now - lastTap < 300) {
      triggerUpload();
    }
    lastTap = now;
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    copied = key;
    setTimeout(() => copied = null, 2000);
  }

  function getContrastClass(color: ExtractedColor): string {
    const luminance = (0.299 * color.rgb.r + 0.587 * color.rgb.g + 0.114 * color.rgb.b) / 255;
    return luminance > 0.5 ? 'text-slate-900' : 'text-white';
  }

  function getSubContrastClass(color: ExtractedColor): string {
    const luminance = (0.299 * color.rgb.r + 0.587 * color.rgb.g + 0.114 * color.rgb.b) / 255;
    return luminance > 0.5 ? 'text-slate-600' : 'text-white/70';
  }

  const uniquePantoneColors = $derived(analysis ? getUniquePantoneColors(analysis.colors, 10) : []);
</script>

<div 
  class="min-h-full pb-24 safe-area-top flex items-start justify-center p-4 lg:p-8"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <div class="w-full max-w-[900px] flex flex-col gap-6">
    
    <!-- Main Card -->
    <div class="bg-white rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden ring-1 ring-slate-900/5 min-h-[600px] flex flex-col relative">
        
        {#if isDragging}
          <div class="absolute inset-0 bg-blue-500/10 z-50 flex items-center justify-center backdrop-blur-md pointer-events-none transition-all">
            <div class="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/50 text-center">
              <Upload class="w-16 h-16 mb-4 mx-auto text-blue-500" />
              <p class="text-xl font-semibold text-slate-800">Drop to Analyze</p>
            </div>
          </div>
        {/if}

        <!-- Top Section: Image Display -->
        <button
          class="relative flex-1 bg-slate-50 flex flex-col group cursor-pointer transition-all duration-500 {analysis ? '' : 'justify-center items-center'}"
          ondblclick={triggerUpload}
          ontouchend={handleTouchEnd}
        >
          {#if analysis}
            <div class="relative w-full h-full flex items-center justify-center overflow-hidden select-none bg-slate-50 rounded-t-[2.5rem]">
              <div class="relative w-full h-full flex items-center justify-center p-8 pb-16">
                <img 
                  src={analysis.src} 
                  alt="Analysis Target" 
                  class="max-h-[400px] max-w-full object-contain shadow-2xl rounded-lg transform transition-transform hover:scale-[1.02] duration-500"
                />
              </div>
            </div>
          {:else}
            <div 
              onclick={triggerUpload}
              class="flex flex-col items-center justify-center text-slate-400 gap-6 p-12 hover:scale-105 transition-transform duration-300"
            >
              {#if loading}
                <div class="relative">
                  <div class="w-20 h-20 rounded-full border-4 border-slate-200"></div>
                  <div class="absolute top-0 left-0 w-20 h-20 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                </div>
              {:else}
                <div class="w-32 h-32 bg-white rounded-[2rem] flex items-center justify-center shadow-lg ring-1 ring-slate-900/5">
                  <ImageIcon class="w-12 h-12 opacity-20 text-slate-900" />
                </div>
                <div class="text-center space-y-2">
                  <h2 class="text-xl font-semibold text-slate-700">Extract Palette</h2>
                  <p class="text-sm text-slate-400">Tap to upload or drop a file</p>
                </div>
              {/if}
            </div>
          {/if}
          
          <input 
            bind:this={fileInput}
            type="file" 
            class="hidden" 
            onchange={handleInputChange}
            accept="image/*"
          />
        </button>

        {#if analysis}
          <!-- Middle Section: Pantone Deck -->
          <div class="relative w-full bg-white -mt-10 rounded-t-[2.5rem] pt-8 z-10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
            <div class="px-8 mb-4 flex justify-between items-end">
              <h3 class="text-sm font-bold text-slate-900">Extracted Palette</h3>
              <span class="text-xs text-slate-400 font-medium">{uniquePantoneColors.length} Colors</span>
            </div>
            
            <div class="flex overflow-x-auto pb-8 pt-2 px-6 no-scrollbar">
              {#each uniquePantoneColors as color, i}
                <button 
                  onclick={() => selectedColor = color}
                  class="flex-shrink-0 w-28 h-40 bg-white shadow-sm rounded-xl overflow-hidden flex flex-col transition-all hover:scale-105 active:scale-95 mx-2 ring-1 ring-black/5 text-left group"
                >
                  <div class="h-24 w-full" style="background-color: {color.pantone.hex}"></div>
                  <div class="flex-1 p-3 flex flex-col justify-center bg-white">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pantone</p>
                    <p class="text-xs font-bold text-slate-900 leading-tight">{color.pantone.code}</p>
                    <p class="text-[10px] text-slate-500 truncate mt-1">{color.pantone.name}</p>
                  </div>
                </button>
              {/each}
            </div>
          </div>

          <!-- Bottom Section: Metrics -->
          <div class="p-6 md:p-8 bg-white border-t border-slate-100">
            <h3 class="text-sm font-bold text-slate-900 mb-6">Chromatic Data</h3>
            <div class="w-full flex flex-col">
              <div class="flex justify-between items-center py-3.5 border-b border-slate-50">
                <span class="text-slate-500 text-xs font-medium uppercase tracking-wide">Avg Lightness</span>
                <span class="font-semibold text-slate-700 tabular-nums text-sm">{(analysis.avgLightness * 100).toFixed(1)}%</span>
              </div>
              <div class="flex justify-between items-center py-3.5 border-b border-slate-50">
                <span class="text-slate-500 text-xs font-medium uppercase tracking-wide">Avg Chroma</span>
                <span class="font-semibold text-slate-700 tabular-nums text-sm">{analysis.avgChroma.toFixed(3)}</span>
              </div>
              <div class="flex justify-between items-center py-3.5 border-b border-slate-50">
                <span class="text-slate-500 text-xs font-medium uppercase tracking-wide">Bias (Color)</span>
                <span class="font-semibold text-slate-700 tabular-nums text-sm">{analysis.colorfulnessBias.toFixed(2)}</span>
              </div>
              <div class="flex justify-between items-center py-3.5 border-b border-slate-50">
                <span class="text-slate-500 text-xs font-medium uppercase tracking-wide">Bias (Light)</span>
                <span class="font-semibold text-slate-700 tabular-nums text-sm">{analysis.lightDarkBias.toFixed(2)}</span>
              </div>
              <div class="flex justify-between items-center py-3.5">
                <span class="text-slate-500 text-xs font-medium uppercase tracking-wide">Diversity</span>
                <span class="font-semibold text-slate-700 tabular-nums text-sm">{analysis.sparseColor ? 'High' : 'Low'}</span>
              </div>
            </div>
          </div>
        {/if}

    </div>

    {#if !analysis}
      <p class="text-center text-sm text-gray-400 max-w-[300px] mx-auto leading-relaxed">
        Upload any image to extract a Pantone palette. No AI needed - runs locally in your browser.
      </p>
    {/if}

  </div>

  <!-- Detailed Color View Modal -->
  {#if selectedColor}
    {@const pantoneRgb = hexToRgb(selectedColor.pantone.hex)}
    {@const cmyk = calculateCMYK(pantoneRgb)}
    {@const lrv = calculateLRV(pantoneRgb)}
    {@const textColorClass = getContrastClass(selectedColor)}
    {@const subTextColorClass = getSubContrastClass(selectedColor)}
    
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-white sm:p-4">
      <div class="w-full h-full max-w-md bg-white sm:rounded-[2rem] sm:h-[90vh] sm:shadow-2xl overflow-hidden flex flex-col relative ring-1 ring-black/5">
        
        <!-- Header Color Block -->
        <div 
          class="h-[40%] w-full relative transition-colors duration-500"
          style="background-color: {selectedColor.pantone.hex}"
        >
          <div class="absolute top-0 left-0 w-full p-6 flex justify-between items-center {textColorClass}">
            <button onclick={() => selectedColor = null} class="p-2 -ml-2 rounded-full hover:bg-black/10 transition-colors">
              <ChevronLeft size={24} />
            </button>
            <div class="flex gap-4">
              <button class="p-2 rounded-full hover:bg-black/10 transition-colors"><Heart size={20} /></button>
              <button class="p-2 rounded-full hover:bg-black/10 transition-colors"><Share2 size={20} /></button>
            </div>
          </div>

          <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none {textColorClass}">
            <h2 class="text-4xl font-bold tracking-tight mb-2">PANTONE</h2>
            <p class="text-lg font-medium tracking-wide opacity-90">{selectedColor.pantone.code}</p>
          </div>
        </div>

        <!-- Content Section -->
        <div class="flex-1 flex flex-col bg-white">
          <div class="flex border-b border-slate-100 px-2">
            {#each ['Details', 'Context', 'Compare', 'Fine Tune'] as tab, i}
              <div class="flex-1 py-4 text-center text-sm font-medium cursor-pointer relative {i === 0 ? 'text-slate-900' : 'text-slate-400'}">
                {tab}
                {#if i === 0}
                  <div class="absolute bottom-0 left-0 w-full h-[2px] bg-slate-900"></div>
                {/if}
              </div>
            {/each}
          </div>

          <div class="flex-1 overflow-y-auto p-6 space-y-8">
            <div class="flex justify-between items-baseline">
              <span class="text-slate-500 text-sm font-medium">Name</span>
              <span class="text-slate-900 font-bold text-lg">{selectedColor.pantone.name}</span>
            </div>

            <div class="flex justify-between items-baseline">
              <span class="text-slate-500 text-sm font-medium">Collection</span>
              <span class="text-slate-900 font-medium">Pantone Connect</span>
            </div>

            <div>
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Technical Data</h3>
              
              <div class="space-y-4">
                <div class="flex justify-between items-center py-2 border-b border-slate-50">
                  <span class="text-slate-500 text-sm">LRV (D65)</span>
                  <span class="text-slate-900 font-mono font-medium">{lrv}</span>
                </div>

                <div class="flex justify-between items-center py-2 border-b border-slate-50">
                  <span class="text-slate-500 text-sm">CMYK</span>
                  <span class="text-slate-900 font-mono font-medium">{cmyk.c}, {cmyk.m}, {cmyk.y}, {cmyk.k}</span>
                </div>

                <div class="flex justify-between items-center py-2 border-b border-slate-50">
                  <span class="text-slate-500 text-sm">RGB</span>
                  <span class="text-slate-900 font-mono font-medium">{pantoneRgb.r}, {pantoneRgb.g}, {pantoneRgb.b}</span>
                </div>

                <button 
                  class="flex justify-between items-center py-2 border-b border-slate-50 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded w-full"
                  onclick={() => copyToClipboard(selectedColor!.pantone.hex.toUpperCase(), 'hex')}
                >
                  <span class="text-slate-500 text-sm">HEX</span>
                  <div class="flex items-center gap-2">
                    <span class="text-slate-900 font-mono font-medium uppercase">{selectedColor.pantone.hex}</span>
                    {#if copied === 'hex'}
                      <Check size={12} class="text-green-500" />
                    {:else}
                      <Copy size={12} class="text-slate-400" />
                    {/if}
                  </div>
                </button>
              </div>
            </div>

          </div>

          <div class="p-6 border-t border-slate-100 bg-white pb-8 sm:pb-6">
            <button class="w-full bg-slate-900 text-white font-medium py-4 rounded-xl shadow-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
              <span>Find Similar Colors</span>
              <span class="bg-white/20 px-1.5 py-0.5 rounded text-xs">10</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  {/if}

</div>
