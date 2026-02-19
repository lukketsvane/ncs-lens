<script lang="ts">
  import { ChevronLeft, Heart, Share2, Copy, Check, Palette } from 'lucide-svelte';
  import { t } from '$lib/i18n';
  import { user } from '$lib/stores/auth';
  import { selectedPaletteColor, savedColorKeys, savedColors } from '$lib/stores/app';
  import { saveColor, unsaveColor } from '$lib/saved-colors';
  import { swipeGesture } from '$lib/actions/swipeGesture';
  import {
    hexToRgb,
    calculateLRV,
    calculateCMYK,
    getColorDistance,
    PANTONE_COLORS,
    type ExtractedColor,
  } from '$lib/pantone-colors';

  let colorSaved = $state(false);
  let copied = $state<string | null>(null);
  let swipeProgress = $state(0);
  let swipeReturning = $state(false);
  let showSimilarColors = $state(false);

  $effect(() => {
    if ($selectedPaletteColor) {
      const key = `Pantone:${$selectedPaletteColor.pantone.code}`;
      colorSaved = $savedColorKeys.has(key);
      showSimilarColors = false;
    }
  });

  function getContrastClass(color: ExtractedColor): string {
    const luminance = (0.299 * color.rgb.r + 0.587 * color.rgb.g + 0.114 * color.rgb.b) / 255;
    return luminance > 0.5 ? 'text-slate-900' : 'text-white';
  }

  function close() {
    selectedPaletteColor.set(null);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showSimilarColors) {
        showSimilarColors = false;
      } else {
        close();
      }
    }
  }

  async function handleSaveSelectedColor() {
    if (!$user || !$selectedPaletteColor) return;
    const key = `Pantone:${$selectedPaletteColor.pantone.code}`;
    if ($savedColorKeys.has(key)) {
      const success = await unsaveColor($user.id, 'Pantone', $selectedPaletteColor.pantone.code);
      if (success) {
        savedColors.update(colors => colors.filter(c => !(c.color_code === $selectedPaletteColor!.pantone.code)));
        savedColorKeys.update(keys => { const next = new Set(keys); next.delete(key); return next; });
        colorSaved = false;
      }
    } else {
      const saved = await saveColor($user.id, {
        system: 'Pantone',
        code: $selectedPaletteColor.pantone.code,
        name: $selectedPaletteColor.pantone.name,
        hex: $selectedPaletteColor.pantone.hex,
      });
      if (saved) {
        savedColors.update(colors => [saved, ...colors]);
        savedColorKeys.update(keys => new Set([...keys, key]));
        colorSaved = true;
      }
    }
  }

  async function handleShare() {
    if (!$selectedPaletteColor) return;
    const text = `Pantone ${$selectedPaletteColor.pantone.code} — ${$selectedPaletteColor.pantone.name} (${$selectedPaletteColor.pantone.hex})`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Pantone ${$selectedPaletteColor.pantone.code}`, text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    copied = key;
    setTimeout(() => copied = null, 2000);
  }

  // Find similar Pantone colors from the dataset
  const similarPantoneColors = $derived.by(() => {
    if (!$selectedPaletteColor) return [];
    const currentRgb = hexToRgb($selectedPaletteColor.pantone.hex);
    return PANTONE_COLORS
      .filter(p => p.code !== $selectedPaletteColor.pantone.code)
      .map(p => {
        const pRgb = hexToRgb(p.hex);
        return { ...p, distance: getColorDistance(currentRgb, pRgb) };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 12);
  });

  function selectSimilarColor(pantone: { code: string; name: string; hex: string }) {
    const rgb = hexToRgb(pantone.hex);
    const color: ExtractedColor = {
      rgb,
      hsl: { h: 0, s: 0, l: 0 },
      hex: pantone.hex,
      pantone: { ...pantone, distance: 0 },
      x: 0,
      y: 0,
    };
    selectedPaletteColor.set(color);
  }
</script>

{#if $selectedPaletteColor}
  {@const pantoneRgb = hexToRgb($selectedPaletteColor.pantone.hex)}
  {@const cmyk = calculateCMYK(pantoneRgb)}
  {@const lrv = calculateLRV(pantoneRgb)}
  {@const textColorClass = getContrastClass($selectedPaletteColor)}

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-white sm:p-4"
    class:swipe-returning={swipeReturning}
    style="transform: translateX({swipeProgress * 100}px); opacity: {1 - swipeProgress * 0.3}"
    role="dialog"
    tabindex="-1"
    onkeydown={handleKeydown}
    use:swipeGesture={{
      onSwipeRight: close,
      threshold: 50,
      edgeThreshold: 40,
      onProgress: (p) => { swipeReturning = false; swipeProgress = p; },
      onCancel: () => { swipeReturning = true; swipeProgress = 0; }
    }}
  >
    <!-- Swipe back indicator -->
    {#if swipeProgress > 0}
      <div
        class="fixed left-0 top-1/2 -translate-y-1/2 z-[70] pointer-events-none"
        style="opacity: {Math.min(1, swipeProgress * 2)}; transform: translateX({swipeProgress * 20}px) translateY(-50%)"
      >
        <div class="bg-black/20 backdrop-blur-md rounded-r-full p-2 pl-1">
          <ChevronLeft size={20} class="text-white" />
        </div>
      </div>
    {/if}

    <div class="w-full h-full max-w-md bg-white sm:rounded-[2rem] sm:h-[90vh] overflow-hidden flex flex-col relative ring-1 ring-black/5">

      <!-- Header Color Block -->
      <div
        class="h-[40%] w-full relative transition-colors duration-500"
        style="background-color: {$selectedPaletteColor.pantone.hex}"
      >
        <div class="absolute top-0 left-0 w-full p-6 flex justify-between items-center {textColorClass}">
          <button onclick={close} class="p-2 -ml-2 rounded-full hover:bg-black/10 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div class="flex gap-4">
            <button onclick={handleSaveSelectedColor} class="p-2 rounded-full hover:bg-black/10 transition-colors">
              <Heart size={20} fill={colorSaved ? 'currentColor' : 'none'} class={colorSaved ? 'text-red-500' : ''} />
            </button>
            <button onclick={handleShare} class="p-2 rounded-full hover:bg-black/10 transition-colors"><Share2 size={20} /></button>
          </div>
        </div>

        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none {textColorClass}">
          <h2 class="text-4xl font-bold tracking-tight mb-2">PANTONE</h2>
          <p class="text-lg font-medium tracking-wide opacity-90">{$selectedPaletteColor.pantone.code}</p>
        </div>
      </div>

      <!-- Content Section -->
      <div class="flex-1 flex flex-col bg-white">
        <div class="bg-gray-50/50 px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-slate-100">
          {$t('palette.details')}
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-8">
          <div class="flex justify-between items-baseline">
            <span class="text-slate-500 text-sm font-medium">{$t('palette.name')}</span>
            <span class="text-slate-900 font-bold text-lg">{$selectedPaletteColor.pantone.name}</span>
          </div>

          <div class="flex justify-between items-baseline">
            <span class="text-slate-500 text-sm font-medium">{$t('palette.collection')}</span>
            <span class="text-slate-900 font-medium">{$t('palette.pantone_connect')}</span>
          </div>

          <div>
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{$t('palette.technical_data')}</h3>

            <div class="space-y-4">
              <button
                class="flex justify-between items-center py-2 border-b border-slate-50 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded w-full"
                onclick={() => copyToClipboard(String(lrv), 'lrv')}
              >
                <span class="text-slate-500 text-sm">LRV (D65)</span>
                <div class="flex items-center gap-2">
                  <span class="text-slate-900 font-mono font-medium">{lrv}</span>
                  {#if copied === 'lrv'}
                    <Check size={12} class="text-green-500" />
                  {:else}
                    <Copy size={12} class="text-slate-400" />
                  {/if}
                </div>
              </button>

              <button
                class="flex justify-between items-center py-2 border-b border-slate-50 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded w-full"
                onclick={() => copyToClipboard(`${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`, 'cmyk')}
              >
                <span class="text-slate-500 text-sm">CMYK</span>
                <div class="flex items-center gap-2">
                  <span class="text-slate-900 font-mono font-medium">{cmyk.c}, {cmyk.m}, {cmyk.y}, {cmyk.k}</span>
                  {#if copied === 'cmyk'}
                    <Check size={12} class="text-green-500" />
                  {:else}
                    <Copy size={12} class="text-slate-400" />
                  {/if}
                </div>
              </button>

              <button
                class="flex justify-between items-center py-2 border-b border-slate-50 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded w-full"
                onclick={() => copyToClipboard(`${pantoneRgb.r}, ${pantoneRgb.g}, ${pantoneRgb.b}`, 'rgb')}
              >
                <span class="text-slate-500 text-sm">RGB</span>
                <div class="flex items-center gap-2">
                  <span class="text-slate-900 font-mono font-medium">{pantoneRgb.r}, {pantoneRgb.g}, {pantoneRgb.b}</span>
                  {#if copied === 'rgb'}
                    <Check size={12} class="text-green-500" />
                  {:else}
                    <Copy size={12} class="text-slate-400" />
                  {/if}
                </div>
              </button>

              <button
                class="flex justify-between items-center py-2 border-b border-slate-50 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded w-full"
                onclick={() => copyToClipboard($selectedPaletteColor!.pantone.hex.toUpperCase(), 'hex')}
              >
                <span class="text-slate-500 text-sm">HEX</span>
                <div class="flex items-center gap-2">
                  <span class="text-slate-900 font-mono font-medium uppercase">{$selectedPaletteColor.pantone.hex}</span>
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
          <button
            onclick={() => showSimilarColors = true}
            class="w-full bg-slate-900 text-white font-medium py-4 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <Palette size={18} />
            <span>{$t('palette.find_similar')}</span>
          </button>
        </div>
      </div>

    </div>

    <!-- Similar Colors Overlay -->
    {#if showSimilarColors}
      <div class="absolute inset-0 bg-white z-30 flex flex-col animate-in slide-in-from-bottom duration-300">
        <div class="flex items-center justify-between p-4 border-b border-gray-100">
          <button
            onclick={() => showSimilarColors = false}
            class="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 class="font-semibold text-gray-900">{$t('color.similar_colors')}</h2>
          <div class="w-10"></div>
        </div>

        <div class="p-4 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl border border-gray-200" style="background-color: {$selectedPaletteColor.pantone.hex}"></div>
            <div>
              <p class="font-semibold text-gray-900">{$selectedPaletteColor.pantone.code}</p>
              <p class="text-sm text-gray-500">{$selectedPaletteColor.pantone.name}</p>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          {#if similarPantoneColors.length === 0}
            <div class="flex flex-col items-center justify-center h-full text-gray-400">
              <Palette size={48} class="mb-4 opacity-20" />
              <p>{$t('color.no_similar')}</p>
            </div>
          {:else}
            {#each similarPantoneColors as item}
              <button
                onclick={() => selectSimilarColor(item)}
                class="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors cursor-pointer active:scale-[0.98] w-full text-left"
              >
                <div class="w-14 h-14 rounded-xl border border-gray-200 flex-shrink-0" style="background-color: {item.hex}"></div>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-gray-900">{item.code}</p>
                  <p class="text-sm text-gray-500 truncate">{item.name}</p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-gray-400">{$t('color.match')}</p>
                  <p class="font-semibold text-gray-900">
                    {Math.round(Math.max(0, 100 - (item.distance / 200) * 100))}%
                  </p>
                </div>
              </button>
            {/each}
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}
