<script lang="ts">
  import { ChevronLeft, Heart, Share2, Copy, Check } from 'lucide-svelte';
  import { t } from '$lib/i18n';
  import { user } from '$lib/stores/auth';
  import { selectedPaletteColor, savedColorKeys, savedColors } from '$lib/stores/app';
  import { saveColor, unsaveColor } from '$lib/saved-colors';
  import {
    hexToRgb,
    calculateLRV,
    calculateCMYK,
    type ExtractedColor,
  } from '$lib/pantone-colors';

  let colorSaved = $state(false);
  let copied = $state<string | null>(null);

  $effect(() => {
    if ($selectedPaletteColor) {
      const key = `Pantone:${$selectedPaletteColor.pantone.code}`;
      colorSaved = $savedColorKeys.has(key);
    }
  });

  function getContrastClass(color: ExtractedColor): string {
    const luminance = (0.299 * color.rgb.r + 0.587 * color.rgb.g + 0.114 * color.rgb.b) / 255;
    return luminance > 0.5 ? 'text-slate-900' : 'text-white';
  }

  function close() {
    selectedPaletteColor.set(null);
  }

  async function handleSaveSelectedColor() {
    if (!$user || !$selectedPaletteColor) return;
    const key = `Pantone:${$selectedPaletteColor.pantone.code}`;
    if ($savedColorKeys.has(key)) {
      const success = await unsaveColor($user.id, 'NCS' as any, $selectedPaletteColor.pantone.code);
      if (success) {
        savedColors.update(colors => colors.filter(c => !(c.color_code === $selectedPaletteColor!.pantone.code)));
        savedColorKeys.update(keys => { const next = new Set(keys); next.delete(key); return next; });
        colorSaved = false;
      }
    } else {
      const saved = await saveColor($user.id, {
        system: 'NCS' as any,
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
</script>

{#if $selectedPaletteColor}
  {@const pantoneRgb = hexToRgb($selectedPaletteColor.pantone.hex)}
  {@const cmyk = calculateCMYK(pantoneRgb)}
  {@const lrv = calculateLRV(pantoneRgb)}
  {@const textColorClass = getContrastClass($selectedPaletteColor)}

  <div class="fixed inset-0 z-50 flex items-center justify-center bg-white sm:p-4">
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
          <button class="w-full bg-slate-900 text-white font-medium py-4 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
            <span>{$t('palette.find_similar')}</span>
          </button>
        </div>
      </div>

    </div>
  </div>
{/if}
