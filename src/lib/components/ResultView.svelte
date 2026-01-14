<script lang="ts">
  import { ChevronLeft, RotateCcw, Globe, Lock, Loader2, RefreshCw, Pencil, Check, ArrowRight } from 'lucide-svelte';
  import { user } from '$lib/stores/auth';
  import { detailItem, detailColor, history, communityItems, loading, salientMode } from '$lib/stores/app';
  import { publishScan, unpublishScan, updateScan } from '$lib/scans';
  import { analyzeImage } from '$lib/api';
  import { swipeGesture } from '$lib/actions/swipeGesture';
  import type { ColorMatch, AnalysisResult } from '$lib/stores/app';

  let isPublishing = $state(false);
  let isUnpublishing = $state(false);
  let isPublic = $state($detailItem?.isPublic ?? false);
  let editingProductType = $state(false);
  let editedProductType = $state($detailItem?.result.productType ?? '');

  $effect(() => {
    isPublic = $detailItem?.isPublic ?? false;
    editedProductType = $detailItem?.result.productType ?? '';
  });

  const isOwner = $derived(!!($user && !$detailItem?.author));

  function getContrastColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? 'text-black' : 'text-white';
  }

  function handleBack() {
    detailItem.set(null);
  }

  async function handlePublish() {
    if (!$detailItem || isPublic) return;
    isPublishing = true;
    const success = await publishScan($detailItem.id);
    if (success) {
      isPublic = true;
      detailItem.update(item => item ? { ...item, isPublic: true } : null);
      history.update(items => items.map(item => 
        item.id === $detailItem!.id ? { ...item, isPublic: true } : item
      ));
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
      history.update(items => items.map(item => 
        item.id === $detailItem!.id ? { ...item, isPublic: false } : item
      ));
      communityItems.update(items => items.filter(item => item.id !== $detailItem!.id));
    }
    isUnpublishing = false;
  }

  async function handleSaveProductType() {
    if (!$detailItem || editedProductType === $detailItem.result.productType) {
      editingProductType = false;
      return;
    }
    const newResult = { ...$detailItem.result, productType: editedProductType };
    const success = await updateScan($detailItem.id, { result: newResult });
    if (success) {
      detailItem.update(item => item ? { ...item, result: newResult } : null);
      history.update(items => items.map(item => 
        item.id === $detailItem!.id ? { ...item, result: newResult } : item
      ));
      if ($detailItem.isPublic) {
        communityItems.update(items => items.map(item => 
          item.id === $detailItem!.id ? { ...item, result: newResult } : item
        ));
      }
    }
    editingProductType = false;
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
      history.update(items => items.map(item => 
        item.id === $detailItem!.id ? updatedItem : item
      ));
    } catch (err) {
      console.error('Regeneration failed:', err);
      alert("Regeneration failed.");
    } finally {
      loading.set(false);
    }
  }

  function selectColor(color: ColorMatch) {
    detailColor.set(color);
  }
</script>

{#if $detailItem}
  <div 
    class="fixed inset-0 bg-[#F0F2F5] z-40 overflow-y-auto no-scrollbar safe-area-top safe-area-bottom"
    use:swipeGesture={{ onSwipeRight: handleBack, threshold: 50, edgeThreshold: 40 }}
  >
    <div class="p-4 min-h-full pb-20">
      <div class="flex justify-between items-center mb-6">
        <button onclick={handleBack} class="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100">
          <ChevronLeft size={20} />
        </button>
        
        <div class="flex items-center gap-1 max-w-[200px]">
          {#if editingProductType}
            <div class="flex items-center gap-1">
              <input
                type="text"
                bind:value={editedProductType}
                class="font-semibold text-center bg-white px-2 py-1 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/10 max-w-[160px]"
                onkeydown={(e) => {
                  if (e.key === 'Enter') handleSaveProductType();
                  if (e.key === 'Escape') {
                    editedProductType = $detailItem!.result.productType;
                    editingProductType = false;
                  }
                }}
              />
              <button 
                onclick={handleSaveProductType}
                class="p-1 hover:bg-gray-100 rounded-full"
              >
                <Check size={14} class="text-green-600" />
              </button>
            </div>
          {:else}
            <span class="font-semibold truncate text-center">{$detailItem.result.productType}</span>
            {#if isOwner}
              <button 
                onclick={() => editingProductType = true}
                class="p-1 hover:bg-gray-100 rounded-full opacity-40 hover:opacity-100 transition-opacity"
                title="Edit product name"
              >
                <Pencil size={12} />
              </button>
            {/if}
          {/if}
        </div>
        
        {#if isOwner}
          <button 
            onclick={isPublic ? handleUnpublish : handlePublish}
            disabled={isPublishing || isUnpublishing}
            class="p-2 rounded-full shadow-sm transition-all duration-300 {isPublic ? 'bg-green-100 text-green-700' : 'bg-white text-gray-500'}"
            title={isPublic ? 'Public - click to make private' : 'Private - click to publish'}
          >
            {#if isPublishing || isUnpublishing}
              <Loader2 size={20} class="animate-spin" />
            {:else if isPublic}
              <Globe size={20} />
            {:else}
              <Lock size={20} />
            {/if}
          </button>
        {:else}
          <div class="w-10"></div>
        {/if}
      </div>

      <div class="max-w-md mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
        <div class="relative rounded-[32px] overflow-hidden bg-gray-200 aspect-square shadow-sm group">
          <img src={$detailItem.image} class="w-full h-full object-cover" alt="Product" />
          {#if isOwner}
            <button 
              onclick={handleRegenerate}
              class="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-semibold shadow-sm hover:bg-white transition-colors"
            >
              <RotateCcw size={14} class="text-gray-600" />
              <span class="text-gray-800">Re-analyze</span>
            </button>
          {/if}
          {#if $detailItem.author}
            <div class="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium text-white">
              by {$detailItem.author}
            </div>
          {/if}
        </div>

        <div class="bg-white rounded-[24px] p-5 shadow-sm border border-white/50">
          <div class="text-sm text-gray-400 font-medium mb-1">Materials</div>
          <div class="flex flex-wrap gap-2">
            {#each $detailItem.result.materials as material}
              <span class="px-3 py-1.5 bg-gray-100 rounded-full text-xs font-semibold text-gray-600 border border-gray-200">
                {material.name} <span class="opacity-50 font-normal">· {material.finish}</span>
              </span>
            {/each}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 pb-8">
          {#each $detailItem.result.colors as color, i}
            {@const textColorClass = getContrastColor(color.hex)}
            {@const isFull = i === 0 && $detailItem.result.colors.length % 2 !== 0}
            
            <div 
              class="relative group rounded-[24px] p-5 flex flex-col justify-between h-40 shadow-sm transition-transform {isFull ? 'col-span-2' : 'col-span-1'}"
              style="background-color: {color.hex}"
            >
              <div class="flex justify-between items-start {textColorClass} opacity-80">
                <span class="text-[10px] font-bold tracking-widest uppercase bg-black/10 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/10">{color.system}</span>
                
                <div class="flex items-center gap-2">
                  {#if isOwner}
                    <button 
                      onclick={(e) => { e.stopPropagation(); handleRegenerate(); }}
                      class="p-1.5 rounded-full hover:bg-black/10 transition-colors"
                    >
                      <RefreshCw size={14} class={textColorClass === 'text-black' ? 'text-black/60' : 'text-white/80'} />
                    </button>
                  {/if}
                  <button
                    onclick={() => selectColor(color)}
                    class="cursor-pointer"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
              
              <button 
                onclick={() => selectColor(color)}
                class="cursor-pointer {textColorClass} text-left"
              >
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
