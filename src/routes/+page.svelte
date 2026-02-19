<script lang="ts">
  import { activeTab, history, communityItems, savedColors, savedColorKeys, dataLoading, loading, detailItem, detailColor, salientMode } from '$lib/stores/app';
  import { user, isLoggedIn } from '$lib/stores/auth';
  import { onMount } from 'svelte';
  import { getUserScans, getPublicScans, getLikesInfo, type ScanRecord } from '$lib/scans';
  import { getSavedColors } from '$lib/saved-colors';
  import { toasts } from '$lib/stores/toast';
  import { t } from '$lib/i18n';
  import { page } from '$app/stores';
  import type { HistoryItem } from '$lib/stores/app';

  import ScanTab from '$lib/components/ScanTab.svelte';
  import PaletteTab from '$lib/components/PaletteTab.svelte';
  import HistoryTab from '$lib/components/HistoryTab.svelte';
  import CommunityTab from '$lib/components/CommunityTab.svelte';
  import ProfileTab from '$lib/components/ProfileTab.svelte';

  // Handle subscription callback params
  onMount(async () => {
    const subscriptionParam = $page.url.searchParams.get('subscription');
    if (subscriptionParam) {
      if (subscriptionParam === 'success') {
        toasts.success($t('subscription.activated'));
      } else {
        toasts.error($t('subscription.error'));
      }
      activeTab.set('profile');
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('subscription');
      window.history.replaceState({}, '', cleanUrl.toString());
    }

    await loadData();
  });

  // Reload data when user changes
  $effect(() => {
    if ($user !== undefined) {
      loadData();
    }
  });

  async function loadData() {
    dataLoading.set(true);
    try {
      if ($user) {
        const userScans = await getUserScans($user.id);
        const historyItems: HistoryItem[] = userScans.map((scan: ScanRecord) => ({
          id: scan.id,
          timestamp: new Date(scan.created_at).getTime(),
          image: scan.image_url,
          result: scan.result,
          isPublic: scan.is_public,
        }));
        history.set(historyItems);

        const colors = await getSavedColors($user.id);
        savedColors.set(colors);
        savedColorKeys.set(new Set(colors.map(c => `${c.color_system}:${c.color_code}`)));
      } else {
        history.set([]);
        savedColors.set([]);
        savedColorKeys.set(new Set());
      }

      const publicScans = await getPublicScans();
      const scanIds = publicScans.map(s => s.id);
      const likesInfo = await getLikesInfo(scanIds, $user?.id);

      const items: HistoryItem[] = publicScans.map((scan: ScanRecord) => {
        const likeInfo = likesInfo.get(scan.id) || { count: 0, liked: false };
        return {
          id: scan.id,
          timestamp: new Date(scan.created_at).getTime(),
          image: scan.image_url,
          result: scan.result,
          author: scan.author || 'Anonymous',
          isPublic: true,
          likeCount: likeInfo.count,
          isLiked: likeInfo.liked,
          userId: scan.user_id,
        };
      });
      communityItems.set(items);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      dataLoading.set(false);
    }
  }
</script>

{#if $dataLoading}
  <div class="fixed inset-0 bg-[#F0F2F5] flex items-center justify-center">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
  </div>
{:else}
  {#if $activeTab === 'scan'}
    <ScanTab />
  {:else if $activeTab === 'palette'}
    <PaletteTab />
  {:else if $activeTab === 'history'}
    <HistoryTab />
  {:else if $activeTab === 'community'}
    <CommunityTab />
  {:else if $activeTab === 'profile'}
    <ProfileTab />
  {/if}
{/if}
