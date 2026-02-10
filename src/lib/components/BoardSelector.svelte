<script lang="ts">
  import { X, Plus, Check, Loader2, FolderOpen } from 'lucide-svelte';
  import { user } from '$lib/stores/auth';
  import { boards } from '$lib/stores/app';
  import { getUserBoards, createBoard, addToBoard, removeFromBoard, getBoardsForScan, type Board } from '$lib/boards';
  import { toasts } from '$lib/stores/toast';
  import { t } from '$lib/i18n';

  interface Props {
    scanId: string;
    onclose: () => void;
  }

  let { scanId, onclose }: Props = $props();

  let loading = $state(true);
  let creating = $state(false);
  let newBoardName = $state('');
  let selectedBoardIds = $state<Set<string>>(new Set());
  let initialBoardIds = $state<Set<string>>(new Set());

  $effect(() => {
    loadData();
  });

  async function loadData() {
    if (!$user) return;
    loading = true;
    const [userBoards, scanBoardIds] = await Promise.all([
      getUserBoards($user.id),
      getBoardsForScan($user.id, scanId),
    ]);
    boards.set(userBoards);
    selectedBoardIds = new Set(scanBoardIds);
    initialBoardIds = new Set(scanBoardIds);
    loading = false;
  }

  async function toggleBoard(boardId: string) {
    if (selectedBoardIds.has(boardId)) {
      const success = await removeFromBoard(boardId, scanId);
      if (success) {
        selectedBoardIds = new Set([...selectedBoardIds].filter(id => id !== boardId));
      }
    } else {
      const item = await addToBoard(boardId, scanId);
      if (item) {
        selectedBoardIds = new Set([...selectedBoardIds, boardId]);
      }
    }
  }

  async function handleCreateBoard() {
    if (!$user || !newBoardName.trim()) return;
    creating = true;
    const board = await createBoard($user.id, newBoardName.trim());
    if (board) {
      boards.update(b => [board, ...b]);
      await addToBoard(board.id, scanId);
      selectedBoardIds = new Set([...selectedBoardIds, board.id]);
      newBoardName = '';
    }
    creating = false;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80] flex items-end justify-center" onclick={onclose}>
  <div
    class="bg-white w-full max-w-md rounded-t-[32px] p-6 pb-8 safe-area-bottom animate-in slide-in-from-bottom duration-300"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-bold text-gray-900">{$t('boards.add_to_board')}</h2>
      <button onclick={onclose} class="p-2 rounded-full hover:bg-gray-100">
        <X size={20} class="text-gray-500" />
      </button>
    </div>

    {#if loading}
      <div class="flex items-center justify-center py-12">
        <Loader2 size={24} class="animate-spin text-gray-400" />
      </div>
    {:else}
      <div class="space-y-2 max-h-[40vh] overflow-y-auto mb-4">
        {#if $boards.length === 0}
          <div class="flex flex-col items-center justify-center py-8 text-gray-400">
            <FolderOpen size={32} class="mb-3 opacity-20" />
            <p class="text-sm">{$t('boards.no_boards')}</p>
          </div>
        {:else}
          {#each $boards as board (board.id)}
            <button
              onclick={() => toggleBoard(board.id)}
              class="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors {selectedBoardIds.has(board.id) ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}"
            >
              <span class="font-medium text-sm truncate">{board.name}</span>
              {#if selectedBoardIds.has(board.id)}
                <Check size={18} />
              {/if}
            </button>
          {/each}
        {/if}
      </div>

      <div class="flex gap-2">
        <input
          type="text"
          bind:value={newBoardName}
          placeholder={$t('boards.name_placeholder')}
          class="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
          onkeydown={(e) => { if (e.key === 'Enter') handleCreateBoard(); }}
        />
        <button
          onclick={handleCreateBoard}
          disabled={creating || !newBoardName.trim()}
          class="px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {#if creating}
            <Loader2 size={16} class="animate-spin" />
          {:else}
            <Plus size={16} />
          {/if}
        </button>
      </div>
    {/if}
  </div>
</div>
