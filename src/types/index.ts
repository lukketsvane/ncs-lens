// --- Types ---

export interface ColorMatch {
  system: "RAL" | "NCS";
  code: string;
  name: string;
  hex: string;
  location: string;
  confidence: string;
  materialGuess: string;
  finishGuess: string;
  laymanDescription: string;
  // Technical Details
  lrv?: string;
  cmyk?: string;
  rgb?: string;
  blackness?: string;
  chromaticness?: string;
  hue?: string;
}

export interface Material {
  name: string;
  texture: string;
  finish: string;
}

export interface AnalysisResult {
  productType: string;
  materials: Material[];
  colors: ColorMatch[];
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  image: string;
  result: AnalysisResult;
  author?: string;
  userId?: string;
}

export type Tab = 'scan' | 'history' | 'community' | 'profile';

// User & Authentication Types
export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  subscription: SubscriptionTier;
  scansToday: number;
  lastScanDate: string; // ISO date string
  createdAt: number;
}

export type SubscriptionTier = 'free' | 'pro';

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  price: number;
  priceId: string; // Stripe price ID
  features: string[];
  scanLimit: number; // -1 for unlimited
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: '',
    features: [
      '5 scans per day',
      'Basic color analysis',
      'View community scans',
      'Save to collection'
    ],
    scanLimit: 5
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    priceId: 'price_pro_monthly', // Placeholder - would be set by Stripe
    features: [
      'Unlimited scans',
      'Advanced color matching',
      'Publish to community',
      'Priority AI processing',
      'Export color palettes'
    ],
    scanLimit: -1
  }
};

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  canPerformScan: () => boolean;
  recordScan: () => void;
  remainingScans: number;
}
