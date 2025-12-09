/**
 * Medication Parser Utility
 * Handles parsing of AI-extracted medication data from prescriptions
 * Converts medical frequency codes, duration strings, and detects duplicates
 */

import { MedicationFrequency, Medication } from '../types/medication';
import { MedicineInfo } from '../types/document';
import { ParsedMedication, VerificationConfidence } from '../types/medicationVerification';

/**
 * Comprehensive medical frequency code mapping
 * Sources: Medical prescription abbreviations (Latin origins)
 *
 * Common codes:
 * - Q = quaque (every)
 * - H = hora (hour)
 * - D = dies (day)
 * - BID/BD = bis in die (twice daily)
 * - TID/TDS = ter in die/ter die sumendus (three times daily)
 * - QID/QDS = quater in die (four times daily)
 * - PRN = pro re nata (as needed)
 * - SOS = si opus sit (if needed)
 */
const FREQUENCY_CODE_MAP: Record<string, MedicationFrequency> = {
  // Once daily variants
  'OD': 'once_daily',
  'QD': 'once_daily',
  'DAILY': 'once_daily',
  'ONCE DAILY': 'once_daily',
  'ONCE A DAY': 'once_daily',
  '1X/DAY': 'once_daily',
  '1X DAILY': 'once_daily',
  'ONCE PER DAY': 'once_daily',

  // Twice daily variants
  'BD': 'twice_daily',
  'BID': 'twice_daily',
  'B.I.D.': 'twice_daily',
  'TWICE DAILY': 'twice_daily',
  'TWICE A DAY': 'twice_daily',
  '2X/DAY': 'twice_daily',
  '2X DAILY': 'twice_daily',
  'Q12H': 'twice_daily',
  'TWICE PER DAY': 'twice_daily',

  // Three times daily variants
  'TDS': 'three_times_daily',
  'TID': 'three_times_daily',
  'T.I.D.': 'three_times_daily',
  'THREE TIMES DAILY': 'three_times_daily',
  'THRICE DAILY': 'three_times_daily',
  '3X/DAY': 'three_times_daily',
  '3X DAILY': 'three_times_daily',
  'Q8H': 'three_times_daily',
  'THREE TIMES A DAY': 'three_times_daily',

  // Four times daily variants
  'QDS': 'four_times_daily',
  'QID': 'four_times_daily',
  'Q.I.D.': 'four_times_daily',
  'FOUR TIMES DAILY': 'four_times_daily',
  '4X/DAY': 'four_times_daily',
  '4X DAILY': 'four_times_daily',
  'Q6H': 'four_times_daily',
  'FOUR TIMES A DAY': 'four_times_daily',

  // As needed variants
  'SOS': 'as_needed',
  'PRN': 'as_needed',
  'AS NEEDED': 'as_needed',
  'WHEN REQUIRED': 'as_needed',
  'IF NEEDED': 'as_needed',
  'AS REQUIRED': 'as_needed',
  'WHEN NECESSARY': 'as_needed',

  // Weekly variants
  'WEEKLY': 'weekly',
  'ONCE A WEEK': 'weekly',
  'QW': 'weekly',
  'ONCE WEEKLY': 'weekly',

  // Monthly variants
  'MONTHLY': 'monthly',
  'ONCE A MONTH': 'monthly',
  'QM': 'monthly',
  'ONCE MONTHLY': 'monthly',
};

/**
 * Parse medical frequency code to app enum
 * Handles various formats and abbreviations used in prescriptions
 *
 * @param code - Medical frequency code (e.g., "Q6H", "TDS", "BD")
 * @returns MedicationFrequency enum value
 *
 * @example
 * parseMedicalFrequency("Q6H") // returns 'four_times_daily'
 * parseMedicalFrequency("TDS") // returns 'three_times_daily'
 * parseMedicalFrequency("SOS") // returns 'as_needed'
 */
export function parseMedicalFrequency(code: string | undefined): MedicationFrequency {
  if (!code) return 'as_needed'; // Default fallback

  // Normalize: uppercase, trim, remove extra spaces
  const normalized = code.toUpperCase().trim().replace(/\s+/g, ' ');

  // Direct lookup
  if (FREQUENCY_CODE_MAP[normalized]) {
    return FREQUENCY_CODE_MAP[normalized];
  }

  // Pattern matching for variations

  // Q[number]H pattern (e.g., Q4H, Q8H, Q12H)
  const qhMatch = normalized.match(/Q(\d+)H/);
  if (qhMatch) {
    const hours = parseInt(qhMatch[1]);
    if (hours <= 6) return 'four_times_daily';
    if (hours <= 8) return 'three_times_daily';
    if (hours <= 12) return 'twice_daily';
    return 'once_daily';
  }

  // Number X per day pattern (e.g., "2 TIMES/DAY", "3X DAILY")
  const timesPerDayMatch = normalized.match(/(\d+)\s*[X\/]?\s*(TIMES?|PER)?\s*(DAY|DAILY)/);
  if (timesPerDayMatch) {
    const times = parseInt(timesPerDayMatch[1]);
    if (times === 1) return 'once_daily';
    if (times === 2) return 'twice_daily';
    if (times === 3) return 'three_times_daily';
    if (times >= 4) return 'four_times_daily';
  }

  console.warn(`[MedicationParser] Unknown frequency code: "${code}", defaulting to as_needed`);
  return 'as_needed'; // Safe fallback
}

/**
 * Parse duration string to number of days
 * Handles natural language durations from prescriptions
 *
 * @param durationString - Natural language duration (e.g., "3 days", "2 weeks", "1 month")
 * @returns Number of days, or null if not parseable or "as needed"
 *
 * @example
 * parseDuration("3 days") // returns 3
 * parseDuration("2 weeks") // returns 14
 * parseDuration("as needed") // returns null
 */
export function parseDuration(durationString: string | null | undefined): number | null {
  if (!durationString) return null;

  const normalized = durationString.toLowerCase().trim();

  // Check for "as needed" or similar
  if (
    normalized.includes('as needed') ||
    normalized.includes('as required') ||
    normalized.includes('prn') ||
    normalized.includes('sos') ||
    normalized.includes('ongoing') ||
    normalized.includes('continuous') ||
    normalized.includes('indefinite')
  ) {
    return null;
  }

  // Pattern: [number] [unit]
  // Supports: "3 days", "2 weeks", "1 month", "7 days", etc.
  const match = normalized.match(/(\d+)\s*(day|days|week|weeks|month|months|year|years)/);
  if (!match) {
    console.warn(`[MedicationParser] Could not parse duration: "${durationString}"`);
    return null;
  }

  const quantity = parseInt(match[1]);
  const unit = match[2];

  // Convert to days
  if (unit.startsWith('day')) {
    return quantity;
  } else if (unit.startsWith('week')) {
    return quantity * 7;
  } else if (unit.startsWith('month')) {
    return quantity * 30; // Approximate (28-31 days)
  } else if (unit.startsWith('year')) {
    return quantity * 365; // Approximate
  }

  return null;
}

/**
 * Calculate end date from start date and duration
 *
 * @param startDate - Start date in ISO format (YYYY-MM-DD)
 * @param durationDays - Number of days
 * @returns End date in ISO format (YYYY-MM-DD)
 *
 * @example
 * calculateEndDate("2025-01-01", 7) // returns "2025-01-08"
 */
export function calculateEndDate(startDate: string, durationDays: number): string {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + durationDays);

  // Return ISO date string (YYYY-MM-DD)
  return end.toISOString().split('T')[0];
}

/**
 * Generate default time slots based on frequency
 * Uses medically appropriate timing intervals
 *
 * @param frequency - Medication frequency enum
 * @returns Array of time strings in HH:MM format
 *
 * @example
 * generateDefaultTimeSlots('twice_daily') // returns ["08:00", "20:00"]
 * generateDefaultTimeSlots('four_times_daily') // returns ["08:00", "14:00", "20:00", "02:00"]
 */
export function generateDefaultTimeSlots(frequency: MedicationFrequency): string[] {
  switch (frequency) {
    case 'once_daily':
      return ['08:00']; // Morning

    case 'twice_daily':
      return ['08:00', '20:00']; // Morning and night (12 hours apart)

    case 'three_times_daily':
      return ['08:00', '14:00', '20:00']; // Morning, afternoon, night (8 hours apart)

    case 'four_times_daily':
      return ['08:00', '14:00', '20:00', '02:00']; // Every 6 hours

    case 'as_needed':
      return []; // No fixed schedule

    case 'weekly':
      return ['08:00']; // Weekly, default to morning

    case 'monthly':
      return ['08:00']; // Monthly, default to morning

    default:
      return ['08:00']; // Safe default
  }
}

/**
 * Detect duplicate medication in existing active medications
 * Uses fuzzy name matching and dosage comparison
 * Only checks medications that are currently active (not expired)
 *
 * @param name - Medication name to check
 * @param dosage - Dosage to check
 * @param existingMeds - Array of existing medications
 * @returns Duplicate medication if found, null otherwise
 *
 * @example
 * const existingMeds = [{ name: "Paracetamol", dosage: "500mg", is_active: true }];
 * detectDuplicateMedication("PARACETAMOL", "500mg", existingMeds) // returns the existing medication
 */
export function detectDuplicateMedication(
  name: string,
  dosage: string,
  existingMeds: Medication[]
): Medication | null {
  const normalizedName = name.toLowerCase().trim();
  const normalizedDosage = dosage.toLowerCase().trim();

  // Only check ACTIVE medications that aren't expired
  const activeMeds = existingMeds.filter(med => {
    if (!med.is_active) return false;

    // Check if medication is expired
    if (med.end_date) {
      const endDate = new Date(med.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset to start of day for fair comparison
      if (endDate < today) return false;
    }

    return true;
  });

  // Look for duplicate
  for (const med of activeMeds) {
    const existingName = med.name.toLowerCase().trim();
    const existingDosage = med.dosage.toLowerCase().trim();

    // Exact name match
    if (existingName === normalizedName) {
      // If dosages also match, it's definitely a duplicate
      if (existingDosage === normalizedDosage) {
        return med;
      }

      // If name matches but dosage differs, still flag as duplicate
      // (user might be changing dosage)
      return med;
    }

    // Fuzzy name match (contains or very similar)
    if (existingName.includes(normalizedName) || normalizedName.includes(existingName)) {
      return med;
    }

    // Check scientific name if available
    if (med.scientific_name) {
      const scientificName = med.scientific_name.toLowerCase().trim();
      if (scientificName === normalizedName || normalizedName.includes(scientificName)) {
        return med;
      }
    }
  }

  return null;
}

/**
 * Determine confidence level based on AI identification
 *
 * @param isIdentified - Whether AI confidently identified the medication
 * @returns Confidence level for UI display
 */
export function determineConfidence(isIdentified?: boolean): VerificationConfidence {
  if (isIdentified === true) return 'high';
  if (isIdentified === false) return 'low';
  return 'medium'; // If undefined or uncertain
}

/**
 * Clean up medication name from prescription format
 * Removes common prefixes like "SYP", "TAB", "CAP", etc.
 *
 * @param exactWrittenName - Raw name from prescription
 * @returns Cleaned medication name
 *
 * @example
 * cleanMedicationName("SYP CALPOL (250/5)") // returns "CALPOL (250/5)"
 * cleanMedicationName("TAB PARACETAMOL") // returns "PARACETAMOL"
 */
export function cleanMedicationName(exactWrittenName: string): string {
  let cleaned = exactWrittenName.trim();

  // Remove common prescription prefixes
  const prefixes = [
    'SYP ', 'SYRUP ', 'SYR ',
    'TAB ', 'TABLET ', 'TABS ',
    'CAP ', 'CAPSULE ', 'CAPS ',
    'INJ ', 'INJECTION ',
    'SGP ', // Soft gel capsule
    'CR ', 'CREAM ',
    'OIN ', 'OINTMENT ',
    'DROP ', 'DROPS ',
    'SUSP ', 'SUSPENSION ',
    'SOL ', 'SOLUTION ',
  ];

  for (const prefix of prefixes) {
    if (cleaned.toUpperCase().startsWith(prefix)) {
      cleaned = cleaned.substring(prefix.length);
      break;
    }
  }

  return cleaned.trim();
}

/**
 * Main parser: Convert AI-extracted medicine to ParsedMedication
 * Combines all parsing functions to create app-ready medication object
 *
 * @param medicine - AI-extracted medicine info
 * @param documentId - Source document ID
 * @param documentTitle - Source document title
 * @returns Parsed medication ready for user verification
 *
 * @example
 * const medicine = {
 *   exact_written_name: "SYP CALPOL (250/5)",
 *   dosage_instruction: "4ML",
 *   frequency: "Q6H",
 *   duration: "3 days",
 *   assumed_enriched_data: { is_identified: true, scientific_name: "Paracetamol" }
 * };
 * const parsed = parseAIMedication(medicine, "doc123", "Prescription");
 * // Returns ParsedMedication with frequency: 'four_times_daily', duration_days: 3, etc.
 */
export function parseAIMedication(
  medicine: MedicineInfo,
  documentId: string,
  documentTitle: string
): ParsedMedication {
  const frequency = parseMedicalFrequency(medicine.frequency);
  const durationDays = parseDuration(medicine.duration);
  const timeSlots = generateDefaultTimeSlots(frequency);
  const confidence = determineConfidence(medicine.assumed_enriched_data?.is_identified);

  // Build notes from special instructions
  let notes = '';
  if (medicine.special_instructions) {
    notes = medicine.special_instructions;
  }
  if (documentTitle) {
    notes = notes ? `${notes}\n\nFrom: ${documentTitle}` : `From: ${documentTitle}`;
  }

  return {
    name: cleanMedicationName(medicine.exact_written_name),
    scientific_name: medicine.assumed_enriched_data?.scientific_name,
    dosage: medicine.dosage_instruction || '',
    frequency,
    original_frequency_code: medicine.frequency || '',
    duration_days: durationDays,
    time_of_day: timeSlots,
    notes,
    confidence,
    ai_extracted: true,
    verified_by_user: false,
    source_raw: medicine,
  };
}
