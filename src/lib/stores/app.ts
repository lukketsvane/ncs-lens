import { writable, derived } from 'svelte/store';
import type { ScanRecord } from '$lib/scans';
import type { SavedColor } from '$lib/saved-colors';

// Types
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
  isPublic?: boolean;
  likeCount?: number;
  isLiked?: boolean;
  userId?: string;
}

export type Tab = 'scan' | 'palette' | 'history' | 'community' | 'profile';

export type SortOption = 'trending' | 'newest' | 'most_liked';

// App state stores
export const activeTab = writable<Tab>('scan');
export const historySubTab = writable<'scans' | 'colors'>('scans');

// Data stores
export const history = writable<HistoryItem[]>([]);
export const communityItems = writable<HistoryItem[]>([]);
export const savedColors = writable<SavedColor[]>([]);
export const savedColorKeys = writable<Set<string>>(new Set());
export const dataLoading = writable(true);

// UI state stores
export const loading = writable(false);
export const detailItem = writable<HistoryItem | null>(null);
export const detailColor = writable<ColorMatch | null>(null);
export const salientMode = writable(false);
export const compareTarget = writable<ColorMatch | null>(null);
export const selectedPaletteColor = writable<any | null>(null);

// Helper function to check if a color is saved
export function isColorSaved(color: ColorMatch): boolean {
  let keys: Set<string> = new Set();
  savedColorKeys.subscribe(k => keys = k)();
  return keys.has(`${color.system}:${color.code}`);
}

// Constants
export const DEFAULT_COLOR_HEX = '#888888';
export const MAX_SIMILAR_COLOR_DISTANCE = 30;
