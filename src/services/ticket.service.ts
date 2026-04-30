import { Seller } from '../types';

/**
 * Pure utility functions for ticket distribution calculations.
 * Per REFACTOR_GUIDE.md Section 4: Service Layer
 */

/**
 * Validates a 2-digit ticket number
 */
export function validateTicketNumber(ticketNumber: string): boolean {
  return /^\d{2}$/.test(ticketNumber);
}

/**
 * Calculate share amount with floor rounding
 */
export function calculateShareAmount(totalAmount: number, count: number): number {
  if (count <= 0) return 0;
  return Math.floor(totalAmount / count);
}

/**
 * Calculate total tickets from a pool record
 */
export function getTotalFromPool(pool: Record<string, number>): number {
  return (Object.values(pool) as number[]).reduce((a, b) => a + b, 0);
}

/**
 * Get sheets per number for a seller based on their configuration
 */
export function getSheetsPerNumber(seller: Seller): number {
  if (seller.sheetsOption === '32') return 32;
  if (seller.sheetsOption === 'custom') return seller.customSheets || 16;
  return 16;
}

/**
 * Validate that all station ratios for a seller sum to <= 100%
 * BUG FIX: Previously ratio validation was missing, allowing total > 100%
 */
export function validateSellerRatios(seller: Seller): { valid: boolean; total: number } {
  const mainRatio = seller.customRatio ?? 70;
  const subTotal = Object.values(seller.subStationRatios || {}).reduce((a, b) => a + b, 0);
  const total = mainRatio + subTotal;
  return { valid: total <= 100, total };
}

/**
 * Build station config display name
 */
export function getStationDisplayName(
  stationConfigs: { dayOfWeek: number; mainStationName: string; subStations: { id: string; name: string }[] }[],
  date: string,
  stationId: string
): string {
  const dayOfWeek = new Date(date).getDay();
  const config = stationConfigs.find(c => c.dayOfWeek === dayOfWeek);
  
  if (stationId === 'main') {
    return config?.mainStationName || 'Đài Chính';
  }
  
  const sub = config?.subStations.find(s => s.id === stationId);
  return sub?.name || stationId;
}
