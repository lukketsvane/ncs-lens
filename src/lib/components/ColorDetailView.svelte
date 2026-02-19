<script lang="ts">
  import { ChevronLeft, Share2, Heart, Hammer, RotateCcw, Palette, XCircle, Check, Copy } from 'lucide-svelte';
  import { user } from '$lib/stores/auth';
  import { detailColor, detailItem, history, communityItems, savedColorKeys, savedColors, compareTarget, MAX_SIMILAR_COLOR_DISTANCE } from '$lib/stores/app';
  import { updateScan } from '$lib/scans';
  import { toasts } from '$lib/stores/toast';
  import { saveColor, unsaveColor } from '$lib/saved-colors';
  import { swipeGesture } from '$lib/actions/swipeGesture';
  import HueRing from '$lib/components/ncs/HueRing.svelte';
  import TrianglePicker from '$lib/components/ncs/TrianglePicker.svelte';
  import { degreesToNcsHue, type NCSColor } from '$lib/components/ncs/utils';
  import {
    hexToRgb, rgbToLab, deltaE2000, rgbToHex,
    parseNcsCode, ncsHueToDegrees as ncsHueToDegreesLib,
    ncsToRgb, findNearestNcsColor, formatNcsCode,
    snapToNcsStandard, getNcsColorByCode
  } from '$lib/ncs-colors';
  import { t } from '$lib/i18n';
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
  let swipeProgress = $state(0);
  let swipeReturning = $state(false);
  let originalColorCode = $state<string | null>(null);

  // Curated comparison colors
  const CURATED_COMPARISONS: ColorMatch[] = [
    { system: "NCS", code: "S 0300-N", name: "pure_white", hex: "#FFFFFF", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "100", cmyk: "0,0,0,0", rgb: "255,255,255" },
    { system: "NCS", code: "S 0502-Y", name: "standard_white", hex: "#F2F0EB", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "85", cmyk: "0,0,5,0", rgb: "242,240,235" },
    { system: "NCS", code: "S 4500-N", name: "middle_grey", hex: "#8B8B8B", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "30", cmyk: "0,0,0,45", rgb: "139,139,139" },
    { system: "NCS", code: "S 9000-N", name: "black", hex: "#212121", location: "-", confidence: "High", materialGuess: "-", finishGuess: "-", laymanDescription: "-", lrv: "5", cmyk: "0,0,0,90", rgb: "33,33,33" },
  ];

  const curatedNameKeys: Record<string, string> = {
    'pure_white': 'color.pure_white',
    'standard_white': 'color.standard_white',
    'middle_grey': 'color.middle_grey',
    'black': 'color.black',
  };

  function getCuratedName(name: string): string {
    const key = curatedNameKeys[name];
    return key ? $t(key) : name;
  }

  // Initialize wheel color when detail color changes
  $effect(() => {
    if ($detailColor) {
      originalColorCode = $detailColor.code;
      initializeWheelColor();
      colorSaved = $savedColorKeys.has(`${$detailColor.system}:${$detailColor.code}`);
      // Auto-set compare target if available
      if ($compareTarget) {
        compareColor = $compareTarget;
        compareTarget.set(null);
        if (activeTab !== 'compare') activeTab = 'compare';
      }
    }
  });

  function initializeWheelColor() {
    if (!$detailColor) return;
    if ($detailColor.system === 'NCS') {
      const parsed = parseNcsCode($detailColor.code);
      if (parsed) {
        wheelColor = {
          hue: ncsHueToDegreesLib(parsed.hue),
          blackness: parsed.blackness,
          chromaticness: parsed.chromaticness
        };
        return;
      }
    }
    // Fallback: find nearest NCS color from hex
    const nearest = findNearestNcsColor($detailColor.hex, 1);
    if (nearest.length > 0) {
      const e = nearest[0].color;
      wheelColor = {
        hue: ncsHueToDegreesLib(e.hue),
        blackness: e.blackness,
        chromaticness: e.chromaticness
      };
    } else {
      wheelColor = { hue: 0, blackness: 30, chromaticness: 40 };
    }
  }

  function ncsWheelToHex(color: NCSColor): string {
    const hueStr = degreesToNcsHue(color.hue);
    const isNeutral = hueStr === 'N' || color.chromaticness === 0;
    const rgb = ncsToRgb(color.blackness, color.chromaticness, color.hue, isNeutral);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  async function confirmWheelColor() {
    const hueStr = degreesToNcsHue(wheelColor.hue);
    const code = formatNcsCode(Math.round(wheelColor.blackness), Math.round(wheelColor.chromaticness), hueStr);
    const snapped = snapToNcsStandard(code);
    if (!snapped || !$detailColor) return;

    const e = snapped.snapped;
    const oldCode = originalColorCode;
    const newColor: ColorMatch = {
      ...$detailColor,
      system: 'NCS',
      code: e.code,
      name: e.name,
      hex: e.hex,
      blackness: String(e.blackness),
      chromaticness: String(e.chromaticness),
      hue: e.hue,
      lrv: String(e.lrv),
      rgb: `${e.rgb.r},${e.rgb.g},${e.rgb.b}`,
    };

    // Update the detail color in memory
    detailColor.set(newColor);
    originalColorCode = newColor.code;

    // Update the parent scan's color array if there is one
    if ($detailItem && oldCode) {
      const newColors = $detailItem.result.colors.map(c =>
        c.code === oldCode ? newColor : c
      );
      const newResult = { ...$detailItem.result, colors: newColors };
      const updatedItem = { ...$detailItem, result: newResult };

      detailItem.set(updatedItem);
      history.update(items => items.map(item =>
        item.id === updatedItem.id ? updatedItem : item
      ));

      // Persist to database
      await updateScan(updatedItem.id, { result: newResult });
    }

    // Auto-save the new color
    if ($user) {
      const key = `${newColor.system}:${newColor.code}`;
      if (!$savedColorKeys.has(key)) {
        const saved = await saveColor($user.id, {
          system: newColor.system,
          code: newColor.code,
          name: newColor.name,
          hex: newColor.hex,
        });
        if (saved) {
          savedColors.update(colors => [saved, ...colors]);
          savedColorKeys.update(keys => new Set([...keys, key]));
          colorSaved = true;
        }
      }
    }

    activeTab = 'details';
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

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showSimilarColors) {
        showSimilarColors = false;
      } else {
        handleBack();
      }
    }
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

  async function handleShare() {
    if (!$detailColor) return;
    const text = `${$detailColor.system} ${$detailColor.code} — ${$detailColor.name} (${$detailColor.hex})`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${$detailColor.system} ${$detailColor.code}`, text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  // Derived values
  const isNCS = $derived($detailColor?.system === 'NCS');
  const isWheelTabActive = $derived(activeTab === 'wheel');
  const displayHex = $derived(isWheelTabActive ? ncsWheelToHex(wheelColor) : ($detailColor?.hex ?? '#888888'));
  const contrastText = $derived(getContrastColor(displayHex));
  const formatNcsValue = (value: number): string => String(Math.round(value)).padStart(2, '0');

  // NCS database fallback for missing data
  const ncsEntry = $derived($detailColor?.system === 'NCS' ? getNcsColorByCode($detailColor.code) : null);

  const displayLrv = $derived($detailColor?.lrv || (ncsEntry ? String(ncsEntry.lrv) : 'N/A'));
  const displayRgb = $derived($detailColor?.rgb || (ncsEntry ? `${ncsEntry.rgb.r},${ncsEntry.rgb.g},${ncsEntry.rgb.b}` : 'N/A'));

  const blackness = $derived.by(() => {
    if (isWheelTabActive) return formatNcsValue(wheelColor.blackness);
    if ($detailColor?.blackness) return $detailColor.blackness;
    const parsed = $detailColor ? parseNcsCode($detailColor.code) : null;
    return parsed ? String(parsed.blackness).padStart(2, '0') : '--';
  });
  const chroma = $derived.by(() => {
    if (isWheelTabActive) return formatNcsValue(wheelColor.chromaticness);
    if ($detailColor?.chromaticness) return $detailColor.chromaticness;
    const parsed = $detailColor ? parseNcsCode($detailColor.code) : null;
    return parsed ? String(parsed.chromaticness).padStart(2, '0') : '--';
  });
  const hue = $derived.by(() => {
    if (isWheelTabActive) return degreesToNcsHue(wheelColor.hue);
    if ($detailColor?.hue) return $detailColor.hue;
    const parsed = $detailColor ? parseNcsCode($detailColor.code) : null;
    return parsed ? parsed.hue : '';
  });

  // Compare deltaE
  const compareDeltaE = $derived.by(() => {
    if (!compareColor || !$detailColor) return null;
    return calculateColorDistance($detailColor.hex, compareColor.hex);
  });

  // Saved colors as comparison targets
  const savedCompareColors = $derived.by(() => {
    if (!$detailColor) return [];
    return $savedColors
      .filter(c => c.color_code !== $detailColor.code)
      .map(c => ({
        system: c.color_system as "RAL" | "NCS",
        code: c.color_code,
        name: c.color_name || c.color_code,
        hex: c.color_hex,
        location: '-', confidence: 'High',
        materialGuess: '-', finishGuess: '-', laymanDescription: '-',
      } satisfies ColorMatch))
      .slice(0, 12);
  });

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

  const hasMaterialData = $derived(
    $detailColor?.materialGuess && $detailColor.materialGuess !== '-' && $detailColor.materialGuess !== ''
  );
</script>

{#if $detailColor}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
    class:swipe-returning={swipeReturning}
    style="transform: translateX({swipeProgress * 100}px); opacity: {1 - swipeProgress * 0.3}"
    role="dialog"
    tabindex="-1"
    onkeydown={handleKeydown}
    use:swipeGesture={{
      onSwipeRight: handleBack,
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

    <!-- Top Section -->
    <div
      class="relative pt-safe-top pb-8 px-6 transition-all duration-500 z-10 flex flex-col"
      style="background-color: {displayHex}; height: {activeTab === 'compare' && compareColor ? '50%' : 'auto'}; min-height: {activeTab === 'compare' && compareColor ? '0' : '35%'}"
    >
      <div class="flex justify-between items-center mb-6">
        <button
          onclick={handleBack}
          class="flex items-center gap-1 text-sm font-medium {contrastText} opacity-80 hover:opacity-100"
        >
          <ChevronLeft size={20} />
          {$t('color.back')}
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
          <button onclick={handleShare} class="{contrastText} opacity-80 hover:opacity-100">
            <Share2 size={20} />
          </button>
        </div>
      </div>

      <div class="flex flex-col items-center justify-center flex-1 {contrastText}">
        {#if isNCS || isWheelTabActive}
          <div class="w-full max-w-sm">
            {#if !compareColor || activeTab !== 'compare'}
              <div class="flex justify-between text-[10px] font-bold tracking-widest uppercase opacity-60 mb-2 px-6">
                <span class="w-14 text-center">{$t('color.blackness')}</span>
                <span class="w-14 text-center">{$t('color.chroma')}</span>
                <span class="w-20 text-center">{$t('color.hue')}</span>
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
            <p class="text-lg opacity-80">{$t('color.standard', { system: $detailColor.system })}</p>
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
          {$t('color.details')}
        </button>
        <button
          onclick={() => activeTab = 'combinations'}
          class="flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-colors {activeTab === 'combinations' ? 'border-black text-black' : 'border-transparent text-gray-400'}"
        >
          {$t('color.context')}
        </button>
        <button
          onclick={() => activeTab = 'compare'}
          class="flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-colors {activeTab === 'compare' ? 'border-black text-black' : 'border-transparent text-gray-400'}"
        >
          {$t('color.compare')}
        </button>
        <button
          onclick={() => activeTab = 'wheel'}
          class="flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-colors {activeTab === 'wheel' ? 'border-black text-black' : 'border-transparent text-gray-400'}"
        >
          {$t('color.fine_tune')}
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto no-scrollbar bg-white safe-area-bottom relative">
      {#if activeTab === 'details'}
        <div class="divide-y divide-gray-100 animate-in fade-in">
          <div class="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <span class="text-gray-500 text-sm">{$t('color.name')}</span>
            <span class="text-gray-900 font-semibold font-mono">{$detailColor.code}</span>
          </div>
          <div class="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <span class="text-gray-500 text-sm">{$t('color.collection')}</span>
            <span class="text-gray-900 font-medium">{$detailColor.system} 2050</span>
          </div>
          <div class="bg-gray-50/50 px-6 py-2 mt-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
            {$t('color.technical_data')}
          </div>
          <div class="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <span class="text-gray-500 text-sm">{$t('color.lrv')}</span>
            <span class="text-gray-900 font-mono font-medium">{displayLrv}</span>
          </div>
          <div class="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <span class="text-gray-500 text-sm">{$t('color.cmyk')}</span>
            <span class="text-gray-900 font-mono font-medium">{$detailColor.cmyk || "N/A"}</span>
          </div>
          <div class="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <span class="text-gray-500 text-sm">{$t('color.rgb')}</span>
            <span class="text-gray-900 font-mono font-medium">{displayRgb}</span>
          </div>
        </div>
      {:else if activeTab === 'combinations'}
        <div class="p-6 space-y-8 animate-in fade-in">
          {#if hasMaterialData}
            <div class="space-y-4">
              <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wide">{$t('color.material_id')}</h3>
              <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex items-start gap-4">
                <div class="bg-white p-3 rounded-full">
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
          {:else}
            <div class="text-center py-12 text-gray-400">
              <Hammer size={48} class="mx-auto mb-4 opacity-20" />
              <p>{$t('color.no_context')}</p>
              <p class="text-sm mt-1">{$t('color.no_context_hint')}</p>
            </div>
          {/if}
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
                <p class="text-sm font-medium opacity-70 uppercase tracking-widest">{getCuratedName(compareColor.name)}</p>
              </div>

              <div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-white text-black font-bold text-xs px-3 py-1 rounded-full border border-gray-100 z-30 flex items-center gap-2">
                {$t('color.vs')}
                {#if compareDeltaE !== null}
                  <span class="text-gray-500 font-normal">{$t('color.delta_e')}: {compareDeltaE.toFixed(1)}</span>
                {/if}
              </div>
            </div>
          {:else}
            <div class="p-6 space-y-8">
              <div>
                <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">{$t('color.standard_refs')}</h3>
                <div class="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                  {#each CURATED_COMPARISONS as c}
                    <button
                      onclick={() => compareColor = c}
                      class="flex-shrink-0 flex flex-col items-center gap-2 group"
                    >
                      <div class="w-16 h-16 rounded-full border border-gray-200 group-hover:scale-105 transition-transform" style="background-color: {c.hex}"></div>
                      <span class="text-xs font-medium text-gray-600 max-w-[80px] truncate">{getCuratedName(c.name)}</span>
                    </button>
                  {/each}
                </div>
              </div>

              {#if savedCompareColors.length > 0}
                <div>
                  <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">{$t('color.saved_colors_section')}</h3>
                  <div class="grid grid-cols-4 gap-4">
                    {#each savedCompareColors as c}
                      <button
                        onclick={() => compareColor = c}
                        class="flex flex-col items-center gap-2 group"
                      >
                        <div class="w-full aspect-square rounded-2xl border border-gray-200 group-hover:scale-105 transition-transform" style="background-color: {c.hex}"></div>
                        <span class="text-[10px] font-medium text-gray-600 w-full truncate text-center">{c.code.split(" ").pop()}</span>
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}

              <div>
                <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">{$t('color.recent_scans')}</h3>
                {#if comparisonList.length === 0}
                  <p class="text-gray-400 text-sm italic">{$t('color.no_scans_compare')}</p>
                {:else}
                  <div class="grid grid-cols-4 gap-4">
                    {#each comparisonList as c}
                      <button
                        onclick={() => compareColor = c}
                        class="flex flex-col items-center gap-2 group"
                      >
                        <div class="w-full aspect-square rounded-2xl border border-gray-200 group-hover:scale-105 transition-transform" style="background-color: {c.hex}"></div>
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

          <div class="p-4 bg-white border-t border-gray-100 flex gap-3">
            <button
              onclick={confirmWheelColor}
              class="flex-1 py-3 px-4 bg-gray-900 text-white font-semibold rounded-2xl hover:bg-black transition-colors flex items-center justify-center gap-2"
            >
              <Check size={16} />
              {$t('color.confirm')}
            </button>
            <button
              onclick={resetWheel}
              class="py-3 px-4 bg-gray-100 text-gray-700 font-semibold rounded-2xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} />
              {$t('color.reset')}
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
          class="w-full bg-gray-900 text-white font-semibold py-4 rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2"
        >
          <Palette size={18} />
          <span>{$t('color.find_similar', { count: String(similarColors.length) })}</span>
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
          <h2 class="font-semibold text-gray-900">{$t('color.similar_colors')}</h2>
          <div class="w-10"></div>
        </div>

        <div class="p-4 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl border border-gray-200" style="background-color: {$detailColor.hex}"></div>
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
              <p>{$t('color.no_similar')}</p>
              <p class="text-sm mt-1">{$t('color.no_similar_hint')}</p>
            </div>
          {:else}
            {#each similarColors as item}
              <button
                onclick={() => selectSimilarColor(item.color)}
                class="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors cursor-pointer active:scale-[0.98] w-full text-left"
              >
                <div class="w-14 h-14 rounded-xl border border-gray-200 flex-shrink-0" style="background-color: {item.color.hex}"></div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="font-semibold text-gray-900">{item.color.code}</p>
                    <span class="text-[10px] px-2 py-0.5 rounded-full {item.source === 'history' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}">
                      {item.source === 'history' ? $t('color.your_scans') : $t('color.community_label')}
                    </span>
                  </div>
                  <p class="text-sm text-gray-500 truncate">{item.color.name}</p>
                  <p class="text-xs text-gray-400 mt-1">{$t('color.from_product', { product: item.productType })}</p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-gray-400">{$t('color.match')}</p>
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
