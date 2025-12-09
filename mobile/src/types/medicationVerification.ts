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
  scientific_name?: string;              // From assumed_enriched_data
  dosage: string;                        // From dosage_instruction
  frequency: MedicationFrequency;        // Parsed from frequency code
  original_frequency_code: string;       // Store original (e.g., "Q6H", "TDS")
  duration_days: number | null;          // Parsed from duration string
  time_of_day: string[];                 // Auto-generated based on frequency
  notes: string;                         // Combined from special_instructions

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
