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

export type FoodRelationship =
  | 'empty_stomach'
  | 'before_food'
  | 'with_food'
  | 'after_food'
  | 'anytime';

export interface Medication {
  id: string;
  user_id: string;
  family_member_id: string; // Linked to family_members table
  name: string;
  
  // Detailed medicine info
  scientific_name?: string;
  medicine_type?: string;
  medicine_purpose?: string;
  form?: string;
  strength?: string;
  
  // Dosing & Schedule
  dosage: string; // Mapped from dosage_instruction in DB
  frequency: MedicationFrequency; // Derived from interval_days/times_per_day
  time_of_day: string[]; // Mapped from reminder_times in DB
  interval_days?: number;
  timing_dosage?: string;
  times_per_day?: number;
  
  start_date: string;
  end_date?: string;
  duration_days?: number;
  
  notes?: string;
  color: string; // Calculated on-the-fly

  
  created_at: string;
  updated_at: string;

  // Source tracking fields
  source_document_id?: string;
  source_document_title?: string; // Optional, might need join to fetch
  ai_extracted?: boolean;         // Inferred from source_document_id existing
  verified_by_user?: boolean;     // Implicit true for active schedule?
  ai_confidence?: number;
  food_relationship?: FoodRelationship;
}

export interface MedicationsState {
  medications: Medication[];
  isLoading: boolean;
  error: string | null;
}

export interface MedicationsActions {
  loadFromCache: (userId: string) => Promise<boolean>;
  fetchMedications: (userId: string, silent?: boolean) => Promise<void>;
  addMedication: (med: Omit<Medication, 'id' | 'created_at' | 'updated_at'>) => Promise<Medication | null>;
  updateMedication: (id: string, updates: Partial<Medication>) => Promise<Medication | null>;
  deleteMedication: (id: string) => Promise<void>;
  clearMedications: () => void;

  // AI medication extraction methods
  addMedicationFromAI: (
    parsedMed: import('./medicationVerification').ParsedMedication,
    userId: string,
    documentId: string,
    documentTitle: string,
    startDate: string,
    familyMemberId: string,
    color?: string
  ) => Promise<Medication>;
  addMedicationsBatchFromAI: (
    parsedMeds: import('./medicationVerification').ParsedMedication[],
    userId: string,
    documentId: string,
    documentTitle: string,
    startDate: string,
    familyMemberId: string
  ) => Promise<void>;
  getActiveMedications: () => Medication[];
  replaceMedication: (oldMedicationId: string, newMedicationData: Omit<Medication, 'id' | 'created_at' | 'updated_at'>) => Promise<Medication>;
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

// Helper to get food relationship display text
export const getFoodRelationshipText = (foodRelationship?: FoodRelationship): string => {
  if (!foodRelationship) return 'Anytime';
  switch (foodRelationship) {
    case 'empty_stomach':
      return 'Empty Stomach';
    case 'before_food':
      return 'Before Food';
    case 'with_food':
      return 'With Food';
    case 'after_food':
      return 'After Food';
    case 'anytime':
      return 'Anytime';
    default:
      return 'Anytime';
  }
};

/**
 * Medication color palette for visual differentiation
 *
 * IMPORTANT: Colors are NEVER stored in the database
 * - Performance optimization: No storage overhead
 * - Calculated on-the-fly: medicationColors[index % 7]
 * - Index-based cycling for easy visual scanning
 * - Uses 7 vibrant colors from Tailwind CSS palette (600 shades)
 *
 * Benefits:
 * - Each medication gets a unique color (up to 7 medications visible)
 * - No database storage overhead
 * - Consistent across app sessions
 * - WCAG AAA contrast compliance for medical UI standards
 */
export const medicationColors = [
  '#DC2626', // Red-600
  '#2563EB', // Blue-600
  '#059669', // Green-600
  '#D97706', // Orange-600
  '#7C3AED', // Purple-600
  '#DB2777', // Pink-600
  '#0891B2', // Cyan-600
];
