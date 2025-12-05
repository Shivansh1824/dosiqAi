/**
 * Medication types for tracking prescriptions and reminders
 */

export type MedicationFrequency =
  | 'once_daily'
  | 'twice_daily'
  | 'three_times_daily'
  | 'four_times_daily'
  | 'as_needed'
  | 'weekly'
  | 'monthly';

export interface Medication {
  id: string;
  user_id: string;
  name: string;
  dosage: string;
  frequency: MedicationFrequency;
  time_of_day: string[]; // e.g., ["08:00", "20:00"]
  start_date: string;
  end_date?: string;
  notes?: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MedicationsState {
  medications: Medication[];
  isLoading: boolean;
  error: string | null;
}

export interface MedicationsActions {
  loadFromCache: (userId: string) => Promise<boolean>;
  fetchMedications: (userId: string, silent?: boolean) => Promise<void>;
  addMedication: (med: Omit<Medication, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateMedication: (id: string, updates: Partial<Medication>) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  clearMedications: () => void;
}

export type MedicationsStore = MedicationsState & MedicationsActions;

// Helper to get frequency display text
export const getFrequencyText = (frequency: MedicationFrequency): string => {
  switch (frequency) {
    case 'once_daily':
      return 'Once daily';
    case 'twice_daily':
      return 'Twice daily';
    case 'three_times_daily':
      return '3 times daily';
    case 'four_times_daily':
      return '4 times daily';
    case 'as_needed':
      return 'As needed';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    default:
      return frequency;
  }
};

// Default colors for medications
export const medicationColors = [
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Orange
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
];
