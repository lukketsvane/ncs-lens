import React, { useState } from 'react';
import { 
  User as UserIcon, 
  LogOut, 
  CreditCard, 
  Sparkles, 
  Check,
  ChevronRight,
  Camera,
  Crown,
  Settings,
  HelpCircle,
  Shield
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '../types';
import { stripeService } from '../services/stripe';

interface ProfileViewProps {
  onSignInClick: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ onSignInClick }) => {
  const { user, signOut, updateUser, remainingScans } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleUpgrade = async () => {
    if (!user) return;
    
    setIsUpgrading(true);
    try {
      const result = await stripeService.createCheckoutSession(user.id, SUBSCRIPTION_PLANS.pro.priceId);
      
      // Simulate successful upgrade (in production, this would be handled by Stripe webhook)
      updateUser({ subscription: 'pro' });
      setShowUpgradeModal(false);
    } catch (error) {
      console.error('Upgrade failed:', error);
      alert('Upgrade failed. Please try again.');
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  // Not logged in view
  if (!user) {
    return (
      <div className="min-h-full flex flex-col p-4 pt-safe-top pb-24">
        <h1 className="text-2xl font-bold tracking-tight mb-6 px-1">Profile</h1>
        
        <div className="flex-1 flex flex-col items-center justify-center pb-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <UserIcon size={40} className="text-gray-400" />
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to CMF Lens</h2>
          <p className="text-gray-500 text-center max-w-[280px] mb-8">
            Save your scans, join the community, and unlock more features.
          </p>
          
          <button
            onClick={onSignInClick}
            className="w-full max-w-[300px] bg-white border border-gray-200 text-gray-900 font-semibold py-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>
      </div>
    );
  }

  const plan = SUBSCRIPTION_PLANS[user.subscription];
  const isPro = user.subscription === 'pro';

  return (
    <div className="min-h-full p-4 pt-safe-top pb-24">
      <h1 className="text-2xl font-bold tracking-tight mb-6 px-1">Profile</h1>
      
      {/* User Info Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <UserIcon size={28} className="text-gray-400" />
              </div>
            )}
            {isPro && (
              <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-amber-400 to-amber-500 p-1.5 rounded-full shadow-sm">
                <Crown size={12} className="text-white" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg text-gray-900 truncate">{user.displayName}</h2>
            <p className="text-gray-500 text-sm truncate">{user.email}</p>
          </div>
        </div>
        
        {/* Subscription Badge */}
        <div className={`p-4 rounded-2xl ${isPro ? 'bg-gradient-to-r from-amber-50 to-amber-100' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isPro ? (
                <Crown size={18} className="text-amber-600" />
              ) : (
                <Sparkles size={18} className="text-gray-600" />
              )}
              <span className="font-semibold text-gray-900">{plan.name} Plan</span>
            </div>
            
            {!isPro && (
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="text-sm font-semibold text-amber-600 hover:text-amber-700"
              >
                Upgrade
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scan Quota Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-gray-600" />
            <span className="font-semibold text-gray-900">Daily Scans</span>
          </div>
        </div>
        
        {isPro ? (
          <div className="flex items-center gap-2 text-green-600">
            <Check size={16} />
            <span className="font-medium">Unlimited scans</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">
                {remainingScans} of {plan.scanLimit} remaining
              </span>
              <span className="text-sm font-mono text-gray-900">
                {user.scansToday}/{plan.scanLimit}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  remainingScans === 0 ? 'bg-red-500' : 
                  remainingScans <= 2 ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${(user.scansToday / plan.scanLimit) * 100}%` }}
              />
            </div>
            {remainingScans === 0 && (
              <p className="text-red-500 text-sm mt-2">
                Quota reached. Upgrade to Pro for unlimited scans!
              </p>
            )}
          </>
        )}
      </div>

      {/* Settings Menu */}
      <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-4">
        <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100">
          <div className="flex items-center gap-3">
            <CreditCard size={20} className="text-gray-500" />
            <span className="font-medium text-gray-900">Billing & Subscription</span>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>
        
        <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-gray-500" />
            <span className="font-medium text-gray-900">Settings</span>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>
        
        <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-gray-500" />
            <span className="font-medium text-gray-900">Privacy</span>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>
        
        <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <HelpCircle size={20} className="text-gray-500" />
            <span className="font-medium text-gray-900">Help & Support</span>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>
      </div>

      {/* Sign Out Button */}
      <button
        onClick={handleSignOut}
        className="w-full bg-white rounded-3xl p-4 shadow-sm flex items-center justify-center gap-2 text-red-500 font-medium hover:bg-red-50 transition-colors"
      >
        <LogOut size={20} />
        <span>Sign Out</span>
      </button>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 animate-in slide-in-from-bottom duration-300">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Upgrade to Pro</h2>
              <p className="text-gray-500">
                ${SUBSCRIPTION_PLANS.pro.price}/month
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {SUBSCRIPTION_PLANS.pro.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check size={12} className="text-green-600" />
                  </div>
                  <span className="text-gray-700">{feature}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <button
                onClick={handleUpgrade}
                disabled={isUpgrading}
                className="w-full bg-gradient-to-r from-amber-400 to-amber-500 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              >
                {isUpgrading ? 'Processing...' : 'Subscribe Now'}
              </button>
              
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full text-gray-500 font-medium py-3"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileView;
