/**
 * Types for AI medication extraction and verification flow
 */

import { MedicationFrequency } from './medication';
import { MedicineInfo } from './document';

/**
 * Confidence level for AI-extracted medication data
 * Based on whether AI identified the medication with certainty
 */
export type VerificationConfidence = 'high' | 'medium' | 'low';

/**
 * Parsed medication data from AI extraction
 * Ready for user verification and editing before adding to tracker
 */
export interface ParsedMedication {
  // Core medication data
  name: string;                          // Cleaned up from exact_written_name
  strength?: string;                     // Medication strength (e.g. "200mg")
  form?: string;                         // Medication form (e.g. "Tablet")
  scientific_name?: string;              // From assumed_enriched_data
  medicine_type?: string;                // From assumed_enriched_data (e.g., "Antibiotic")
  medicine_purpose?: string;             // From assumed_enriched_data (e.g., "Bacterial Infection Treatment")
  dosage: string;                        // From dosage_instruction
  frequency: MedicationFrequency;        // Parsed from frequency code
  original_frequency_code: string;       // Store original (e.g., "Q6H", "TDS")
  duration_days: number | null;          // Parsed from duration string
  start_date?: string;                   // User-verified start date (YYYY-MM-DD)
  interval_days: number | null;          // 1=daily, 2=alternate, 7=weekly, 0=as_needed
  timing_dosage?: string;                // Original "1-0-1" format from AI
  total_times_per_day?: number;          // For display logic (1, 2, 3, 4, etc.)
  time_of_day: string[];                 // Auto-generated based on frequency
  notes: string;                         // Combined from special_instructions
  food_relationship?: import('./medication').FoodRelationship; // Meal timing requirement

  // Metadata
  confidence: VerificationConfidence;    // Based on is_identified
  ai_extracted: boolean;                 // Always true for AI-extracted
  verified_by_user: boolean;             // False until user confirms

  // Source reference
  source_raw: MedicineInfo;              // Original AI data for reference
}

/**
 * State for medication verification card
 * Tracks editing state and validation
 */
export interface MedicationVerificationState {
  medication: ParsedMedication;
  isEditing: boolean;
  validationErrors: string[];
  isDuplicate: boolean;
  duplicateOf?: import('./medication').Medication;
}

/**
 * User's choice when duplicate medication is detected
 */
export type DuplicateAction = 'replace' | 'add_both' | 'cancel';
