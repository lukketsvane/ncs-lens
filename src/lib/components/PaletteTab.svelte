<script lang="ts">
  import { Upload, Loader2, X, Crosshair, Pipette } from 'lucide-svelte';
  import { t } from '$lib/i18n';
  import { selectedPaletteColor } from '$lib/stores/app';
  import {
    analyzeImageForPalette,
    getUniquePantoneColors,
    findNearestPantone,
    type PaletteAnalysis
  } from '$lib/pantone-colors';

  let analysis = $state<PaletteAnalysis | null>(null);
  let isDragging = $state(false);
  let loading = $state(false);
  let fileInput: HTMLInputElement;
  let lastTap = 0;
  let showExtractionPoints = $state(true);
  let pickerMode = $state(false);
  let pickedColor = $state<{ x: number; y: number; hex: string; pantone: { code: string; name: string; hex: string } } | null>(null);
  let imageCanvas = $state<HTMLCanvasElement | null>(null);
  let imageRef = $state<HTMLImageElement | null>(null);

  function processImage(img: HTMLImageElement) {
    loading = true;
    setTimeout(async () => {
      try {
        const result = await analyzeImageForPalette(img, 50);
        analysis = result;
        cacheImageCanvas(img);
      } catch (error) {
        console.error("Palette analysis failed:", error);
      } finally {
        loading = false;
      }
    }, 50);
  }

  function cacheImageCanvas(img: HTMLImageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      imageCanvas = canvas;
    }
  }

  function pickColorFromImage(e: MouseEvent | TouchEvent) {
    if (!pickerMode || !imageCanvas || !imageRef) return;
    const rect = imageRef.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return;

    const canvasX = Math.floor(relX * imageCanvas.width);
    const canvasY = Math.floor(relY * imageCanvas.height);
    const ctx = imageCanvas.getContext('2d');
    if (!ctx) return;
    const pixel = ctx.getImageData(canvasX, canvasY, 1, 1).data;
    const hex = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`;
    const nearest = findNearestPantone({ r: pixel[0], g: pixel[1], b: pixel[2] });
    pickedColor = {
      x: relX * 100,
      y: relY * 100,
      hex,
      pantone: nearest
    };
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

  function clearAnalysis() {
    if (analysis?.src?.startsWith('blob:')) URL.revokeObjectURL(analysis.src);
    analysis = null;
    selectedPaletteColor.set(null);
    imageCanvas = null;
    imageRef = null;
    pickedColor = null;
    pickerMode = false;
  }

  const uniquePantoneColors = $derived(analysis ? getUniquePantoneColors(analysis.colors, 10) : []);
</script>

<div
  class="min-h-full pb-24 safe-area-top"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <div class="p-4">
    <h1 class="text-2xl font-bold tracking-tight mb-6 px-1">{$t('palette.title')}</h1>
  </div>
  <div class="w-full max-w-[900px] mx-auto flex flex-col gap-6 px-4 lg:px-8">

    <!-- Main Card -->
    <div class="bg-white rounded-[2.5rem] overflow-hidden ring-1 ring-slate-900/5 min-h-[600px] flex flex-col relative">

        {#if isDragging}
          <div class="absolute inset-0 bg-blue-500/10 z-50 flex items-center justify-center backdrop-blur-md pointer-events-none transition-all">
            <div class="bg-white/80 backdrop-blur-xl p-8 rounded-3xl border border-white/50 text-center">
              <Upload class="w-16 h-16 mb-4 mx-auto text-blue-500" />
              <p class="text-xl font-semibold text-slate-800">{$t('palette.drop_to_analyze')}</p>
            </div>
          </div>
        {/if}

        <!-- Top Section: Image Display -->
        {#if analysis}
          <div class="relative flex-1 bg-slate-50 flex flex-col group transition-all duration-500">
            <div class="relative w-full h-full flex items-center justify-center overflow-hidden select-none bg-slate-50 rounded-t-[2.5rem]">
              <div class="absolute top-4 right-4 z-10 flex gap-2">
                <button
                  onclick={() => showExtractionPoints = !showExtractionPoints}
                  class="p-2 backdrop-blur-md rounded-full transition-colors {showExtractionPoints ? 'bg-blue-500 text-white' : 'bg-black/20 text-white hover:bg-black/40'}"
                  title={$t('palette.show_points')}
                >
                  <Crosshair size={18} />
                </button>
                <button
                  onclick={() => { pickerMode = !pickerMode; if (!pickerMode) pickedColor = null; }}
                  class="p-2 backdrop-blur-md rounded-full transition-colors {pickerMode ? 'bg-blue-500 text-white' : 'bg-black/20 text-white hover:bg-black/40'}"
                  title={$t('palette.pick_color')}
                >
                  <Pipette size={18} />
                </button>
                <button
                  onclick={clearAnalysis}
                  class="p-2 bg-black/20 text-white rounded-full hover:bg-black/40 backdrop-blur-md transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div
                class="relative w-full h-full flex items-center justify-center p-8 pb-16"
                role={pickerMode ? 'button' : undefined}
                tabindex={pickerMode ? 0 : undefined}
                onclick={pickerMode ? pickColorFromImage : undefined}
                ontouchmove={pickerMode ? pickColorFromImage : undefined}
              >
                <div class="relative inline-block">
                  <img
                    bind:this={imageRef}
                    src={analysis.src}
                    alt="Analysis Target"
                    class="max-h-[400px] max-w-full object-contain rounded-lg transform transition-transform duration-500 {pickerMode ? 'cursor-crosshair' : 'hover:scale-[1.02]'}"
                    onload={(e) => { if (!imageCanvas) cacheImageCanvas(e.currentTarget as HTMLImageElement); }}
                  />
                  {#if showExtractionPoints && !pickerMode}
                    {#each analysis.colors as color}
                      <button
                        class="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2 hover:scale-150 transition-transform z-10"
                        style="left: {color.x * 100}%; top: {color.y * 100}%; background-color: {color.hex}"
                        onclick={(e) => { e.stopPropagation(); selectedPaletteColor.set(color); }}
                      ></button>
                    {/each}
                  {/if}
                  {#if pickedColor}
                    <div
                      class="absolute z-20 -translate-x-1/2 -translate-y-full pointer-events-none"
                      style="left: {pickedColor.x}%; top: {pickedColor.y}%"
                    >
                      <div class="bg-white rounded-xl shadow-xl p-2 mb-2 text-center min-w-[100px] pointer-events-auto">
                        <div class="w-full h-8 rounded-lg mb-1" style="background-color: {pickedColor.hex}"></div>
                        <p class="text-[10px] font-bold text-slate-900">{pickedColor.pantone.code}</p>
                        <p class="text-[9px] text-slate-500">{pickedColor.hex.toUpperCase()}</p>
                      </div>
                    </div>
                    <div
                      class="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2 z-10 ring-2 ring-black/20"
                      style="left: {pickedColor.x}%; top: {pickedColor.y}%; background-color: {pickedColor.hex}"
                    ></div>
                  {/if}
                </div>
              </div>
              {#if pickerMode}
                <div class="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md">
                  {$t('palette.tap_to_pick')}
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <button
            class="relative flex-1 bg-slate-50 flex flex-col group cursor-pointer transition-all duration-500 justify-center items-center"
            ondblclick={triggerUpload}
            ontouchend={handleTouchEnd}
          >
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
                <div class="w-20 h-20 bg-white rounded-full flex items-center justify-center ring-1 ring-slate-900/5">
                  <Upload class="w-8 h-8 opacity-30 text-slate-900" />
                </div>
                <div class="text-center space-y-2">
                  <h2 class="text-xl font-semibold text-slate-700">{$t('palette.extract')}</h2>
                  <p class="text-sm text-slate-400">{$t('palette.upload_hint')}</p>
                </div>
              {/if}
            </div>
          </button>
        {/if}

        <input
          bind:this={fileInput}
          type="file"
          class="hidden"
          onchange={handleInputChange}
          accept="image/*"
        />

        {#if analysis}
          <!-- Middle Section: Pantone Deck -->
          <div class="relative w-full bg-white -mt-10 rounded-t-[2.5rem] pt-8 z-10">
            <div class="px-8 mb-4 flex justify-between items-end">
              <h3 class="text-sm font-bold text-slate-900">{$t('palette.extracted')}</h3>
              <span class="text-xs text-slate-400 font-medium">{$t('palette.colors_count', { count: String(uniquePantoneColors.length) })}</span>
            </div>

            <div class="flex overflow-x-auto pb-8 pt-2 px-6 no-scrollbar">
              {#each uniquePantoneColors as color, i}
                <button
                  onclick={() => selectedPaletteColor.set(color)}
                  class="flex-shrink-0 w-28 h-40 bg-white rounded-xl overflow-hidden flex flex-col transition-all hover:scale-105 active:scale-95 mx-2 ring-1 ring-black/5 text-left group"
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
            <h3 class="text-sm font-bold text-slate-900 mb-6">{$t('palette.chromatic_data')}</h3>
            <div class="w-full flex flex-col">
              <div class="flex justify-between items-center py-3.5 border-b border-slate-50">
                <span class="text-slate-500 text-xs font-medium uppercase tracking-wide">{$t('palette.avg_lightness')}</span>
                <span class="font-semibold text-slate-700 tabular-nums text-sm">{(analysis.avgLightness * 100).toFixed(1)}%</span>
              </div>
              <div class="flex justify-between items-center py-3.5 border-b border-slate-50">
                <span class="text-slate-500 text-xs font-medium uppercase tracking-wide">{$t('palette.avg_chroma')}</span>
                <span class="font-semibold text-slate-700 tabular-nums text-sm">{analysis.avgChroma.toFixed(3)}</span>
              </div>
              <div class="flex justify-between items-center py-3.5 border-b border-slate-50">
                <span class="text-slate-500 text-xs font-medium uppercase tracking-wide">{$t('palette.bias_color')}</span>
                <span class="font-semibold text-slate-700 tabular-nums text-sm">{analysis.colorfulnessBias.toFixed(2)}</span>
              </div>
              <div class="flex justify-between items-center py-3.5 border-b border-slate-50">
                <span class="text-slate-500 text-xs font-medium uppercase tracking-wide">{$t('palette.bias_light')}</span>
                <span class="font-semibold text-slate-700 tabular-nums text-sm">{analysis.lightDarkBias.toFixed(2)}</span>
              </div>
              <div class="flex justify-between items-center py-3.5">
                <span class="text-slate-500 text-xs font-medium uppercase tracking-wide">{$t('palette.diversity')}</span>
                <span class="font-semibold text-slate-700 tabular-nums text-sm">{analysis.sparseColor ? $t('palette.high') : $t('palette.low')}</span>
              </div>
            </div>
          </div>
        {/if}

    </div>

  </div>


</div>
