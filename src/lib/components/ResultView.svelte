<script lang="ts">
  import { ChevronLeft, RotateCcw, Globe, Lock, Loader2, RefreshCw, Pencil, Check, ArrowRight, Heart, GitCompare, Bookmark } from 'lucide-svelte';
  import { user } from '$lib/stores/auth';
  import { detailItem, detailColor, history, communityItems, loading, salientMode, savedColorKeys, savedColors, compareTarget, boardSelectorScanId } from '$lib/stores/app';
  import { publishScan, unpublishScan, updateScan } from '$lib/scans';
  import { saveColor, unsaveColor } from '$lib/saved-colors';
  import { analyzeImage } from '$lib/api';
  import { swipeGesture } from '$lib/actions/swipeGesture';
  import { toasts } from '$lib/stores/toast';
  import { t } from '$lib/i18n';
  import type { ColorMatch, AnalysisResult } from '$lib/stores/app';
  import { goto } from '$app/navigation';

  let isPublishing = $state(false);
  let isUnpublishing = $state(false);
  let isPublic = $state($detailItem?.isPublic ?? false);
  let editingProductType = $state(false);
  let swipeProgress = $state(0);
  let swipeReturning = $state(false);
  let editedProductType = $state($detailItem?.result.productType ?? '');
  let editingDescription = $state(false);
  let editedDescription = $state($detailItem?.result.description ?? '');

  $effect(() => {
    isPublic = $detailItem?.isPublic ?? false;
    editedProductType = $detailItem?.result.productType ?? '';
    editedDescription = $detailItem?.result.description ?? '';
  });

  const isOwner = $derived(!!($user && !$detailItem?.author));

  function getContrastColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? 'text-black' : 'text-white';
  }

  function handleBack() { detailItem.set(null); }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleBack();
  }

  async function handlePublish() {
    if (!$detailItem || isPublic) return;
    isPublishing = true;
    const success = await publishScan($detailItem.id);
    if (success) {
      isPublic = true;
      detailItem.update(item => item ? { ...item, isPublic: true } : null);
      history.update(items => items.map(item => item.id === $detailItem!.id ? { ...item, isPublic: true } : item));
      communityItems.update(items => [...items, { ...$detailItem!, author: "You", isPublic: true }]);
    }
    isPublishing = false;
  }

  async function handleUnpublish() {
    if (!$detailItem || !isPublic) return;
    isUnpublishing = true;
    const success = await unpublishScan($detailItem.id);
    if (success) {
      isPublic = false;
      detailItem.update(item => item ? { ...item, isPublic: false } : null);
      history.update(items => items.map(item => item.id === $detailItem!.id ? { ...item, isPublic: false } : item));
      communityItems.update(items => items.filter(item => item.id !== $detailItem!.id));
    }
    isUnpublishing = false;
  }

  async function handleSaveProductType() {
    if (!$detailItem || editedProductType === $detailItem.result.productType) { editingProductType = false; return; }
    const newResult = { ...$detailItem.result, productType: editedProductType };
    const success = await updateScan($detailItem.id, { result: newResult });
    if (success) {
      detailItem.update(item => item ? { ...item, result: newResult } : null);
      history.update(items => items.map(item => item.id === $detailItem!.id ? { ...item, result: newResult } : item));
      if ($detailItem.isPublic) {
        communityItems.update(items => items.map(item => item.id === $detailItem!.id ? { ...item, result: newResult } : item));
      }
    }
    editingProductType = false;
  }

  async function handleSaveDescription() {
    if (!$detailItem) { editingDescription = false; return; }
    const newResult = { ...$detailItem.result, description: editedDescription || undefined };
    const success = await updateScan($detailItem.id, { result: newResult });
    if (success) {
      detailItem.update(item => item ? { ...item, result: newResult } : null);
      history.update(items => items.map(item => item.id === $detailItem!.id ? { ...item, result: newResult } : item));
      if ($detailItem.isPublic) {
        communityItems.update(items => items.map(item => item.id === $detailItem!.id ? { ...item, result: newResult } : item));
      }
    }
    editingDescription = false;
  }

  async function handleRegenerate() {
    if (!$detailItem || !$user) return;
    loading.set(true);
    try {
      let base64: string;
      if ($detailItem.image.startsWith('data:')) {
        base64 = $detailItem.image.split(",")[1];
      } else {
        const response = await fetch($detailItem.image);
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read image data'));
          reader.readAsDataURL(blob);
        });
        base64 = dataUrl.split(",")[1];
      }
      const result = await analyzeImage(base64, $salientMode);
      await updateScan($detailItem.id, { result });
      const updatedItem = { ...$detailItem, result, timestamp: Date.now() };
      detailItem.set(updatedItem);
      history.update(items => items.map(item => item.id === $detailItem!.id ? updatedItem : item));
    } catch (err) {
      console.error('Regeneration failed:', err);
      toasts.error($t('result.regeneration_failed'));
    } finally {
      loading.set(false);
    }
  }

  function selectColor(color: ColorMatch) { detailColor.set(color); }

  function compareWithColor(color: ColorMatch, otherColor: ColorMatch, e: MouseEvent) {
    e.stopPropagation();
    compareTarget.set(otherColor);
    detailColor.set(color);
  }

  async function toggleSaveColor(color: ColorMatch, e: MouseEvent) {
    e.stopPropagation();
    if (!$user) return;
    const key = `${color.system}:${color.code}`;
    if ($savedColorKeys.has(key)) {
      const success = await unsaveColor($user.id, color.system, color.code);
      if (success) {
        savedColors.update(colors => colors.filter(c => !(c.color_system === color.system && c.color_code === color.code)));
        savedColorKeys.update(keys => { const next = new Set(keys); next.delete(key); return next; });
      }
    } else {
      const saved = await saveColor($user.id, { system: color.system, code: color.code, name: color.name, hex: color.hex });
      if (saved) {
        savedColors.update(colors => [saved, ...colors]);
        savedColorKeys.update(keys => new Set([...keys, key]));
      }
    }
  }

  function navigateToAuthor() {
    if ($detailItem?.userId) {
      goto(`/user/${$detailItem.userId}`);
    }
  }
</script>

{#if $detailItem}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 bg-[#F0F2F5] z-40 overflow-y-auto no-scrollbar safe-area-top safe-area-bottom"
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
        class="fixed left-0 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
        style="opacity: {Math.min(1, swipeProgress * 2)}; transform: translateX({swipeProgress * 20}px) translateY(-50%)"
      >
        <div class="bg-black/20 backdrop-blur-md rounded-r-full p-2 pl-1">
          <ChevronLeft size={20} class="text-white" />
        </div>
      </div>
    {/if}

    <div class="p-4 min-h-full pb-20">
      <div class="flex justify-between items-center mb-6">
        <button onclick={handleBack} class="p-2 bg-white rounded-full hover:bg-gray-100"><ChevronLeft size={20} /></button>

        <div class="flex items-center gap-1 max-w-[200px]">
          {#if editingProductType}
            <div class="flex items-center gap-1">
              <input type="text" bind:value={editedProductType} class="font-semibold text-center bg-white px-2 py-1 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/10 max-w-[160px]"
                onkeydown={(e) => { if (e.key === 'Enter') handleSaveProductType(); if (e.key === 'Escape') { editedProductType = $detailItem!.result.productType; editingProductType = false; } }} />
              <button onclick={handleSaveProductType} class="p-1 hover:bg-gray-100 rounded-full"><Check size={14} class="text-green-600" /></button>
            </div>
          {:else}
            <span class="font-semibold truncate text-center">{$detailItem.result.productType}</span>
            {#if isOwner}
              <button onclick={() => editingProductType = true} class="p-1 hover:bg-gray-100 rounded-full opacity-40 hover:opacity-100 transition-opacity" title={$t('result.edit_name')}><Pencil size={12} /></button>
            {/if}
          {/if}
        </div>

        {#if isOwner}
          <button onclick={isPublic ? handleUnpublish : handlePublish} disabled={isPublishing || isUnpublishing}
            class="p-2 rounded-full transition-all duration-300 {isPublic ? 'bg-green-100 text-green-700' : 'bg-white text-gray-500'}"
            title={isPublic ? $t('result.public_hint') : $t('result.private_hint')}>
            {#if isPublishing || isUnpublishing}<Loader2 size={20} class="animate-spin" />{:else if isPublic}<Globe size={20} />{:else}<Lock size={20} />{/if}
          </button>
        {:else}<div class="w-10"></div>{/if}
      </div>

      <div class="max-w-md mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
        <div class="relative rounded-[32px] overflow-hidden bg-gray-200 aspect-square group">
          <img src={$detailItem.image} class="w-full h-full object-cover" alt="Product" />
          {#if isOwner}
            <button onclick={handleRegenerate} class="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-semibold hover:bg-white transition-colors">
              <RotateCcw size={14} class="text-gray-600" /><span class="text-gray-800">{$t('result.reanalyze')}</span>
            </button>
          {/if}
          {#if $detailItem.author}
            <button
              onclick={(e) => { e.stopPropagation(); navigateToAuthor(); }}
              class="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium text-white hover:bg-black/70 transition-colors"
            >
              {$t('result.by_author', { author: $detailItem.author })}
            </button>
          {/if}
          {#if $user}
            <button
              onclick={() => boardSelectorScanId.set($detailItem!.id)}
              class="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-2 rounded-full hover:bg-white transition-colors"
              title={$t('boards.add_to_board')}
            >
              <Bookmark size={16} class="text-gray-700" />
            </button>
          {/if}
        </div>

        <div class="bg-white rounded-[24px] p-5 border border-white/50">
          <div class="text-sm text-gray-400 font-medium mb-1">{$t('result.materials')}</div>
          <div class="flex flex-wrap gap-2">
            {#each $detailItem.result.materials as material}
              <span class="px-3 py-1.5 bg-gray-100 rounded-full text-xs font-semibold text-gray-600 border border-gray-200">
                {material.name} <span class="opacity-50 font-normal">&middot; {material.finish}</span>
              </span>
            {/each}
          </div>
        </div>

        {#if isOwner || $detailItem.result.description}
          <div class="bg-white rounded-[24px] p-5 border border-white/50">
            {#if editingDescription}
              <textarea
                bind:value={editedDescription}
                placeholder={$t('result.description_placeholder')}
                rows="3"
                class="w-full text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 resize-none"
                onkeydown={(e) => { if (e.key === 'Escape') { editedDescription = $detailItem!.result.description ?? ''; editingDescription = false; } }}
              ></textarea>
              <div class="flex justify-end gap-2 mt-2">
                <button onclick={() => { editedDescription = $detailItem!.result.description ?? ''; editingDescription = false; }} class="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">{$t('color.back')}</button>
                <button onclick={handleSaveDescription} class="text-xs font-semibold text-white bg-gray-900 px-3 py-1.5 rounded-lg hover:bg-black"><Check size={12} class="inline mr-1" />{$t('profile.save_changes')}</button>
              </div>
            {:else if $detailItem.result.description}
              <button onclick={() => { if (isOwner) editingDescription = true; }} class="text-sm text-gray-600 leading-relaxed text-left w-full {isOwner ? 'cursor-pointer hover:text-gray-900' : 'cursor-default'}">
                {$detailItem.result.description}
              </button>
            {:else if isOwner}
              <button onclick={() => editingDescription = true} class="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                + {$t('result.add_description')}
              </button>
            {/if}
          </div>
        {/if}

        <div class="grid grid-cols-2 gap-3 pb-8">
          {#each $detailItem.result.colors as color, i}
            {@const textColorClass = getContrastColor(color.hex)}
            {@const isFull = i === 0 && $detailItem.result.colors.length % 2 !== 0}
            <div class="relative group rounded-[24px] p-5 flex flex-col justify-between h-40 transition-transform {isFull ? 'col-span-2' : 'col-span-1'}" style="background-color: {color.hex}">
              <div class="flex justify-between items-start {textColorClass} opacity-80">
                <span class="text-[10px] font-bold tracking-widest uppercase bg-black/10 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/10">{color.system}</span>
                <div class="flex items-center gap-2">
                  {#if $user}
                    <button onclick={(e) => toggleSaveColor(color, e)} class="p-1.5 rounded-full hover:bg-black/10 transition-colors">
                      <Heart size={14} fill={$savedColorKeys.has(`${color.system}:${color.code}`) ? 'currentColor' : 'none'} class={$savedColorKeys.has(`${color.system}:${color.code}`) ? 'text-red-500' : ''} />
                    </button>
                  {/if}
                  {#if $detailItem.result.colors.length >= 2}
                    {@const otherColor = $detailItem.result.colors.find((c, j) => j !== i) ?? $detailItem.result.colors[0]}
                    <button onclick={(e) => compareWithColor(color, otherColor, e)} class="p-1.5 rounded-full hover:bg-black/10 transition-colors" title={$t('color.compare')}>
                      <GitCompare size={14} />
                    </button>
                  {/if}
                  {#if isOwner}
                    <button onclick={(e) => { e.stopPropagation(); handleRegenerate(); }} class="p-1.5 rounded-full hover:bg-black/10 transition-colors">
                      <RefreshCw size={14} class={textColorClass === 'text-black' ? 'text-black/60' : 'text-white/80'} />
                    </button>
                  {/if}
                  <button onclick={() => selectColor(color)} class="cursor-pointer"><ArrowRight size={16} /></button>
                </div>
              </div>
              <button onclick={() => selectColor(color)} class="cursor-pointer {textColorClass} text-left">
                <div class="text-3xl font-bold tracking-tighter">{color.code.split(" ").pop()}</div>
                <div class="text-xs font-medium opacity-80 truncate mt-1">{color.name}</div>
              </button>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}
