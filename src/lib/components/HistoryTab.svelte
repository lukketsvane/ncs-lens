<script lang="ts">
  import { Layers, Heart, Trash2, FolderOpen, Loader2, Globe, Lock, Trash } from 'lucide-svelte';
  import { user } from '$lib/stores/auth';
  import { history, historySubTab, savedColors, detailItem, detailColor, boards } from '$lib/stores/app';
  import { deleteScan } from '$lib/scans';
  import { deleteImage } from '$lib/storage';
  import { getUserBoards, getBoardItems, deleteBoard, type Board } from '$lib/boards';
  import { t } from '$lib/i18n';
  import type { HistoryItem, ColorMatch } from '$lib/stores/app';

  let boardsLoading = $state(false);
  let selectedBoard = $state<Board | null>(null);
  let boardScans = $state<HistoryItem[]>([]);
  let boardScansLoading = $state(false);

  async function loadBoards() {
    if (!$user) return;
    boardsLoading = true;
    const userBoards = await getUserBoards($user.id);
    boards.set(userBoards);
    boardsLoading = false;
  }

  async function openBoard(board: Board) {
    selectedBoard = board;
    boardScansLoading = true;
    const scanIds = await getBoardItems(board.id);
    boardScans = $history.filter(h => scanIds.includes(h.id));
    boardScansLoading = false;
  }

  async function handleDeleteBoard(boardId: string, e: MouseEvent) {
    e.stopPropagation();
    const success = await deleteBoard(boardId);
    if (success) {
      boards.update(b => b.filter(x => x.id !== boardId));
      if (selectedBoard?.id === boardId) selectedBoard = null;
    }
  }

  $effect(() => {
    if ($historySubTab === 'boards' && $boards.length === 0) {
      loadBoards();
    }
  });

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
    <h1 class="text-2xl font-bold tracking-tight mb-6 px-1">{$t('history.title')}</h1>
    <div class="flex gap-2 mb-4">
      <button
        onclick={() => historySubTab.set('scans')}
        class="px-4 py-2 rounded-full text-sm font-semibold transition-all {$historySubTab === 'scans'
          ? 'bg-gray-900 text-white'
          : 'bg-white text-gray-600 hover:bg-gray-100'}"
      >
        <Layers size={14} class="inline mr-2" />
        {$t('history.scans')}
      </button>
      <button
        onclick={() => historySubTab.set('colors')}
        class="px-4 py-2 rounded-full text-sm font-semibold transition-all {$historySubTab === 'colors'
          ? 'bg-gray-900 text-white'
          : 'bg-white text-gray-600 hover:bg-gray-100'}"
      >
        <Heart size={14} class="inline mr-2" />
        {$t('history.saved_colors')} ({$savedColors.length})
      </button>
      <button
        onclick={() => historySubTab.set('boards')}
        class="px-4 py-2 rounded-full text-sm font-semibold transition-all {$historySubTab === 'boards'
          ? 'bg-gray-900 text-white'
          : 'bg-white text-gray-600 hover:bg-gray-100'}"
      >
        <FolderOpen size={14} class="inline mr-2" />
        {$t('boards.title')}
      </button>
    </div>
  </div>

  {#if $historySubTab === 'scans'}
    <div class="px-4">
      {#if $history.length === 0}
        <div class="flex flex-col items-center justify-center h-[50vh] text-gray-400">
          <Layers size={48} class="mb-4 opacity-20" />
          <p>{$t('history.no_scans')}</p>
          <p class="text-sm mt-1">{$t('history.no_scans_hint')}</p>
        </div>
      {:else}
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
  {:else if $historySubTab === 'colors'}
    <div class="px-4">
      {#if $savedColors.length === 0}
        <div class="flex flex-col items-center justify-center h-[50vh] text-gray-400">
          <Heart size={48} class="mb-4 opacity-20" />
          <p>{$t('history.no_colors')}</p>
          <p class="text-sm mt-1">{$t('history.no_colors_hint')}</p>
        </div>
      {:else}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
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
  {:else if $historySubTab === 'boards'}
    <div class="px-4">
      {#if boardsLoading}
        <div class="flex items-center justify-center h-[50vh]">
          <Loader2 size={32} class="animate-spin text-gray-400" />
        </div>
      {:else if selectedBoard}
        <div class="mb-4">
          <button onclick={() => selectedBoard = null} class="text-sm text-gray-500 hover:text-gray-700 mb-2">&larr; {$t('color.back')}</button>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-gray-900">{selectedBoard.name}</h2>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-400">{selectedBoard.is_public ? $t('boards.public') : $t('boards.private')}</span>
            </div>
          </div>
          {#if selectedBoard.description}
            <p class="text-sm text-gray-500 mt-1">{selectedBoard.description}</p>
          {/if}
        </div>
        {#if boardScansLoading}
          <div class="flex items-center justify-center py-12">
            <Loader2 size={24} class="animate-spin text-gray-400" />
          </div>
        {:else if boardScans.length === 0}
          <div class="flex flex-col items-center justify-center py-12 text-gray-400">
            <Layers size={32} class="mb-3 opacity-20" />
            <p class="text-sm">{$t('boards.no_boards')}</p>
          </div>
        {:else}
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {#each boardScans as item (item.id)}
              <button
                onclick={() => selectItem(item)}
                class="bg-white p-3 rounded-2xl border border-white flex flex-col gap-3 cursor-pointer active:scale-[0.98] transition-all text-left"
              >
                <div class="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                  <img src={item.image} class="w-full h-full object-cover" loading="lazy" alt={item.result.productType} />
                </div>
                <div class="min-w-0">
                  <h3 class="font-bold text-gray-900 text-sm truncate leading-tight">{item.result.productType}</h3>
                  <div class="flex items-center gap-1 mt-2">
                    {#each item.result.colors.slice(0, 3) as color}
                      <div class="w-3 h-3 rounded-full border border-black/5" style="background-color: {color.hex}"></div>
                    {/each}
                  </div>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      {:else if $boards.length === 0}
        <div class="flex flex-col items-center justify-center h-[50vh] text-gray-400">
          <FolderOpen size={48} class="mb-4 opacity-20" />
          <p>{$t('boards.no_boards')}</p>
          <p class="text-sm mt-1">{$t('boards.no_boards_hint')}</p>
        </div>
      {:else}
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {#each $boards as board (board.id)}
            <div
              onclick={() => openBoard(board)}
              class="bg-white p-4 rounded-2xl border border-white flex flex-col gap-3 cursor-pointer active:scale-[0.98] transition-all relative"
              role="button"
              tabindex="0"
            >
              <div class="flex items-center justify-between">
                <h3 class="font-bold text-gray-900 text-sm truncate">{board.name}</h3>
                <button
                  onclick={(e) => handleDeleteBoard(board.id, e)}
                  class="p-1 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash size={12} />
                </button>
              </div>
              {#if board.description}
                <p class="text-xs text-gray-500 truncate">{board.description}</p>
              {/if}
              <div class="flex items-center gap-2 text-[10px] text-gray-400">
                {#if board.is_public}
                  <Globe size={10} /> <span>{$t('boards.public')}</span>
                {:else}
                  <Lock size={10} /> <span>{$t('boards.private')}</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
