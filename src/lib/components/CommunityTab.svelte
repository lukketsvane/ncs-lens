<script lang="ts">
  import { Search, X, Globe, Layers, Heart, Flame, Clock, TrendingUp, ChevronDown, Grid3x3, LayoutGrid } from 'lucide-svelte';
  import { user } from '$lib/stores/auth';
  import { communityItems, detailItem, detailColor, activeTab } from '$lib/stores/app';
  import { likeScan, unlikeScan } from '$lib/scans';
  import { t } from '$lib/i18n';
  import type { HistoryItem, ColorMatch, SortOption } from '$lib/stores/app';

  let searchQuery = $state('');
  let showSearch = $state(false);
  let sortBy = $state<SortOption>('trending');
  let showSortMenu = $state(false);
  let paletteView = $state(false);

  // Example palette data for empty state
  const EXAMPLE_PALETTE_ITEMS: HistoryItem[] = [
    {
      id: 'example-1',
      timestamp: 1704067200000,
      image: '/IMG_7739.webp',
      result: {
        productType: 'Scandinavian Interior',
        materials: [{ name: 'Wood', texture: 'Smooth', finish: 'Matte' }],
        colors: [
          { system: 'NCS', code: 'S 0502-Y', name: 'Off White', hex: '#F5F3EF', location: 'Wall', confidence: 'High', materialGuess: 'Paint', finishGuess: 'Matte', laymanDescription: 'Warm white' },
          { system: 'NCS', code: 'S 2005-Y20R', name: 'Warm Beige', hex: '#D4CAB8', location: 'Floor', confidence: 'High', materialGuess: 'Oak', finishGuess: 'Natural', laymanDescription: 'Light oak' },
          { system: 'NCS', code: 'S 6010-G10Y', name: 'Forest Green', hex: '#5A6B5C', location: 'Accent', confidence: 'High', materialGuess: 'Fabric', finishGuess: 'Velvet', laymanDescription: 'Sage green' },
          { system: 'NCS', code: 'S 8502-Y', name: 'Charcoal', hex: '#3A3835', location: 'Frame', confidence: 'High', materialGuess: 'Metal', finishGuess: 'Powder coat', laymanDescription: 'Dark grey' },
        ],
      },
      author: 'NCS Lens',
      isPublic: true,
    },
  ];

  const displayItems = $derived($communityItems.length === 0 ? EXAMPLE_PALETTE_ITEMS : $communityItems);

  const filteredAndSortedItems = $derived.by(() => {
    let result = displayItems;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(item => {
        if (item.result.productType.toLowerCase().includes(query)) return true;
        if (item.result.materials.some(m =>
          m.name.toLowerCase().includes(query) ||
          m.finish.toLowerCase().includes(query)
        )) return true;
        if (item.result.colors.some(c =>
          c.name.toLowerCase().includes(query) ||
          c.code.toLowerCase().includes(query)
        )) return true;
        if (item.author && item.author.toLowerCase().includes(query)) return true;
        return false;
      });
    }

    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'trending':
          const aIsRecent = a.timestamp >= oneWeekAgo;
          const bIsRecent = b.timestamp >= oneWeekAgo;
          if (aIsRecent && !bIsRecent) return -1;
          if (!aIsRecent && bIsRecent) return 1;
          return (b.likeCount ?? 0) - (a.likeCount ?? 0);
        case 'newest':
          return b.timestamp - a.timestamp;
        case 'most_liked':
          return (b.likeCount ?? 0) - (a.likeCount ?? 0);
        default:
          return 0;
      }
    });

    return result;
  });

  const sortOptions = $derived([
    { value: 'trending' as SortOption, label: $t('community.trending') },
    { value: 'newest' as SortOption, label: $t('community.newest') },
    { value: 'most_liked' as SortOption, label: $t('community.most_liked') },
  ]);

  async function handleLike(scanId: string, isCurrentlyLiked: boolean) {
    if (!$user) {
      activeTab.set('profile');
      return;
    }

    communityItems.update(items => items.map(item => {
      if (item.id === scanId) {
        return {
          ...item,
          isLiked: !isCurrentlyLiked,
          likeCount: (item.likeCount ?? 0) + (isCurrentlyLiked ? -1 : 1)
        };
      }
      return item;
    }));

    const success = isCurrentlyLiked
      ? await unlikeScan(scanId, $user.id)
      : await likeScan(scanId, $user.id);

    if (!success) {
      communityItems.update(items => items.map(item => {
        if (item.id === scanId) {
          return {
            ...item,
            isLiked: isCurrentlyLiked,
            likeCount: (item.likeCount ?? 0) + (isCurrentlyLiked ? 1 : -1)
          };
        }
        return item;
      }));
    }
  }

  function selectItem(item: HistoryItem) {
    detailItem.set(item);
  }

  function selectColor(color: ColorMatch) {
    detailColor.set(color);
  }
</script>

<div class="min-h-full p-4 pt-8 pb-24 safe-area-top">
  <div class="flex items-center justify-between mb-4 px-1">
    {#if showSearch}
      <div class="flex-1 flex items-center gap-2">
        <div class="flex-1 relative">
          <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            bind:value={searchQuery}
            placeholder={$t('community.search_placeholder')}
            class="w-full pl-9 pr-4 py-2.5 bg-white rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
        <button
          onclick={() => { showSearch = false; searchQuery = ''; }}
          class="p-2 text-gray-500 hover:text-gray-700"
        >
          <X size={20} />
        </button>
      </div>
    {:else}
      <h1 class="text-2xl font-bold tracking-tight">{$t('community.title')}</h1>
      <div class="flex items-center gap-2">
        <button
          onclick={() => paletteView = !paletteView}
          class="p-2 rounded-full transition-colors {paletteView ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}"
          title={paletteView ? $t('community.show_cards') : $t('community.show_palette')}
        >
          {#if paletteView}
            <LayoutGrid size={20} />
          {:else}
            <Grid3x3 size={20} />
          {/if}
        </button>
        <button
          onclick={() => showSearch = true}
          class="p-2 bg-white rounded-full hover:bg-gray-50 transition-colors"
        >
          <Search size={20} class="text-gray-400" />
        </button>
      </div>
    {/if}
  </div>

  {#if !showSearch}
    <div class="mb-4 px-1 relative">
      <button
        onclick={() => showSortMenu = !showSortMenu}
        class="flex items-center gap-2 px-3 py-2 bg-white rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {#if sortBy === 'trending'}
          <Flame size={16} />
        {:else if sortBy === 'newest'}
          <Clock size={16} />
        {:else}
          <TrendingUp size={16} />
        {/if}
        <span>{sortOptions.find(o => o.value === sortBy)?.label}</span>
        <ChevronDown size={14} class="transition-transform {showSortMenu ? 'rotate-180' : ''}" />
      </button>

      {#if showSortMenu}
        <div class="absolute top-full left-1 mt-1 bg-white rounded-xl border border-gray-100 py-1 z-20 min-w-[180px]">
          {#each sortOptions as option}
            <button
              onclick={() => { sortBy = option.value; showSortMenu = false; }}
              class="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors {sortBy === option.value
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50'}"
            >
              {#if option.value === 'trending'}
                <Flame size={16} />
              {:else if option.value === 'newest'}
                <Clock size={16} />
              {:else}
                <TrendingUp size={16} />
              {/if}
              <span>{option.label}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if filteredAndSortedItems.length === 0}
    <div class="flex flex-col items-center justify-center h-[50vh] text-gray-400">
      {#if searchQuery}
        <Search size={48} class="mb-4 opacity-20" />
        <p>{$t('community.no_results', { query: searchQuery })}</p>
      {:else}
        <Globe size={48} class="mb-4 opacity-20" />
        <p>{$t('community.no_items')}</p>
      {/if}
    </div>
  {:else if paletteView}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {#each filteredAndSortedItems as item (item.id)}
        <div
          onclick={() => selectItem(item)}
          class="bg-white rounded-2xl border border-gray-100 overflow-hidden cursor-pointer active:scale-[0.98] transition-all"
          role="button"
          tabindex="0"
        >
          <div class="flex h-20">
            {#each item.result.colors.slice(0, 4) as color}
              <button
                class="flex-1 hover:opacity-80 transition-opacity"
                style="background-color: {color.hex}"
                onclick={(e) => { e.stopPropagation(); selectColor(color); }}
              ></button>
            {/each}
          </div>
          <div class="p-2">
            <p class="text-[10px] font-bold text-gray-900 truncate">{item.result.productType}</p>
            <div class="flex items-center justify-between mt-1">
              <p class="text-[9px] text-gray-400">{$t('community.colors_count', { count: String(item.result.colors.length) })}</p>
              <button
                onclick={(e) => { e.stopPropagation(); handleLike(item.id, item.isLiked ?? false); }}
                class="flex items-center gap-0.5 text-[10px] transition-colors {item.isLiked
                  ? 'text-red-500'
                  : 'text-gray-400 hover:text-red-400'}"
              >
                <Heart size={10} fill={item.isLiked ? 'currentColor' : 'none'} />
                {#if (item.likeCount ?? 0) > 0}
                  <span>{item.likeCount}</span>
                {/if}
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {#each filteredAndSortedItems as item (item.id)}
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
            <div class="flex items-center justify-between mt-2">
              <div class="flex items-center gap-1">
                {#each item.result.colors.slice(0, 3) as color}
                  <button
                    class="w-3 h-3 rounded-full border border-black/5 cursor-pointer hover:scale-125 transition-transform"
                    style="background-color: {color.hex}"
                    onclick={(e) => { e.stopPropagation(); selectColor(color); }}
                  ></button>
                {/each}
              </div>
              <button
                onclick={(e) => { e.stopPropagation(); handleLike(item.id, item.isLiked ?? false); }}
                class="flex items-center gap-1 text-xs transition-colors {item.isLiked
                  ? 'text-red-500'
                  : 'text-gray-400 hover:text-red-400'}"
              >
                <Heart size={14} fill={item.isLiked ? 'currentColor' : 'none'} />
                {#if (item.likeCount ?? 0) > 0}
                  <span>{item.likeCount}</span>
                {/if}
              </button>
            </div>
            {#if item.author}
              <p class="text-[10px] text-gray-400 mt-2">{$t('result.by_author', { author: item.author })}</p>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
