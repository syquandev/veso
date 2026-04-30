// Re-export all types from the original types file for backward compatibility
// This file serves as the centralized type hub per REFACTOR_GUIDE.md Section 5
export type {
  LotterySet,
  CustomPreference,
  Seller,
  StationName,
  DailyStationConfig,
  WeeklySchedule,
  DailyInput,
  DistributionResult,
  Shortage,
  DistributionReport,
} from '../types';

// App-level types
export type ActiveTab = 'distribute' | 'sellers' | 'history';
export type AppStatus = 'idle' | 'loading' | 'success' | 'error';
