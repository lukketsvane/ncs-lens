<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { AlertCircle } from 'lucide-svelte';
  import { t } from '$lib/i18n';
</script>

<div class="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center p-4">
  <div class="bg-white rounded-[32px] p-8 max-w-sm w-full text-center border border-white">
    <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
      <AlertCircle size={32} class="text-red-400" />
    </div>
    <h1 class="text-2xl font-bold text-gray-900 mb-2">
      {$page.status}
    </h1>
    <p class="text-gray-500 mb-6">
      {$page.error?.message || $t('error.something_wrong')}
    </p>
    <button
      onclick={() => goto('/')}
      class="w-full bg-gray-900 text-white font-semibold py-3 rounded-2xl hover:bg-black transition-all"
    >
      {$t('error.go_home')}
    </button>
  </div>
</div>
