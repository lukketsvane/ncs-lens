<script lang="ts">
  import { toasts } from '$lib/stores/toast';
  import { AlertCircle, CheckCircle2, Info } from 'lucide-svelte';
</script>

{#if $toasts.length > 0}
  <div class="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center gap-2 p-4 safe-area-top pointer-events-none">
    {#each $toasts as toast (toast.id)}
      <div
        class="pointer-events-auto bg-white rounded-2xl px-4 py-3 flex items-center gap-3 max-w-sm w-full shadow-lg border {toast.type === 'error' ? 'border-red-200' : toast.type === 'success' ? 'border-green-200' : 'border-gray-100'}"
      >
        {#if toast.type === 'error'}
          <AlertCircle size={18} class="text-red-500 flex-shrink-0" />
        {:else if toast.type === 'success'}
          <CheckCircle2 size={18} class="text-green-500 flex-shrink-0" />
        {:else}
          <Info size={18} class="text-blue-500 flex-shrink-0" />
        {/if}
        <span class="text-sm font-medium text-gray-800">{toast.message}</span>
      </div>
    {/each}
  </div>
{/if}
