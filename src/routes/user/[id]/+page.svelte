<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ChevronLeft, Globe, Calendar } from 'lucide-svelte';
  import { getPublicScansByUser, getProfileById, type ScanRecord } from '$lib/scans';
  import { detailItem } from '$lib/stores/app';
  import { t } from '$lib/i18n';
  import type { HistoryItem } from '$lib/stores/app';

  let profile = $state<{ id: string; display_name: string; avatar_url: string; created_at: string } | null>(null);
  let scans = $state<HistoryItem[]>([]);
  let loading = $state(true);

  onMount(async () => {
    const userId = $page.params.id;
    if (!userId) {
      goto('/');
      return;
    }

    const [profileData, scanData] = await Promise.all([
      getProfileById(userId),
      getPublicScansByUser(userId),
    ]);

    profile = profileData;
    scans = scanData.map((scan: ScanRecord) => ({
      id: scan.id,
      timestamp: new Date(scan.created_at).getTime(),
      image: scan.image_url,
      result: scan.result,
      isPublic: true,
      userId: scan.user_id,
    }));
    loading = false;
  });

  function handleBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      goto('/');
    }
  }

  function selectItem(item: HistoryItem) {
    detailItem.set(item);
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
    } catch {
      return '';
    }
  }
</script>

<div class="min-h-screen bg-[#F0F2F5] safe-area-top safe-area-bottom">
  {#if loading}
    <div class="fixed inset-0 bg-[#F0F2F5] flex items-center justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
    </div>
  {:else}
    <div class="p-4 min-h-full pb-20">
      <!-- Header -->
      <div class="flex items-center mb-6">
        <button onclick={handleBack} class="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors">
          <ChevronLeft size={20} />
        </button>
      </div>

      <!-- Profile Card -->
      <div class="max-w-md mx-auto">
        <div class="bg-white rounded-[24px] p-6 mb-6">
          <div class="flex items-center gap-4">
            {#if profile?.avatar_url}
              <img
                src={profile.avatar_url}
                alt={profile.display_name || $t('profile.anonymous')}
                class="w-16 h-16 rounded-full object-cover border-2 border-gray-100"
              />
            {:else}
              <div class="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-2xl font-bold">
                {(profile?.display_name || '?')[0].toUpperCase()}
              </div>
            {/if}
            <div>
              <h1 class="text-xl font-bold text-gray-900">{profile?.display_name || $t('profile.anonymous')}</h1>
              {#if profile?.created_at}
                <p class="text-sm text-gray-400 flex items-center gap-1 mt-1">
                  <Calendar size={12} />
                  {$t('profile.member_since', { date: formatDate(profile.created_at) })}
                </p>
              {/if}
            </div>
          </div>
        </div>

        <!-- Public Scans -->
        <h2 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-1">{$t('profile.public_scans')}</h2>

        {#if scans.length === 0}
          <div class="flex flex-col items-center justify-center h-[30vh] text-gray-400">
            <Globe size={48} class="mb-4 opacity-20" />
            <p>{$t('profile.no_public_scans')}</p>
          </div>
        {:else}
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {#each scans as item (item.id)}
              <div
                onclick={() => selectItem(item)}
                class="bg-white p-3 rounded-2xl border border-white flex flex-col gap-3 cursor-pointer active:scale-[0.98] transition-all"
                role="button"
                tabindex="0"
              >
                <div class="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                  <img src={item.image} class="w-full h-full object-cover" loading="lazy" alt={item.result.productType} />
                </div>
                <div class="min-w-0">
                  <h3 class="font-bold text-gray-900 text-sm truncate leading-tight">{item.result.productType}</h3>
                  <div class="flex items-center gap-1 mt-2">
                    {#each item.result.colors.slice(0, 4) as color}
                      <div
                        class="w-3 h-3 rounded-full border border-black/5"
                        style="background-color: {color.hex}"
                      ></div>
                    {/each}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
