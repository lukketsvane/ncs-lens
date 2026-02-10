<script lang="ts">
  import { Loader2, Mail, Lock, ArrowRight, AlertCircle, User, LogOut, CheckCircle2, Camera, ChevronRight, FileText } from 'lucide-svelte';
  import { user, signIn, signUp, signOut } from '$lib/stores/auth';
  import { supabase } from '$lib/supabase';
  import { uploadAvatar } from '$lib/storage';
  import { goto } from '$app/navigation';
  import { toasts } from '$lib/stores/toast';
  import { t, locale } from '$lib/i18n';

  interface Profile {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
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
  let saving = $state(false);
  let saved = $state(false);
  let uploadingAvatar = $state(false);
  let avatarInput: HTMLInputElement;

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
    const { data, error } = await supabase.from('profiles').select('*').eq('id', $user.id).single();
    if (error && error.code !== 'PGRST116') console.error('Error fetching profile:', error);
    if (data) {
      profile = data;
      displayName = data.display_name || '';
      avatarUrl = data.avatar_url;
    }
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
    const { error } = await supabase.from('profiles').upsert({ id: $user.id, display_name: displayName, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) {
      console.error('Error updating profile:', error);
      toasts.error($t('profile.profile_update_failed'));
    } else {
      saved = true;
      setTimeout(() => saved = false, 2000);
    }
    saving = false;
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

        <div class="text-center text-xs text-gray-400 pt-4">
          <p>{$t('profile.account_created', { date: $user?.created_at ? new Date($user.created_at).toLocaleDateString() : 'N/A' })}</p>
        </div>
      </div>
    </div>
  {/if}
{/if}
