/**
 * ColorPin II CSV Import Module
 * 
 * This module provides functionality to parse CSV files exported from ColorPin II
 * colorimeter devices. The CSV format includes comprehensive color data with:
 * - Basic info: date-time, name, code, brand, collection, serial, gloss, notes
 * - LAB and RGB values under multiple illuminants (A, C, D50, D65, F2, F7)
 * - Both 2° and 10° standard observer angles
 * - Hex color codes
 * - Optional spectral reflectance data (400-700nm)
 */

import type { LAB, RGB } from './ncs-colors';
import { findNearestNcsColor, rgbToLab, hexToRgb, calculateLrv, rgbToHex } from './ncs-colors';

// --- Types ---

/**
 * Illuminant types supported by ColorPin II
 */
export type Illuminant = 'A' | 'C' | 'D50' | 'D65' | 'F2' | 'F7';

/**
 * Observer angle types
 */
export type ObserverAngle = '2deg' | '10deg';

/**
 * Color measurement data for a specific illuminant/observer combination
 */
export interface ColorMeasurement {
  lab: LAB;
  rgb: RGB;
  hex: string;
}

/**
 * Spectral reflectance data (400nm - 700nm in 10nm steps)
 */
export interface SpectralData {
  wavelengths: number[];
  reflectance: number[];
}

/**
 * Complete ColorPin II color entry
 */
export interface ColorPinEntry {
  // Metadata
  dateTime?: string;
  name: string;
  code?: string;
  brand?: string;
  collection?: string;
  serial?: string;
  gloss?: string;
  fullAttrs?: string;
  notes?: string;
  
  // Color measurements indexed by illuminant and observer angle
  measurements: Partial<Record<Illuminant, Partial<Record<ObserverAngle, ColorMeasurement>>>>;
  
  // Optional spectral data
  spectral?: SpectralData;
  
  // Computed values (added during import)
  lrv?: number;
  nearestNcs?: {
    code: string;
    name: string;
    hex: string;
    distance: number;
  };
}

// --- CSV Column Mapping ---

const ILLUMINANTS: Illuminant[] = ['A', 'C', 'D50', 'D65', 'F2', 'F7'];
const OBSERVER_ANGLES: ObserverAngle[] = ['2deg', '10deg'];
const WAVELENGTHS = [400, 410, 420, 430, 440, 450, 460, 470, 480, 490, 500, 510, 520, 530, 540, 550, 560, 570, 580, 590, 600, 610, 620, 630, 640, 650, 660, 670, 680, 690, 700];

/**
 * Parse a ColorPin II CSV file content
 * @param csvContent - The raw CSV content as a string
 * @returns Array of parsed ColorPin entries
 */
export function parseColorPinCsv(csvContent: string): ColorPinEntry[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }
  
  // Parse header row - handle duplicate column names (e.g., LAB-b and RGB-b)
  // ColorPin CSV column order per illuminant/observer: L, a, b (LAB), r, g, b (RGB), hex
  // We need to disambiguate duplicate columns by appending occurrence count
  const headers = parseCSVRow(lines[0]);
  const headerIndex = new Map<string, number>();
  
  // Track seen headers to handle duplicates with occurrence count
  const seenHeaders = new Map<string, number>();
  headers.forEach((h, i) => {
    const key = h.toLowerCase().trim();
    const count = seenHeaders.get(key) || 0;
    
    if (count === 0) {
      headerIndex.set(key, i);
    } else {
      // For duplicates, append occurrence count suffix
      // This handles the case where 'b' appears twice (LAB-b and RGB-b)
      // First 'b' is stored as-is, second 'b' becomes 'b-rgb' (for backwards compatibility)
      // Third occurrence would be 'b-2', etc.
      const suffix = count === 1 ? '-rgb' : `-${count}`;
      headerIndex.set(`${key}${suffix}`, i);
    }
    seenHeaders.set(key, count + 1);
  });
  
  // Parse data rows
  const entries: ColorPinEntry[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    if (row.every(cell => cell.trim() === '')) continue; // Skip empty rows
    
    try {
      const entry = parseColorPinRow(row, headerIndex);
      if (entry) {
        entries.push(entry);
      }
    } catch (error) {
      console.warn(`Error parsing row ${i + 1}:`, error);
    }
  }
  
  return entries;
}

/**
 * Parse a single CSV row, handling quoted values
 */
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Parse a single ColorPin data row
 */
function parseColorPinRow(row: string[], headerIndex: Map<string, number>): ColorPinEntry | null {
  const getValue = (key: string): string => {
    const index = headerIndex.get(key.toLowerCase());
    return index !== undefined ? row[index] || '' : '';
  };
  
  const getNumber = (key: string): number | undefined => {
    const val = getValue(key);
    const num = parseFloat(val);
    return isNaN(num) ? undefined : num;
  };
  
  // Parse basic metadata
  const entry: ColorPinEntry = {
    dateTime: getValue('date-time') || undefined,
    name: getValue('name') || 'Unnamed Color',
    code: getValue('code') || undefined,
    brand: getValue('brand') || undefined,
    collection: getValue('collection') || undefined,
    serial: getValue('serial') || undefined,
    gloss: getValue('gloss') || undefined,
    fullAttrs: getValue('full_attrs') || undefined,
    notes: getValue('notes') || undefined,
    measurements: {}
  };
  
  // Parse color measurements for each illuminant/observer combination
  for (const illuminant of ILLUMINANTS) {
    for (const observer of OBSERVER_ANGLES) {
      const prefix = `${illuminant}-${observer}`;
      
      // LAB values
      const l = getNumber(`${prefix}-l`);
      const labA = getNumber(`${prefix}-a`);
      const labB = getNumber(`${prefix}-b`);
      
      // RGB values - note: the second 'b' column is stored as '{prefix}-b-rgb'
      const r = getNumber(`${prefix}-r`);
      const g = getNumber(`${prefix}-g`);
      const rgbB = getNumber(`${prefix}-b-rgb`);
      
      const hex = getValue(`${prefix}-hex`);
      
      if (l !== undefined && labA !== undefined && labB !== undefined) {
        // Get RGB values from hex (most reliable) or from columns
        let rgb: RGB;
        
        if (hex && hex !== '#000000') {
          const parsedRgb = hexToRgb(hex);
          rgb = parsedRgb || { r: r || 0, g: g || 0, b: rgbB || 0 };
        } else {
          rgb = { r: r || 0, g: g || 0, b: rgbB || 0 };
        }
        
        if (!entry.measurements[illuminant]) {
          entry.measurements[illuminant] = {};
        }
        
        entry.measurements[illuminant]![observer] = {
          lab: { l, a: labA, b: labB },
          rgb,
          hex: hex || ''
        };
      }
    }
  }
  
  // Parse spectral data if present
  const wavelengths: number[] = [];
  const reflectance: number[] = [];
  
  for (const wl of WAVELENGTHS) {
    const val = getNumber(`spectrum-${wl}nm`);
    if (val !== undefined) {
      wavelengths.push(wl);
      reflectance.push(val);
    }
  }
  
  if (wavelengths.length > 0) {
    entry.spectral = { wavelengths, reflectance };
  }
  
  // Compute LRV using D65-2deg (standard daylight) if available
  const d65Measurement = entry.measurements['D65']?.['2deg'];
  if (d65Measurement) {
    entry.lrv = calculateLrv(d65Measurement.rgb.r, d65Measurement.rgb.g, d65Measurement.rgb.b);
    
    // Find nearest NCS color
    const nearest = findNearestNcsColor(d65Measurement.hex, 1);
    if (nearest.length > 0) {
      entry.nearestNcs = {
        code: nearest[0].color.code,
        name: nearest[0].color.name,
        hex: nearest[0].color.hex,
        distance: nearest[0].distance
      };
    }
  }
  
  return entry;
}

/**
 * Export ColorPin entries to a simplified JSON format for storage
 */
export function exportToSimplifiedFormat(entries: ColorPinEntry[]): Array<{
  name: string;
  code?: string;
  brand?: string;
  collection?: string;
  lab: LAB;
  rgb: RGB;
  hex: string;
  lrv: number;
  nearestNcs?: {
    code: string;
    name: string;
    distance: number;
  };
}> {
  return entries.map(entry => {
    // Prefer D65-2deg (standard daylight viewing)
    const measurement = entry.measurements['D65']?.['2deg'] 
      || entry.measurements['D50']?.['2deg']
      || Object.values(entry.measurements)[0]?.['2deg']
      || Object.values(entry.measurements)[0]?.['10deg'];
    
    if (!measurement) {
      throw new Error(`No valid measurement found for entry: ${entry.name}`);
    }
    
    return {
      name: entry.name,
      code: entry.code,
      brand: entry.brand,
      collection: entry.collection,
      lab: measurement.lab,
      rgb: measurement.rgb,
      hex: measurement.hex,
      lrv: entry.lrv || calculateLrv(measurement.rgb.r, measurement.rgb.g, measurement.rgb.b),
      nearestNcs: entry.nearestNcs ? {
        code: entry.nearestNcs.code,
        name: entry.nearestNcs.name,
        distance: entry.nearestNcs.distance
      } : undefined
    };
  });
}

/**
 * Get the primary color measurement from a ColorPin entry
 * Prefers D65-2deg (standard daylight with 2° observer)
 */
export function getPrimaryMeasurement(entry: ColorPinEntry): ColorMeasurement | null {
  // Priority order: D65-2deg, D50-2deg, D65-10deg, D50-10deg, any available
  const priorities: Array<[Illuminant, ObserverAngle]> = [
    ['D65', '2deg'],
    ['D50', '2deg'],
    ['D65', '10deg'],
    ['D50', '10deg'],
    ['A', '2deg'],
    ['C', '2deg'],
    ['F7', '2deg'],
    ['F2', '2deg']
  ];
  
  for (const [illuminant, observer] of priorities) {
    const measurement = entry.measurements[illuminant]?.[observer];
    if (measurement) {
      return measurement;
    }
  }
  
  return null;
}

/**
 * Create a ColorPin entry from RGB values (useful for manual entry)
 */
export function createColorPinEntryFromRgb(
  name: string,
  rgb: RGB,
  options?: {
    code?: string;
    brand?: string;
    collection?: string;
    notes?: string;
  }
): ColorPinEntry {
  const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  const lrv = calculateLrv(rgb.r, rgb.g, rgb.b);
  
  const nearest = findNearestNcsColor(hex, 1);
  
  return {
    name,
    code: options?.code,
    brand: options?.brand,
    collection: options?.collection,
    notes: options?.notes,
    measurements: {
      'D65': {
        '2deg': { lab, rgb, hex }
      }
    },
    lrv,
    nearestNcs: nearest.length > 0 ? {
      code: nearest[0].color.code,
      name: nearest[0].color.name,
      hex: nearest[0].color.hex,
      distance: nearest[0].distance
    } : undefined
  };
}

/**
 * Validate a ColorPin CSV file structure
 * @returns Array of validation errors (empty if valid)
 */
export function validateColorPinCsv(csvContent: string): string[] {
  const errors: string[] = [];
  
  try {
    const lines = csvContent.trim().split('\n');
    
    if (lines.length < 1) {
      errors.push('CSV file is empty');
      return errors;
    }
    
    const headers = parseCSVRow(lines[0]);
    const headerSet = new Set(headers.map(h => h.toLowerCase().trim()));
    
    // Check for required columns (at least one measurement should be present)
    const hasLabData = headerSet.has('d65-2deg-l') || headerSet.has('d50-2deg-l') || headerSet.has('a-2deg-l');
    
    if (!hasLabData) {
      errors.push('CSV must contain at least one set of LAB measurement columns (e.g., D65-2deg-L, D65-2deg-a, D65-2deg-b)');
    }
    
    if (lines.length < 2) {
      errors.push('CSV must contain at least one data row');
    }
    
  } catch (error) {
    errors.push(`CSV parsing error: ${error}`);
  }
  
  return errors;
}
