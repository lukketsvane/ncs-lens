<script lang="ts">
  import { locale } from '$lib/i18n';
  import { onMount } from 'svelte';

  let { children } = $props();

  onMount(() => {
    locale.set('en');
    return () => locale.set('no');
  });
</script>

{@render children()}
