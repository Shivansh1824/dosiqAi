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
  name: string;
  dosage: string;
  frequency: MedicationFrequency;
  time_of_day: string[]; // e.g., ["08:00", "20:00"]
  start_date: string;
  end_date?: string;
  notes?: string;
  color: string; // Calculated on-the-fly from index (7 colors cycling), not stored in database
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Source tracking fields for AI-extracted medications
  source_document_id?: string;           // Links to prescription document
  source_document_title?: string;        // Quick reference without DB lookup
  ai_extracted?: boolean;                // True if added via AI extraction
  verified_by_user?: boolean;            // True if user verified/edited
  original_frequency_code?: string;      // Store original code (e.g., "Q6H")
  scientific_name?: string;              // Generic name from AI
  food_relationship?: FoodRelationship;  // Meal timing requirement
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

  // AI medication extraction methods
  addMedicationFromAI: (
    parsedMed: import('./medicationVerification').ParsedMedication,
    userId: string,
    documentId: string,
    documentTitle: string,
    startDate: string,
    color?: string
  ) => Promise<Medication>;
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
