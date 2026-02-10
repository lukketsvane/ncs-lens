<script lang="ts">
  import '../app.css';
  import { Camera, Palette, Layers, Globe, User } from 'lucide-svelte';
  import { activeTab, detailItem, detailColor, selectedPaletteColor, boardSelectorScanId } from '$lib/stores/app';
  import { initAuth } from '$lib/stores/auth';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { t } from '$lib/i18n';
  import Toast from '$lib/components/Toast.svelte';
  import ResultView from '$lib/components/ResultView.svelte';
  import ColorDetailView from '$lib/components/ColorDetailView.svelte';
  import PaletteColorModal from '$lib/components/PaletteColorModal.svelte';
  import BoardSelector from '$lib/components/BoardSelector.svelte';

  let { children } = $props();

  onMount(() => {
    initAuth();
  });

  const showNav = $derived($page.url.pathname === '/' || $page.url.pathname === '/en');
</script>

<div class="min-h-screen bg-[#F0F2F5] text-[#111] font-sans">
  <Toast />
  <main class="h-full">
    {@render children()}
  </main>

  <!-- Global Overlays (accessible from all routes) -->
  {#if $detailItem}
    <ResultView />
  {/if}

  {#if $selectedPaletteColor}
    <PaletteColorModal />
  {/if}

  {#if $detailColor}
    <ColorDetailView />
  {/if}

  {#if $boardSelectorScanId}
    <BoardSelector scanId={$boardSelectorScanId} onclose={() => boardSelectorScanId.set(null)} />
  {/if}

  <!-- Bottom Navigation -->
  {#if showNav}
    <div class="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-100 pb-safe-bottom z-30">
      <div class="flex justify-around items-center h-16 max-w-md mx-auto">
        <button
          onclick={() => activeTab.set('scan')}
          class="flex flex-col items-center gap-1 p-2 transition-colors {$activeTab === 'scan' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}"
        >
          <Camera strokeWidth={$activeTab === 'scan' ? 2.5 : 2} size={24} />
          <span class="text-[10px] font-medium">{$t('nav.scan')}</span>
        </button>

        <button
          onclick={() => activeTab.set('palette')}
          class="flex flex-col items-center gap-1 p-2 transition-colors {$activeTab === 'palette' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}"
        >
          <Palette strokeWidth={$activeTab === 'palette' ? 2.5 : 2} size={24} />
          <span class="text-[10px] font-medium">{$t('nav.palette')}</span>
        </button>

        <button
          onclick={() => activeTab.set('history')}
          class="flex flex-col items-center gap-1 p-2 transition-colors {$activeTab === 'history' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}"
        >
          <Layers strokeWidth={$activeTab === 'history' ? 2.5 : 2} size={24} />
          <span class="text-[10px] font-medium">{$t('nav.collection')}</span>
        </button>

        <button
          onclick={() => activeTab.set('community')}
          class="flex flex-col items-center gap-1 p-2 transition-colors {$activeTab === 'community' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}"
        >
          <Globe strokeWidth={$activeTab === 'community' ? 2.5 : 2} size={24} />
          <span class="text-[10px] font-medium">{$t('nav.community')}</span>
        </button>

        <button
          onclick={() => activeTab.set('profile')}
          class="flex flex-col items-center gap-1 p-2 transition-colors {$activeTab === 'profile' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}"
        >
          <User strokeWidth={$activeTab === 'profile' ? 2.5 : 2} size={24} />
          <span class="text-[10px] font-medium">{$t('nav.profile')}</span>
        </button>
      </div>
    </div>
  {/if}
</div>
