import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, LogOut, Loader2, CheckCircle2, Camera, ChevronRight } from 'lucide-react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { uploadAvatar } from '../lib/storage';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  updated_at: string | null;
}

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
    }

    if (data) {
      setProfile(data);
      setDisplayName(data.display_name || '');
      setAvatarUrl(data.avatar_url);
    }
    setLoading(false);
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    try {
      // Read file as data URL
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const dataUrl = reader.result as string;
          const url = await uploadAvatar(dataUrl, user.id);
          
          // Update profile with new avatar URL
          const { error } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              avatar_url: url,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });

          if (error) {
            console.error('Error updating avatar:', error);
            alert('Failed to update avatar');
          } else {
            setAvatarUrl(url);
            setProfile(prev => prev ? { ...prev, avatar_url: url } : null);
          }
        } catch (err) {
          console.error('Error uploading avatar:', err);
          alert('Failed to upload avatar');
        } finally {
          setUploadingAvatar(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error reading file:', err);
      setUploadingAvatar(false);
    }
  };

  const updateProfile = async () => {
    if (!user) return;

    setSaving(true);
    setSaved(false);

    const updates = {
      id: user.id,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('profiles')
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-full p-4 pb-24 safe-area-top">
      <h1 className="text-2xl font-bold tracking-tight mb-6 px-1">Profile</h1>

      <div className="max-w-md mx-auto space-y-4">
        {/* Profile Header */}
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-white">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                {uploadingAvatar ? (
                  <Loader2 size={24} className="animate-spin text-gray-400" />
                ) : avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User size={32} className="text-gray-400" />
                )}
              </div>
              <button 
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 p-1.5 bg-gray-900 text-white rounded-full shadow-sm hover:bg-black transition-colors disabled:opacity-50"
              >
                <Camera size={12} />
              </button>
              <input
                type="file"
                ref={avatarInputRef}
                onChange={handleAvatarSelect}
                accept="image/*"
                className="hidden"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg text-gray-900 truncate">
                {displayName || 'Set your name'}
              </h2>
              <p className="text-sm text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-white space-y-4">
          <h3 className="font-semibold text-gray-900 mb-4">Account Settings</h3>

          {/* Display Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
            />
          </div>

          {/* Email (Read-only) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">Email</label>
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
              <Mail size={16} className="text-gray-400" />
              <span className="text-sm text-gray-600">{user?.email}</span>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={updateProfile}
            disabled={saving}
            className="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : saved ? (
              <>
                <CheckCircle2 size={18} />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-[24px] shadow-sm border border-white overflow-hidden">
          <button
            onClick={handleSignOut}
            className="w-full px-6 py-4 flex items-center justify-between text-red-600 hover:bg-red-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <LogOut size={18} />
              <span className="font-medium">Sign Out</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Account Info */}
        <div className="text-center text-xs text-gray-400 pt-4">
          <p>Account created {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}
