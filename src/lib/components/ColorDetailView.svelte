<script lang="ts">
  import { ChevronLeft, Share2, Heart, Hammer, RotateCcw, Palette, XCircle } from 'lucide-svelte';
  import { user } from '$lib/stores/auth';
  import { detailColor, history, communityItems, savedColorKeys, savedColors, MAX_SIMILAR_COLOR_DISTANCE } from '$lib/stores/app';
  import { saveColor, unsaveColor } from '$lib/saved-colors';
  import { swipeGesture } from '$lib/actions/swipeGesture';
  import HueRing from '$lib/components/ncs/HueRing.svelte';
  import TrianglePicker from '$lib/components/ncs/TrianglePicker.svelte';
  import { degreesToNcsHue, ncsToCss, type NCSColor } from '$lib/components/ncs/utils';
  import { hexToRgb, rgbToLab, deltaE2000 } from '$lib/ncs-colors';
  import type { ColorMatch, HistoryItem } from '$lib/stores/app';

  interface SimilarColorResult {
    color: ColorMatch;
    distance: number;
    productType: string;
    source: 'history' | 'community';
  }

  // State
  let activeTab = $state<'details' | 'combinations' | 'compare' | 'wheel'>('details');
  let compareColor = $state<ColorMatch | null>(null);
  let showSimilarColors = $state(false);
  let colorSaved = $state(false);
  let wheelColor = $state<NCSColor>({ hue: 0, blackness: 30, chromaticness: 40 });

  // Curated comparison colors
  const CURATED_COMPARISONS: ColorMatch[] = [
    { system: "NCS", code: "S 0300-N", name: "Pure White", hex: "#FFFFFF", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "100", cmyk: "0,0,0,0", rgb: "255,255,255" },
    { system: "NCS", code: "S 0502-Y", name: "Standard White", hex: "#F2F0EB", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "85", cmyk: "0,0,5,0", rgb: "242,240,235" },
    { system: "NCS", code: "S 4500-N", name: "Middle Grey", hex: "#8B8B8B", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "30", cmyk: "0,0,0,45", rgb: "139,139,139" },
    { system: "NCS", code: "S 9000-N", name: "Black", hex: "#212121", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "5", cmyk: "0,0,0,90", rgb: "33,33,33" },
  ];

  // Initialize wheel color when detail color changes
  $effect(() => {
    if ($detailColor) {
      initializeWheelColor();
      colorSaved = $savedColorKeys.has(`${$detailColor.system}:${$detailColor.code}`);
    }
  });

  function initializeWheelColor() {
    if (!$detailColor) return;
    const parsed = parseNCSStr($detailColor.code);
    if (parsed && $detailColor.system === 'NCS') {
      const hueValue = ncsHueToDegrees(parsed.hue);
      const blacknessValue = parseInt(parsed.blackness, 10) || 30;
      const chromaticnessValue = parseInt(parsed.chroma, 10) || 40;
      wheelColor = { hue: hueValue, blackness: blacknessValue, chromaticness: chromaticnessValue };
    } else {
      wheelColor = hexToNcsApprox($detailColor.hex);
    }
  }

  function parseNCSStr(code: string) {
    const match = code.match(/S?\s*(\d{2})(\d{2})-(.*)/i);
    if (match) {
      return { blackness: match[1], chroma: match[2], hue: match[3] };
    }
    return null;
  }

  function ncsHueToDegrees(hueStr: string): number {
    if (!hueStr) return 0;
    const h = hueStr.toUpperCase().trim();
    if (h === 'Y') return 0;
    if (h === 'R') return 90;
    if (h === 'B') return 180;
    if (h === 'G') return 270;
    if (h === 'N') return 0;
    const match = h.match(/([YRBG])(\d+)([YRBG])/);
    if (match) {
      const from = match[1];
      const percent = parseInt(match[2], 10);
      const baseAngles: Record<string, number> = { Y: 0, R: 90, B: 180, G: 270 };
      const base = baseAngles[from] ?? 0;
      return (base + (percent / 100) * 90) % 360;
    }
    return 0;
  }

  function hexToNcsApprox(hex: string): NCSColor {
    if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      return { hue: 0, blackness: 30, chromaticness: 40 };
    }
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
        case g: h = ((b - r) / d + 2) * 60; break;
        case b: h = ((r - g) / d + 4) * 60; break;
      }
    }
    let ncsHue = 0;
    if (h <= 60) ncsHue = (60 - h) / 60 * 90;
    else if (h <= 120) ncsHue = 270 + (120 - h) / 60 * 90;
    else if (h <= 240) ncsHue = 180 - (h - 120) / 120 * 90;
    else ncsHue = 180 + (360 - h) / 120 * 90;
    return {
      hue: Math.round(ncsHue) % 360,
      blackness: Math.min(100, Math.max(0, Math.round((1 - l) * 100))),
      chromaticness: Math.min(100, Math.max(0, Math.round(s * 100)))
    };
  }

  function ncsToHex(color: NCSColor): string {
    const hslStr = ncsToCss(color);
    const match = hslStr.match(/hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
    if (!match) return '#888888';
    const h = parseFloat(match[1]) / 360;
    const s = parseFloat(match[2]) / 100;
    const l = parseFloat(match[3]) / 100;
    let r: number, g: number, b: number;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function getContrastColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? 'text-black' : 'text-white';
  }

  function calculateColorDistance(hex1: string, hex2: string): number {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    if (!rgb1 || !rgb2) return Infinity;
    const lab1 = rgbToLab(rgb1.r, rgb1.g, rgb1.b);
    const lab2 = rgbToLab(rgb2.r, rgb2.g, rgb2.b);
    return deltaE2000(lab1, lab2);
  }

  function handleBack() {
    detailColor.set(null);
  }

  async function handleSaveColor() {
    if (!$user || !$detailColor) return;
    const saved = await saveColor($user.id, {
      system: $detailColor.system,
      code: $detailColor.code,
      name: $detailColor.name,
      hex: $detailColor.hex,
    });
    if (saved) {
      savedColors.update(colors => [saved, ...colors]);
      savedColorKeys.update(keys => new Set([...keys, `${$detailColor!.system}:${$detailColor!.code}`]));
      colorSaved = true;
    }
  }

  async function handleUnsaveColor() {
    if (!$user || !$detailColor) return;
    const success = await unsaveColor($user.id, $detailColor.system, $detailColor.code);
    if (success) {
      savedColors.update(colors => colors.filter(c => !(c.color_system === $detailColor!.system && c.color_code === $detailColor!.code)));
      savedColorKeys.update(keys => {
        const next = new Set(keys);
        next.delete(`${$detailColor!.system}:${$detailColor!.code}`);
        return next;
      });
      colorSaved = false;
    }
  }

  // Derived values
  const isNCS = $derived($detailColor?.system === 'NCS');
  const isWheelTabActive = $derived(activeTab === 'wheel');
  const displayHex = $derived(isWheelTabActive ? ncsToHex(wheelColor) : ($detailColor?.hex ?? '#888888'));
  const contrastText = $derived(getContrastColor(displayHex));
  const formatNcsValue = (value: number): string => String(Math.round(value)).padStart(2, '0');
  
  const blackness = $derived(isWheelTabActive 
    ? formatNcsValue(wheelColor.blackness)
    : ($detailColor?.blackness || parseNCSStr($detailColor?.code ?? '')?.blackness || "--"));
  const chroma = $derived(isWheelTabActive 
    ? formatNcsValue(wheelColor.chromaticness)
    : ($detailColor?.chromaticness || parseNCSStr($detailColor?.code ?? '')?.chroma || "--"));
  const hue = $derived(isWheelTabActive 
    ? degreesToNcsHue(wheelColor.hue)
    : ($detailColor?.hue || parseNCSStr($detailColor?.code ?? '')?.hue || ""));

  const similarColors = $derived.by(() => {
    if (!$detailColor) return [];
    const results: SimilarColorResult[] = [];
    const seen = new Set<string>();
    
    const processItems = (items: HistoryItem[], source: 'history' | 'community') => {
      items.forEach(item => {
        item.result.colors.forEach(c => {
          if (c.code !== $detailColor.code && !seen.has(c.code)) {
            const distance = calculateColorDistance($detailColor.hex, c.hex);
            if (distance <= MAX_SIMILAR_COLOR_DISTANCE) {
              results.push({ color: c, distance, productType: item.result.productType, source });
              seen.add(c.code);
            }
          }
        });
      });
    };
    
    processItems($history, 'history');
    processItems($communityItems, 'community');
    return results.sort((a, b) => a.distance - b.distance);
  });

  const comparisonList = $derived.by(() => {
    if (!$detailColor) return [];
    const list: ColorMatch[] = [];
    const seen = new Set<string>();
    $history.forEach(item => {
      item.result.colors.forEach(c => {
        if (c.code !== $detailColor.code && !seen.has(c.code)) {
          list.push(c);
          seen.add(c.code);
        }
      });
    });
    return list;
  });

  function selectSimilarColor(color: ColorMatch) {
    detailColor.set(color);
  }

  function resetWheel() {
    initializeWheelColor();
  }
</script>

{#if $detailColor}
  <div 
    class="fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
    use:swipeGesture={{ onSwipeRight: handleBack, threshold: 50, edgeThreshold: 40 }}
  >
    <!-- Top Section -->
    <div 
      class="relative pt-safe-top pb-8 px-6 transition-all duration-500 shadow-sm z-10 flex flex-col"
      style="background-color: {displayHex}; height: {activeTab === 'compare' && compareColor ? '50%' : 'auto'}; min-height: {activeTab === 'compare' && compareColor ? '0' : '35%'}"
    >
      <div class="flex justify-between items-center mb-6">
        <button 
          onclick={handleBack}
          class="flex items-center gap-1 text-sm font-medium {contrastText} opacity-80 hover:opacity-100"
        >
          <ChevronLeft size={20} />
          Back
        </button>
        <div class="text-sm font-bold {contrastText} opacity-90">
          {$detailColor.name}
        </div>
        <div class="flex items-center gap-2">
          {#if $user}
            <button 
              onclick={() => colorSaved ? handleUnsaveColor() : handleSaveColor()}
              class="{contrastText} opacity-80 hover:opacity-100 transition-all"
            >
              <Heart size={20} fill={colorSaved ? 'currentColor' : 'none'} class={colorSaved ? 'text-red-500' : ''} />
            </button>
          {/if}
          <button class="{contrastText} opacity-80 hover:opacity-100">
            <Share2 size={20} />
          </button>
        </div>
      </div>

      <div class="flex flex-col items-center justify-center flex-1 {contrastText}">
        {#if isNCS}
          <div class="w-full max-w-sm">
            {#if !compareColor || activeTab !== 'compare'}
              <div class="flex justify-between text-[10px] font-bold tracking-widest uppercase opacity-60 mb-2 px-6">
                <span class="w-14 text-center">Blackness</span>
                <span class="w-14 text-center">Chroma</span>
                <span class="w-20 text-center">Hue</span>
              </div>
            {/if}
            <div class="flex justify-between items-baseline px-2">
              <div class="text-5xl sm:text-6xl font-light tracking-tighter flex items-baseline">
                <span class="text-3xl mr-1 opacity-60">S</span>
                {blackness}
              </div>
              <div class="text-5xl sm:text-6xl font-light tracking-tighter">
                {chroma}
              </div>
              <div class="text-3xl font-light opacity-60">-</div>
              <div class="text-4xl sm:text-5xl font-light tracking-tight w-24 text-center">
                {hue}
              </div>
            </div>
          </div>
        {:else}
          <div class="text-center py-4">
            <h1 class="text-5xl font-bold tracking-tight mb-2">{$detailColor.code}</h1>
            <p class="text-lg opacity-80">{$detailColor.system} Standard</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Tabs -->
    <div class="bg-white border-b border-gray-100 sticky top-0 z-20">
      <div class="flex">
        <button 
          onclick={() => activeTab = 'details'}
          class="flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-colors {activeTab === 'details' ? 'border-black text-black' : 'border-transparent text-gray-400'}"
        >
          Details
        </button>
        <button 
          onclick={() => activeTab = 'combinations'}
          class="flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-colors {activeTab === 'combinations' ? 'border-black text-black' : 'border-transparent text-gray-400'}"
        >
          Context
        </button>
        <button 
          onclick={() => activeTab = 'compare'}
          class="flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-colors {activeTab === 'compare' ? 'border-black text-black' : 'border-transparent text-gray-400'}"
        >
          Compare
        </button>
        <button 
          onclick={() => activeTab = 'wheel'}
          class="flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-colors {activeTab === 'wheel' ? 'border-black text-black' : 'border-transparent text-gray-400'}"
        >
          Fine Tune
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto no-scrollbar bg-white safe-area-bottom relative">
      {#if activeTab === 'details'}
        <div class="divide-y divide-gray-100 animate-in fade-in">
          <div class="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <span class="text-gray-500 text-sm">Name</span>
            <span class="text-gray-900 font-semibold font-mono">{$detailColor.code}</span>
          </div>
          <div class="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <span class="text-gray-500 text-sm">Collection</span>
            <span class="text-gray-900 font-medium">{$detailColor.system} 2050</span>
          </div>
          <div class="bg-gray-50/50 px-6 py-2 mt-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
            Technical Data
          </div>
          <div class="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <span class="text-gray-500 text-sm">LRV (D65)</span>
            <span class="text-gray-900 font-mono font-medium">{$detailColor.lrv || "N/A"}</span>
          </div>
          <div class="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <span class="text-gray-500 text-sm">CMYK Coated</span>
            <span class="text-gray-900 font-mono font-medium">{$detailColor.cmyk || "N/A"}</span>
          </div>
          <div class="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <span class="text-gray-500 text-sm">RGB Value</span>
            <span class="text-gray-900 font-mono font-medium">{$detailColor.rgb || "N/A"}</span>
          </div>
        </div>
      {:else if activeTab === 'combinations'}
        <div class="p-6 space-y-8 animate-in fade-in">
          <div class="space-y-4">
            <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wide">Material Identification</h3>
            <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex items-start gap-4">
              <div class="bg-white p-3 rounded-full shadow-sm">
                <Hammer class="text-gray-700" size={24} />
              </div>
              <div>
                <div class="font-bold text-gray-900 text-lg">{$detailColor.materialGuess}</div>
                <div class="text-gray-500 text-sm mt-1">{$detailColor.finishGuess}</div>
                <p class="text-gray-600 text-sm mt-3 leading-relaxed">
                  {$detailColor.laymanDescription}
                </p>
              </div>
            </div>
          </div>
        </div>
      {:else if activeTab === 'compare'}
        <div class="h-full flex flex-col animate-in fade-in">
          {#if compareColor}
            <div 
              class="flex-1 w-full relative transition-colors duration-500 flex flex-col items-center justify-center"
              style="background-color: {compareColor.hex}"
            >
              <button 
                onclick={() => compareColor = null}
                class="absolute top-4 right-4 p-2 bg-black/20 text-white rounded-full hover:bg-black/40 backdrop-blur-md"
              >
                <XCircle size={24} />
              </button>
              
              <div class="text-center {getContrastColor(compareColor.hex)}">
                <h2 class="text-5xl font-light tracking-tighter mb-2">{compareColor.code.split(" ").pop()}</h2>
                <p class="text-sm font-medium opacity-70 uppercase tracking-widest">{compareColor.name}</p>
              </div>
              
              <div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-white text-black font-bold text-xs px-3 py-1 rounded-full shadow-lg border border-gray-100 z-30">
                VS
              </div>
            </div>
          {:else}
            <div class="p-6 space-y-8">
              <div>
                <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Standard References</h3>
                <div class="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                  {#each CURATED_COMPARISONS as c}
                    <button 
                      onclick={() => compareColor = c}
                      class="flex-shrink-0 flex flex-col items-center gap-2 group"
                    >
                      <div class="w-16 h-16 rounded-full border border-gray-200 shadow-sm group-hover:scale-105 transition-transform" style="background-color: {c.hex}"></div>
                      <span class="text-xs font-medium text-gray-600 max-w-[80px] truncate">{c.name}</span>
                    </button>
                  {/each}
                </div>
              </div>

              <div>
                <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Recent Scans</h3>
                {#if comparisonList.length === 0}
                  <p class="text-gray-400 text-sm italic">No other scans to compare with.</p>
                {:else}
                  <div class="grid grid-cols-4 gap-4">
                    {#each comparisonList as c}
                      <button 
                        onclick={() => compareColor = c}
                        class="flex flex-col items-center gap-2 group"
                      >
                        <div class="w-full aspect-square rounded-2xl border border-gray-200 shadow-sm group-hover:scale-105 transition-transform" style="background-color: {c.hex}"></div>
                        <span class="text-[10px] font-medium text-gray-600 w-full truncate text-center">{c.code.split(" ").pop()}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {:else if activeTab === 'wheel'}
        <div class="h-full flex flex-col animate-in fade-in bg-[#f2f2f2]">
          <div class="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto relative p-4">
            <div class="relative flex items-center justify-center" style="width: 280px; height: 280px">
              <HueRing 
                hue={wheelColor.hue} 
                onchange={(newHue) => wheelColor = { ...wheelColor, hue: newHue }} 
                size={280} 
              />
              <TrianglePicker 
                color={wheelColor} 
                onchange={(s, c) => wheelColor = { ...wheelColor, blackness: s, chromaticness: c }} 
                size={220} 
              />
            </div>
          </div>

          <div class="p-4 bg-white border-t border-gray-100">
            <button
              onclick={resetWheel}
              class="w-full py-3 px-4 bg-gray-100 text-gray-700 font-semibold rounded-2xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} />
              Reset to Original
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Bottom Actions -->
    {#if !(activeTab === 'compare' && compareColor) && activeTab !== 'wheel' && !showSimilarColors}
      <div class="p-4 border-t border-gray-100 bg-white safe-area-bottom">
        <button 
          onclick={() => showSimilarColors = true}
          class="w-full bg-gray-900 text-white font-semibold py-4 rounded-xl shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2"
        >
          <Palette size={18} />
          <span>Find Similar Colors ({similarColors.length})</span>
        </button>
      </div>
    {/if}

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
          <h2 class="font-semibold text-gray-900">Similar Colors</h2>
          <div class="w-10"></div>
        </div>

        <div class="p-4 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl shadow-sm border border-gray-200" style="background-color: {$detailColor.hex}"></div>
            <div>
              <p class="font-semibold text-gray-900">{$detailColor.code}</p>
              <p class="text-sm text-gray-500">{$detailColor.name}</p>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          {#if similarColors.length === 0}
            <div class="flex flex-col items-center justify-center h-full text-gray-400">
              <Palette size={48} class="mb-4 opacity-20" />
              <p>No similar colors found</p>
              <p class="text-sm mt-1">Try scanning more items!</p>
            </div>
          {:else}
            {#each similarColors as item}
              <button 
                onclick={() => selectSimilarColor(item.color)}
                class="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors cursor-pointer active:scale-[0.98] w-full text-left"
              >
                <div class="w-14 h-14 rounded-xl shadow-sm border border-gray-200 flex-shrink-0" style="background-color: {item.color.hex}"></div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="font-semibold text-gray-900">{item.color.code}</p>
                    <span class="text-[10px] px-2 py-0.5 rounded-full {item.source === 'history' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}">
                      {item.source === 'history' ? 'Your Scans' : 'Community'}
                    </span>
                  </div>
                  <p class="text-sm text-gray-500 truncate">{item.color.name}</p>
                  <p class="text-xs text-gray-400 mt-1">From: {item.productType}</p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-gray-400">Match</p>
                  <p class="font-semibold text-gray-900">
                    {Math.round(100 - (item.distance / MAX_SIMILAR_COLOR_DISTANCE) * 100)}%
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
