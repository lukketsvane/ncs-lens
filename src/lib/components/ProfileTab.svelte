<script lang="ts">
  import { Loader2, Mail, Lock, ArrowRight, AlertCircle, User, LogOut, CheckCircle2, Camera, ChevronRight, FileText, Globe, Crown, Sparkles } from 'lucide-svelte';
  import { user, signIn, signUp, signOut } from '$lib/stores/auth';
  import { supabase } from '$lib/supabase';
  import { uploadAvatar } from '$lib/storage';
  import { getPublicScansByUser, type ScanRecord } from '$lib/scans';
  import { detailItem } from '$lib/stores/app';
  import type { HistoryItem } from '$lib/stores/app';
  import { goto } from '$app/navigation';
  import { toasts } from '$lib/stores/toast';
  import { t, locale } from '$lib/i18n';
  import { getSubscription, subscribeFree, cancelSubscription, type Subscription } from '$lib/subscription';

  interface Profile {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    updated_at: string | null;
  }

  let isSignUp = $state(false);
  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let authLoading = $state(false);
  let authError = $state<string | null>(null);

  let profile = $state<Profile | null>(null);
  let displayName = $state('');
  let avatarUrl = $state<string | null>(null);
  let profileLoading = $state(true);
  let bio = $state('');
  let saving = $state(false);
  let saved = $state(false);
  let uploadingAvatar = $state(false);
  let avatarInput: HTMLInputElement;
  let publicScans = $state<HistoryItem[]>([]);

  let subscription = $state<Subscription | null>(null);
  let subscriptionLoading = $state(false);

  $effect(() => {
    if ($user) {
      fetchProfile();
    } else {
      profileLoading = false;
    }
  });

  async function fetchProfile() {
    if (!$user) return;
    profileLoading = true;
    const [profileResult, scansData, sub] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', $user.id).single(),
      getPublicScansByUser($user.id),
      getSubscription($user.id),
    ]);
    const { data, error } = profileResult;
    if (error && error.code !== 'PGRST116') console.error('Error fetching profile:', error);
    if (data) {
      profile = data;
      displayName = data.display_name || '';
      avatarUrl = data.avatar_url;
      bio = data.bio || '';
    }
    subscription = sub;
    publicScans = scansData.map((scan: ScanRecord) => ({
      id: scan.id,
      timestamp: new Date(scan.created_at).getTime(),
      image: scan.image_url,
      result: scan.result,
      isPublic: true,
    }));
    profileLoading = false;
  }

  async function handleAuthSubmit(e: SubmitEvent) {
    e.preventDefault();
    authError = null;
    authLoading = true;
    if (isSignUp && password !== confirmPassword) {
      authError = $t('profile.passwords_no_match');
      authLoading = false;
      return;
    }
    if (password.length < 6) {
      authError = $t('profile.password_min');
      authLoading = false;
      return;
    }
    try {
      const { error } = isSignUp ? await signUp(email, password) : await signIn(email, password);
      if (error) authError = error.message;
    } catch (err) {
      authError = $t('profile.unexpected_error');
    } finally {
      authLoading = false;
    }
  }

  async function handleAvatarSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file || !$user) return;
    uploadingAvatar = true;
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const dataUrl = reader.result as string;
          const url = await uploadAvatar(dataUrl, $user!.id);
          const { error } = await supabase.from('profiles').upsert({ id: $user!.id, avatar_url: url, updated_at: new Date().toISOString() }, { onConflict: 'id' });
          if (error) {
            console.error('Error updating avatar:', error);
            toasts.error($t('profile.avatar_update_failed'));
          } else {
            avatarUrl = url;
            if (profile) profile.avatar_url = url;
          }
        } catch (err) {
          console.error('Error uploading avatar:', err);
          toasts.error($t('profile.avatar_upload_failed'));
        } finally {
          uploadingAvatar = false;
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error reading file:', err);
      uploadingAvatar = false;
    }
  }

  async function updateProfile() {
    if (!$user) return;
    saving = true;
    saved = false;
    const { error } = await supabase.from('profiles').upsert({ id: $user.id, display_name: displayName, bio, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) {
      console.error('Error updating profile:', error);
      toasts.error($t('profile.profile_update_failed'));
    } else {
      saved = true;
      setTimeout(() => saved = false, 2000);
    }
    saving = false;
  }

  async function handleActivateSubscription() {
    if (!$user) return;
    subscriptionLoading = true;
    const success = await subscribeFree($user.id);
    if (success) {
      subscription = await getSubscription($user.id);
      toasts.success($t('subscription.activated'));
    } else {
      toasts.error($t('subscription.error'));
    }
    subscriptionLoading = false;
  }

  async function handleCancelSubscription() {
    if (!$user) return;
    subscriptionLoading = true;
    const success = await cancelSubscription($user.id);
    if (success) {
      subscription = null;
      toasts.success($t('subscription.cancelled'));
    } else {
      toasts.error($t('subscription.error'));
    }
    subscriptionLoading = false;
  }

  async function handleSignOut() {
    await signOut();
  }
</script>

{#if !$user}
  <div class="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center p-4 safe-area-top safe-area-bottom">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold tracking-tight mb-2">{$t('profile.app_title')}</h1>
        <p class="text-gray-500 text-sm">{isSignUp ? $t('profile.create_account') : $t('profile.welcome_back')}</p>
      </div>

      <div class="bg-white rounded-[32px] p-8 border border-white">
        <form onsubmit={handleAuthSubmit} class="space-y-4">
          <div class="relative">
            <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none"><Mail size={18} class="text-gray-400" /></div>
            <input type="email" placeholder={$t('profile.email_placeholder')} bind:value={email} required class="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" />
          </div>

          <div class="relative">
            <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none"><Lock size={18} class="text-gray-400" /></div>
            <input type="password" placeholder={$t('profile.password_placeholder')} bind:value={password} required class="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" />
          </div>

          {#if isSignUp}
            <div class="relative">
              <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none"><Lock size={18} class="text-gray-400" /></div>
              <input type="password" placeholder={$t('profile.confirm_password')} bind:value={confirmPassword} required class="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" />
            </div>
          {/if}

          {#if authError}
            <div class="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-600 text-sm">
              <AlertCircle size={16} /><span>{authError}</span>
            </div>
          {/if}

          <button type="submit" disabled={authLoading} class="w-full bg-gray-900 text-white font-semibold py-4 rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {#if authLoading}
              <Loader2 size={20} class="animate-spin" />
            {:else}
              <span>{isSignUp ? $t('profile.create_account_btn') : $t('profile.sign_in_btn')}</span>
              <ArrowRight size={18} />
            {/if}
          </button>
        </form>

        <div class="mt-6 text-center">
          <button type="button" onclick={() => { isSignUp = !isSignUp; authError = null; }} class="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            {isSignUp ? $t('profile.has_account') : $t('profile.no_account')}
          </button>
        </div>

        <div class="mt-6">
          <div class="relative flex items-center gap-4 my-4">
            <div class="flex-1 h-px bg-gray-200"></div>
            <span class="text-xs text-gray-400 uppercase">{$t('profile.or_divider')}</span>
            <div class="flex-1 h-px bg-gray-200"></div>
          </div>
          <a
            href="/api/vipps/login"
            aria-label={$t('profile.sign_in_vipps')}
            class="w-full bg-[#FF5B24] text-white font-semibold py-4 rounded-2xl hover:bg-[#E54D1B] transition-all flex items-center justify-center gap-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.7 6.3c-1.1-1.1-2.5-1.8-4-2L12 4c-1.5.2-2.9.9-4 2C6.5 7.5 6 9.2 6 11c0 3.3 2.7 6 6 6s6-2.7 6-6c0-1.8-.5-3.5-1.7-4.7h1.4z" fill="white"/>
            </svg>
            <span>{$t('profile.sign_in_vipps')}</span>
          </a>
        </div>
      </div>

      <p class="text-center text-xs text-gray-400 mt-6">{$t('profile.terms_agree')}</p>
    </div>
  </div>
{:else}
  {#if profileLoading}
    <div class="min-h-full flex items-center justify-center"><Loader2 class="animate-spin text-gray-400" size={32} /></div>
  {:else}
    <div class="min-h-full p-4 pb-24 safe-area-top">
      <h1 class="text-2xl font-bold tracking-tight mb-6 px-1">{$t('profile.title')}</h1>

      <div class="max-w-md mx-auto space-y-4">
        <div class="bg-white rounded-[24px] p-6 border border-white">
          <div class="flex items-center gap-4">
            <div class="relative">
              <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                {#if uploadingAvatar}
                  <Loader2 size={24} class="animate-spin text-gray-400" />
                {:else if avatarUrl}
                  <img src={avatarUrl} alt="Avatar" class="w-full h-full rounded-full object-cover" />
                {:else}
                  <User size={32} class="text-gray-400" />
                {/if}
              </div>
              <button onclick={() => avatarInput.click()} disabled={uploadingAvatar} class="absolute bottom-0 right-0 p-1.5 bg-gray-900 text-white rounded-full hover:bg-black transition-colors disabled:opacity-50"><Camera size={12} /></button>
              <input bind:this={avatarInput} type="file" onchange={handleAvatarSelect} accept="image/*" class="hidden" />
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="font-bold text-lg text-gray-900 truncate">{displayName || $t('profile.set_name')}</h2>
              <p class="text-sm text-gray-500 truncate">{$user?.email}</p>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-[24px] p-6 border border-white space-y-4">
          <h3 class="font-semibold text-gray-900 mb-4">{$t('profile.account_settings')}</h3>
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-600">{$t('profile.display_name')}</label>
            <input type="text" bind:value={displayName} placeholder={$t('profile.enter_name')} class="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition-all" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-600">{$t('profile.bio')}</label>
            <textarea bind:value={bio} placeholder={$t('profile.bio_placeholder')} rows="3" class="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition-all resize-none"></textarea>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-600">{$t('profile.email')}</label>
            <div class="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
              <Mail size={16} class="text-gray-400" /><span class="text-sm text-gray-600">{$user?.email}</span>
            </div>
          </div>
          <button onclick={updateProfile} disabled={saving} class="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {#if saving}
              <Loader2 size={18} class="animate-spin" />
            {:else if saved}
              <CheckCircle2 size={18} /><span>{$t('profile.saved')}</span>
            {:else}
              <span>{$t('profile.save_changes')}</span>
            {/if}
          </button>
        </div>

        <div class="bg-white rounded-[24px] p-6 border border-white space-y-4">
          <div class="flex items-center gap-2 mb-2">
            <Crown size={18} class="text-amber-500" />
            <h3 class="font-semibold text-gray-900">{$t('subscription.title')}</h3>
          </div>

          {#if subscription}
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <Sparkles size={16} class="text-amber-500" />
                  <span class="font-semibold text-amber-800">{$t('subscription.pro_plan')}</span>
                </div>
                <span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">{$t('subscription.active')}</span>
              </div>
              <p class="text-sm text-amber-700">{$t('subscription.pro_plan_desc')}</p>
              {#if subscription.end_date}
                <p class="text-xs text-amber-600 mt-2">{$t('subscription.expires', { date: new Date(subscription.end_date).toLocaleDateString() })}</p>
              {/if}
            </div>
            <button onclick={handleCancelSubscription} disabled={subscriptionLoading} class="w-full py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {#if subscriptionLoading}
                <Loader2 size={16} class="animate-spin" />
              {:else}
                {$t('subscription.cancel')}
              {/if}
            </button>
          {:else}
            <div class="bg-gray-50 rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="font-medium text-gray-700">{$t('subscription.free_plan')}</span>
              </div>
              <p class="text-sm text-gray-500">{$t('subscription.free_plan_desc')}</p>
            </div>
            <button onclick={handleActivateSubscription} disabled={subscriptionLoading} class="w-full bg-amber-500 text-white font-semibold py-3 rounded-xl hover:bg-amber-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {#if subscriptionLoading}
                <Loader2 size={16} class="animate-spin" />
              {:else}
                <Crown size={16} />
                <span>{$t('subscription.activate')}</span>
              {/if}
            </button>
          {/if}
        </div>

        <div class="bg-white rounded-[24px] border border-white overflow-hidden">
          <button onclick={() => goto($locale === 'en' ? '/en/vilkaar' : '/vilkaar')} class="w-full px-6 py-4 flex items-center justify-between text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100">
            <div class="flex items-center gap-3"><FileText size={18} /><span class="font-medium">{$t('profile.vilkaar')}</span></div>
            <ChevronRight size={18} class="text-gray-400" />
          </button>
          <button onclick={handleSignOut} class="w-full px-6 py-4 flex items-center justify-between text-red-600 hover:bg-red-50 transition-colors">
            <div class="flex items-center gap-3"><LogOut size={18} /><span class="font-medium">{$t('profile.sign_out')}</span></div>
            <ChevronRight size={18} class="text-gray-400" />
          </button>
        </div>

        <div>
          <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-1">{$t('profile.my_public_scans')}</h3>
          {#if publicScans.length === 0}
            <div class="flex flex-col items-center justify-center py-12 text-gray-400">
              <Globe size={32} class="mb-3 opacity-20" />
              <p class="text-sm">{$t('profile.no_public_scans_self')}</p>
            </div>
          {:else}
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {#each publicScans as item (item.id)}
                <button
                  onclick={() => detailItem.set(item)}
                  class="bg-white p-3 rounded-2xl border border-white flex flex-col gap-3 cursor-pointer active:scale-[0.98] transition-all text-left"
                >
                  <div class="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    <img src={item.image} class="w-full h-full object-cover" loading="lazy" alt={item.result.productType} />
                  </div>
                  <div class="min-w-0">
                    <h3 class="font-bold text-gray-900 text-sm truncate leading-tight">{item.result.productType}</h3>
                    <div class="flex items-center gap-1 mt-2">
                      {#each item.result.colors.slice(0, 4) as color}
                        <div class="w-3 h-3 rounded-full border border-black/5" style="background-color: {color.hex}"></div>
                      {/each}
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <div class="text-center text-xs text-gray-400 pt-4">
          <p>{$t('profile.account_created', { date: $user?.created_at ? new Date($user.created_at).toLocaleDateString() : 'N/A' })}</p>
        </div>
      </div>
    </div>
  {/if}
{/if}
