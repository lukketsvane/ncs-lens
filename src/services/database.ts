import { HistoryItem, User } from '../types';

// This service abstracts database operations
// Currently uses localStorage as a mock backend
// Replace with actual backend API calls (Firebase, Supabase, etc.)

const COMMUNITY_DB_KEY = 'cmf_community_db';
const HISTORY_DB_KEY = 'cmf_history_db';

interface DatabaseService {
  // Community operations
  getCommunityItems: () => Promise<HistoryItem[]>;
  publishToCommunity: (item: HistoryItem, user: User) => Promise<HistoryItem>;
  deleteCommunityItem: (itemId: string, userId: string) => Promise<void>;

  // User history operations
  getUserHistory: (userId: string) => Promise<HistoryItem[]>;
  saveToHistory: (item: HistoryItem, userId: string) => Promise<void>;
  deleteFromHistory: (itemId: string, userId: string) => Promise<void>;
  syncHistory: (items: HistoryItem[], userId: string) => Promise<void>;

  // User operations
  getUser: (userId: string) => Promise<User | null>;
  updateUser: (user: User) => Promise<void>;
  recordScan: (userId: string) => Promise<{ scansToday: number; lastScanDate: string }>;
}

// Mock implementation using localStorage
// In production, replace with actual API calls
export const databaseService: DatabaseService = {
  getCommunityItems: async () => {
    try {
      const data = localStorage.getItem(COMMUNITY_DB_KEY);
      if (!data) return [];
      
      const items: HistoryItem[] = JSON.parse(data);
      // Sort by timestamp, newest first
      return items.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error fetching community items:', error);
      return [];
    }
  },

  publishToCommunity: async (item: HistoryItem, user: User) => {
    try {
      const data = localStorage.getItem(COMMUNITY_DB_KEY);
      const items: HistoryItem[] = data ? JSON.parse(data) : [];
      
      const publishedItem: HistoryItem = {
        ...item,
        id: `community_${Date.now()}`,
        author: user.displayName,
        userId: user.id,
        timestamp: Date.now(),
      };
      
      items.unshift(publishedItem);
      localStorage.setItem(COMMUNITY_DB_KEY, JSON.stringify(items));
      
      return publishedItem;
    } catch (error) {
      console.error('Error publishing to community:', error);
      throw error;
    }
  },

  deleteCommunityItem: async (itemId: string, userId: string) => {
    try {
      const data = localStorage.getItem(COMMUNITY_DB_KEY);
      if (!data) return;
      
      const items: HistoryItem[] = JSON.parse(data);
      const filtered = items.filter(item => 
        !(item.id === itemId && item.userId === userId)
      );
      
      localStorage.setItem(COMMUNITY_DB_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting community item:', error);
      throw error;
    }
  },

  getUserHistory: async (userId: string) => {
    try {
      const data = localStorage.getItem(`${HISTORY_DB_KEY}_${userId}`);
      if (!data) return [];
      
      const items: HistoryItem[] = JSON.parse(data);
      return items.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error fetching user history:', error);
      return [];
    }
  },

  saveToHistory: async (item: HistoryItem, userId: string) => {
    try {
      const data = localStorage.getItem(`${HISTORY_DB_KEY}_${userId}`);
      const items: HistoryItem[] = data ? JSON.parse(data) : [];
      
      // Check if item already exists
      const existingIndex = items.findIndex(i => i.id === item.id);
      if (existingIndex >= 0) {
        items[existingIndex] = item;
      } else {
        items.unshift({ ...item, userId });
      }
      
      localStorage.setItem(`${HISTORY_DB_KEY}_${userId}`, JSON.stringify(items));
    } catch (error) {
      console.error('Error saving to history:', error);
      throw error;
    }
  },

  deleteFromHistory: async (itemId: string, userId: string) => {
    try {
      const data = localStorage.getItem(`${HISTORY_DB_KEY}_${userId}`);
      if (!data) return;
      
      const items: HistoryItem[] = JSON.parse(data);
      const filtered = items.filter(item => item.id !== itemId);
      
      localStorage.setItem(`${HISTORY_DB_KEY}_${userId}`, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting from history:', error);
      throw error;
    }
  },

  syncHistory: async (items: HistoryItem[], userId: string) => {
    try {
      const existingData = localStorage.getItem(`${HISTORY_DB_KEY}_${userId}`);
      const existingItems: HistoryItem[] = existingData ? JSON.parse(existingData) : [];
      
      // Merge items, preferring newer versions
      const merged = new Map<string, HistoryItem>();
      
      existingItems.forEach(item => merged.set(item.id, item));
      items.forEach(item => {
        const existing = merged.get(item.id);
        if (!existing || item.timestamp > existing.timestamp) {
          merged.set(item.id, { ...item, userId });
        }
      });
      
      const sortedItems = Array.from(merged.values())
        .sort((a, b) => b.timestamp - a.timestamp);
      
      localStorage.setItem(`${HISTORY_DB_KEY}_${userId}`, JSON.stringify(sortedItems));
    } catch (error) {
      console.error('Error syncing history:', error);
      throw error;
    }
  },

  getUser: async (userId: string) => {
    try {
      const data = localStorage.getItem(`cmf_user_${userId}`);
      if (!data) return null;
      return JSON.parse(data) as User;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  },

  updateUser: async (user: User) => {
    try {
      localStorage.setItem(`cmf_user_${user.id}`, JSON.stringify(user));
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  recordScan: async (userId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = localStorage.getItem(`cmf_user_${userId}`);
      
      if (!data) {
        return { scansToday: 1, lastScanDate: today };
      }
      
      const user: User = JSON.parse(data);
      const scansToday = user.lastScanDate === today ? user.scansToday + 1 : 1;
      
      user.scansToday = scansToday;
      user.lastScanDate = today;
      
      localStorage.setItem(`cmf_user_${userId}`, JSON.stringify(user));
      
      return { scansToday, lastScanDate: today };
    } catch (error) {
      console.error('Error recording scan:', error);
      throw error;
    }
  },
};

export default databaseService;
