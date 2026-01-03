import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AuthContextType, SUBSCRIPTION_PLANS } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to get today's date as ISO string (YYYY-MM-DD)
const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Storage keys
const USER_STORAGE_KEY = 'cmf_user';
const SESSION_STORAGE_KEY = 'cmf_session';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from storage on mount
  useEffect(() => {
    const loadUser = () => {
      try {
        const savedUser = localStorage.getItem(USER_STORAGE_KEY);
        const sessionToken = localStorage.getItem(SESSION_STORAGE_KEY);
        
        if (savedUser && sessionToken) {
          const parsedUser = JSON.parse(savedUser) as User;
          
          // Reset scan count if it's a new day
          if (parsedUser.lastScanDate !== getTodayDate()) {
            parsedUser.scansToday = 0;
            parsedUser.lastScanDate = getTodayDate();
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(parsedUser));
          }
          
          setUser(parsedUser);
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // Persist user changes to storage
  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      // Simulate Google OAuth flow
      // In production, this would use Google Identity Services or Firebase Auth
      
      // For demo/development purposes, we'll create a mock user
      // TODO: Replace with actual Google Auth in production:
      // const googleUser = await google.accounts.id.prompt();
      
      // Development mode check - use mock data only in development
      const isDevelopment = process.env.NODE_ENV !== 'production' || !process.env.GOOGLE_CLIENT_ID;
      
      if (!isDevelopment) {
        console.warn('Google OAuth not configured. Set GOOGLE_CLIENT_ID for production.');
      }
      
      const mockGoogleUser = {
        sub: 'google_' + Date.now(),
        email: 'user@example.com',
        name: 'Demo User',
        picture: `https://ui-avatars.com/api/?name=Demo+User&background=random`,
      };

      const newUser: User = {
        id: mockGoogleUser.sub,
        email: mockGoogleUser.email,
        displayName: mockGoogleUser.name,
        photoURL: mockGoogleUser.picture,
        subscription: 'free',
        scansToday: 0,
        lastScanDate: getTodayDate(),
        createdAt: Date.now(),
      };

      // Store session token (in production, this would be a JWT)
      const sessionToken = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2);
      localStorage.setItem(SESSION_STORAGE_KEY, sessionToken);

      setUser(newUser);
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      // Clear stored data
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      return { ...prev, ...updates };
    });
  }, []);

  const canPerformScan = useCallback((): boolean => {
    if (!user) return true; // Allow guests to scan (will be tracked after sign up)
    
    const plan = SUBSCRIPTION_PLANS[user.subscription];
    if (plan.scanLimit === -1) return true; // Unlimited
    
    // Check if it's a new day
    if (user.lastScanDate !== getTodayDate()) {
      return true; // Reset on new day
    }
    
    return user.scansToday < plan.scanLimit;
  }, [user]);

  const recordScan = useCallback(() => {
    setUser(prev => {
      if (!prev) return null;
      
      const today = getTodayDate();
      const newScansToday = prev.lastScanDate === today ? prev.scansToday + 1 : 1;
      
      return {
        ...prev,
        scansToday: newScansToday,
        lastScanDate: today,
      };
    });
  }, []);

  const remainingScans = user
    ? user.subscription === 'pro'
      ? -1 // Unlimited
      : Math.max(0, SUBSCRIPTION_PLANS.free.scanLimit - user.scansToday)
    : SUBSCRIPTION_PLANS.free.scanLimit; // Default for guests

  const value: AuthContextType = {
    user,
    loading,
    signInWithGoogle,
    signOut,
    updateUser,
    canPerformScan,
    recordScan,
    remainingScans,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
