import React from 'react';
import { X, Camera, Crown, Check } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../types';

interface QuotaExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

const QuotaExceededModal: React.FC<QuotaExceededModalProps> = ({ isOpen, onClose, onUpgrade }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Camera size={28} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Daily Limit Reached</h2>
          <p className="text-gray-500 text-sm">
            You've used all {SUBSCRIPTION_PLANS.free.scanLimit} free scans for today.
          </p>
        </div>

        {/* Options */}
        <div className="space-y-4 mb-6">
          <div className="bg-gray-50 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <span className="text-sm font-medium">Wait until tomorrow</span>
            </div>
            <p className="text-xs text-gray-400">
              Your quota resets at midnight (local time)
            </p>
          </div>

          <div className="text-center text-gray-400 text-sm">or</div>

          <div className="bg-gradient-to-r from-amber-50 to-amber-100 rounded-2xl p-4 border border-amber-200">
            <div className="flex items-center gap-2 text-amber-700 mb-2">
              <Crown size={16} />
              <span className="font-semibold">Upgrade to Pro</span>
            </div>
            <ul className="space-y-1">
              {SUBSCRIPTION_PLANS.pro.features.slice(0, 3).map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-amber-600">
                  <Check size={12} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onUpgrade}
            className="w-full bg-gradient-to-r from-amber-400 to-amber-500 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all"
          >
            Get Pro - ${SUBSCRIPTION_PLANS.pro.price}/mo
          </button>
          
          <button
            onClick={onClose}
            className="w-full text-gray-500 font-medium py-3"
          >
            I'll wait
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuotaExceededModal;
