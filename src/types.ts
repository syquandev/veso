export interface LotterySet {
  id: string;
  numbers: string[];
}

export interface CustomPreference {
  number: string;
  quantity: number;
  stationId?: string;
  dayOfWeek?: number; // 0-6 (Sunday-Saturday), if undefined applies every day
}

export interface Seller {
  id: string;
  name: string;
  setType: 'single' | 'double';
  sheetsOption: '16' | '32' | 'custom';
  customSheets?: number;
  targetTotalTickets: number;
  targetSubTickets?: number; // If set, targetTotalTickets becomes targetMainTickets
  customRatio?: number; // 0-100, if set overrides global ratio in auto mode
  allocationMode: 'auto' | 'manual';
  currentSetIndex: number;
  isAutoMode: boolean;
  manualSetId?: string;
  isEnabled: boolean;
  mainEnabled: boolean;
  subStationRatios: Record<string, number>; // sub-station ID -> percentage (0-100)
  fixedSetId?: string; // If set, always uses this set
  customPreferences?: CustomPreference[]; // Specific numbers and quantities
}

export interface StationName {
  id: string;
  name: string;
}

export interface DailyStationConfig {
  dayOfWeek: number; // 0-6
  mainStationName: string;
  subStations: { id: string; name: string }[];
}

export interface WeeklySchedule {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  mainStationBaseQuantity: number; // Base quantity for this day
  subStationBaseQuantities: Record<string, number>; // sub-station ID -> quantity
  isActive: boolean;
}

export interface DailyInput {
  date: string;
  mainStationTickets: Record<string, number>; // Number -> Quantity
  subStations: {
    id: string;
    name: string;
    tickets: Record<string, number>;
  }[];
}

export interface DistributionResult {
  date: string;
  sellerId: string;
  sellerName: string;
  setName: string;
  mainStationNumbers: string[];
  mainStationQuantities?: Record<string, number>; // number -> quantity
  subStationResults: {
    id: string;
    name: string;
    numbers: string[];
    quantities?: Record<string, number>; // number -> quantity
  }[];
  totalSheets: number;
}

export interface Shortage {
  sellerId: string;
  sellerName: string;
  station: string; // 'main' or sub-station ID
  needed: number;
  available: number;
  missingNumber?: string; // The specific number that was missing (if applicable)
}

export interface DistributionReport {
  results: DistributionResult[];
  shortages: Shortage[];
  updatedMainPool: Record<string, number>;
  updatedSubPools: Record<string, Record<string, number>>; // sub-station ID -> Pool
}
