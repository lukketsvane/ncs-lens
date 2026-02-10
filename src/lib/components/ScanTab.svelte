<script lang="ts">
  import { Sparkles, Camera, Image as ImageIcon, Loader2, User, Zap } from 'lucide-svelte';
  import { user } from '$lib/stores/auth';
  import { loading, salientMode, detailItem, history, activeTab } from '$lib/stores/app';
  import { analyzeImage } from '$lib/api';
  import { createScan } from '$lib/scans';
  import { uploadImage } from '$lib/storage';
  import { toasts } from '$lib/stores/toast';
  import { t } from '$lib/i18n';
  import type { HistoryItem } from '$lib/stores/app';

  let fileInput: HTMLInputElement;

  async function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) await processFile(file);
  }

  async function processFile(file: File) {
    if (!$user) return;

    loading.set(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];

        const result = await analyzeImage(base64, $salientMode);
        const imageUrl = await uploadImage(dataUrl, $user!.id);
        const scan = await createScan($user!.id, imageUrl, result);

        if (scan) {
          const newItem: HistoryItem = {
            id: scan.id,
            timestamp: new Date(scan.created_at).getTime(),
            image: imageUrl,
            result: result,
            isPublic: false
          };
          history.update(h => [newItem, ...h]);
          detailItem.set(newItem);
        }
        activeTab.set('scan');
      } catch (err) {
        console.error('Analysis failed:', err);
        toasts.error($t('scan.failed'));
      } finally {
        loading.set(false);
      }
    };
    reader.readAsDataURL(file);
  }
</script>

<div class="min-h-full pb-24 safe-area-top">
  <div class="p-4 flex flex-col min-h-[calc(100vh-6rem)]">
    <h1 class="text-2xl font-bold tracking-tight mb-8 mt-2 px-1">{$t('scan.title')}</h1>

    <div class="flex-1 flex flex-col justify-center items-center pb-12">
      {#if $loading}
        <div class="group relative bg-white rounded-[40px] w-full max-w-[320px] aspect-[3/4] border border-white flex flex-col items-center justify-center gap-6 overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-tr from-gray-50 via-white to-gray-50 opacity-50"></div>
          <div class="relative z-10">
            <Loader2 size={48} class="animate-spin text-black" />
          </div>
          <div class="relative z-10 text-center space-y-2">
            <h2 class="text-xl font-bold text-gray-900 tracking-tight">{$t('scan.analyzing')}</h2>
            <p class="text-sm text-gray-400 animate-pulse">{$t('scan.analyzing_desc')}</p>
          </div>
        </div>
      {:else if !$user}
        <div class="group relative bg-gray-100 rounded-[40px] w-full max-w-[320px] aspect-[3/4] border border-gray-200 flex flex-col items-center justify-center gap-6 overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-tr from-gray-100 via-gray-50 to-gray-100 opacity-60"></div>
          <div class="relative z-10 w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center">
            <Sparkles size={32} class="text-gray-300" />
          </div>
          <div class="relative z-10 text-center space-y-3 px-6">
            <h2 class="text-xl font-bold text-gray-400 tracking-tight">{$t('scan.sign_in_to_scan')}</h2>
            <p class="text-sm text-gray-400 leading-relaxed">{$t('scan.sign_in_desc')}</p>
            <button
              onclick={() => activeTab.set('profile')}
              class="mt-4 bg-gray-900 text-white font-semibold py-3 px-6 rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-2 mx-auto"
            >
              <User size={18} />
              <span>{$t('scan.sign_in_button')}</span>
            </button>
          </div>
        </div>
      {:else}
        <button
          onclick={() => fileInput.click()}
          class="group relative cursor-pointer bg-white rounded-[40px] w-full max-w-[320px] aspect-[3/4] border border-white flex flex-col items-center justify-center gap-8 overflow-hidden transition-all active:scale-[0.98]"
        >
          <div class="absolute inset-0 bg-gradient-to-tr from-gray-50 via-white to-gray-50 opacity-50"></div>
          <div class="relative z-10 w-24 h-24 bg-[#F5F5F7] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
            <Sparkles size={36} class="text-gray-400 group-hover:text-black transition-colors duration-500" />
          </div>
          <div class="relative z-10 text-center space-y-3">
            <h2 class="text-2xl font-bold text-gray-900 tracking-tight">{$t('scan.new_scan')}</h2>
            <div class="flex items-center justify-center gap-3 text-gray-400 text-sm font-medium bg-white px-4 py-2 rounded-full">
              <Camera size={16} /> <span class="w-px h-3 bg-gray-200"></span> <ImageIcon size={16} />
            </div>
          </div>
        </button>
      {/if}

      {#if $user}
        <button
          onclick={() => salientMode.update(v => !v)}
          class="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all {$salientMode
            ? 'bg-amber-100 text-amber-700 border border-amber-200'
            : 'bg-gray-100 text-gray-500 border border-gray-200'}"
        >
          <Zap size={12} class={$salientMode ? 'text-amber-500' : 'text-gray-400'} />
          <span>{$t('scan.salient')}</span>
          <div class="w-6 h-3.5 rounded-full transition-colors {$salientMode ? 'bg-amber-400' : 'bg-gray-300'} relative">
            <div class="absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform {$salientMode ? 'translate-x-3' : 'translate-x-0.5'}"></div>
          </div>
        </button>
      {/if}

      <p class="mt-8 text-center text-sm text-gray-400 max-w-[260px] leading-relaxed">
        {$t('scan.help_text')}
      </p>
    </div>
  </div>
</div>

<input
  bind:this={fileInput}
  type="file"
  onchange={handleFileSelect}
  accept="image/*"
  class="hidden"
/>
