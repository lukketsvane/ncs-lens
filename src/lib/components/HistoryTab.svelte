<script lang="ts">
  import { Layers, Heart, Trash2 } from 'lucide-svelte';
  import { user } from '$lib/stores/auth';
  import { history, historySubTab, savedColors, detailItem, detailColor } from '$lib/stores/app';
  import { deleteScan } from '$lib/scans';
  import { deleteImage } from '$lib/storage';
  import type { HistoryItem, ColorMatch } from '$lib/stores/app';

  async function handleDelete(id: string) {
    const item = $history.find(h => h.id === id);
    
    const success = await deleteScan(id);
    
    if (success) {
      if (item && $user && !item.image.startsWith('data:')) {
        try {
          await deleteImage(item.image, $user.id);
        } catch (err) {
          console.warn('Failed to delete image from storage:', err);
        }
      }
      
      history.update(h => h.filter(i => i.id !== id));
    }
  }

  function selectItem(item: HistoryItem) {
    detailItem.set(item);
  }

  function selectColor(color: ColorMatch) {
    detailColor.set(color);
  }

  // Convert SavedColor to ColorMatch for display
  function savedColorToMatch(color: typeof $savedColors[number]): ColorMatch {
    return {
      system: color.color_system,
      code: color.color_code,
      name: color.color_name || color.color_code,
      hex: color.color_hex,
      location: '-',
      confidence: 'High',
      materialGuess: '-',
      finishGuess: '-',
      laymanDescription: '-',
    };
  }
</script>

<div class="min-h-full pb-24 safe-area-top">
  <div class="p-4 pb-0">
    <h1 class="text-2xl font-bold tracking-tight mb-4 px-1">My Collection</h1>
    <div class="flex gap-2 mb-4">
      <button
        onclick={() => historySubTab.set('scans')}
        class="px-4 py-2 rounded-full text-sm font-semibold transition-all {$historySubTab === 'scans' 
          ? 'bg-gray-900 text-white' 
          : 'bg-white text-gray-600 hover:bg-gray-100'}"
      >
        <Layers size={14} class="inline mr-2" />
        Scans
      </button>
      <button
        onclick={() => historySubTab.set('colors')}
        class="px-4 py-2 rounded-full text-sm font-semibold transition-all {$historySubTab === 'colors' 
          ? 'bg-gray-900 text-white' 
          : 'bg-white text-gray-600 hover:bg-gray-100'}"
      >
        <Heart size={14} class="inline mr-2" />
        Saved Colors ({$savedColors.length})
      </button>
    </div>
  </div>

  {#if $historySubTab === 'scans'}
    <div class="px-4">
      {#if $history.length === 0}
        <div class="flex flex-col items-center justify-center h-[50vh] text-gray-400">
          <Layers size={48} class="mb-4 opacity-20" />
          <p>No scans yet</p>
          <p class="text-sm mt-1">Take a photo to get started!</p>
        </div>
      {:else}
        <div class="grid grid-cols-2 gap-3">
          {#each $history as item (item.id)}
            <div 
              onclick={() => selectItem(item)} 
              class="bg-white p-3 rounded-2xl border border-white flex flex-col gap-3 cursor-pointer active:scale-[0.98] transition-all"
              role="button"
              tabindex="0"
            >
              <div class="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                <img src={item.image} class="w-full h-full object-cover" loading="lazy" alt={item.result.productType} />
                {#if $user}
                  <button 
                    onclick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                    class="absolute top-2 right-2 p-1.5 bg-black/20 backdrop-blur-md rounded-full text-white/80 hover:bg-red-500 hover:text-white transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                {/if}
              </div>
              <div class="min-w-0">
                <h3 class="font-bold text-gray-900 text-sm truncate leading-tight">{item.result.productType}</h3>
                <div class="flex items-center gap-1 mt-2">
                  {#each item.result.colors.slice(0, 3) as color}
                    <button 
                      class="w-3 h-3 rounded-full border border-black/5 cursor-pointer hover:scale-125 transition-transform" 
                      style="background-color: {color.hex}"
                      onclick={(e) => { e.stopPropagation(); selectColor(color); }}
                    ></button>
                  {/each}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="px-4">
      {#if $savedColors.length === 0}
        <div class="flex flex-col items-center justify-center h-[50vh] text-gray-400">
          <Heart size={48} class="mb-4 opacity-20" />
          <p>No saved colors yet</p>
          <p class="text-sm mt-1">Tap the heart icon on any color to save it!</p>
        </div>
      {:else}
        <div class="grid grid-cols-3 gap-3">
          {#each $savedColors as color (color.id)}
            <div 
              onclick={() => selectColor(savedColorToMatch(color))}
              class="bg-white p-3 rounded-2xl border border-white flex flex-col gap-2 cursor-pointer active:scale-[0.98] transition-all"
              role="button"
              tabindex="0"
            >
              <div 
                class="aspect-square rounded-xl border border-gray-100" 
                style="background-color: {color.color_hex}"
              ></div>
              <div class="min-w-0 text-center">
                <p class="font-bold text-gray-900 text-xs truncate">{color.color_code.split(' ').pop()}</p>
                <p class="text-[10px] text-gray-400 truncate">{color.color_system}</p>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
