// Shared domain types for GLP-1 Coach. New/converted modules should import from
// here; the codebase is migrating to TypeScript incrementally (allowJs is on, so
// JS and TS coexist — convert files to .ts/.tsx one at a time).

export type Language = 'tr' | 'en';

export type GLP1Status = 'currentlyUsing' | 'recentlyStopped' | 'planningToStop';
export type Drug = 'Ozempic' | 'Wegovy' | 'Mounjaro' | 'Other';

export interface UserProfile {
  name?: string;
  email?: string;
  gender?: string;
  weight?: number;
  height?: number;
  goalWeight?: number;
  proteinTarget?: number;
  proteinPerKg?: number;
  proteinTargetCustom?: boolean;
  exerciseDaysPerWeek?: number;
}

export interface WeightLog {
  date: string; // YYYY-MM-DD
  weight: number; // kg
}

export interface MealLog {
  id?: string;
  protein?: number;
  calories?: number;
  foodType?: string;
  portionSize?: string;
  imageUri?: string;
  date?: string;
}

export interface MedicationProfile {
  drug?: Drug;
  dose?: string;
  doseMg?: number | null;
  doseUnit?: string;
  frequency?: 'weekly' | 'biweekly';
  injectionWeekday?: number; // 0-6 (Sunday = 0)
  startDate?: string;
  status?: GLP1Status;
  reminderHour?: number | null;
  reminderMinute?: number | null;
}

// OpenAI-style chat message (used by the AI proxy client).
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: unknown;
}
