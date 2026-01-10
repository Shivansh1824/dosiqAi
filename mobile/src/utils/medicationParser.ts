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
 * Format frequency display text based on timing data
 * 
 * Logic:
 * - If total_times_per_day <= 3: Parse dosage "1-0-1" → "Morning-Night"
 * - Else: "{total_times_per_day} Times"
 * - Append with comma: ", Everyday" or ", Every X Days"
 * 
 * @param dosage - Timing pattern like "1-0-1" (morning-afternoon-night)
 * @param totalTimesPerDay - Number of times per day
 * @param intervalDays - Days between doses (1=daily, 2=alternate, 7=weekly, 0=as_needed)
 * @returns User-friendly frequency string
 * 
 * @example
 * formatFrequencyDisplay("1-0-1", 2, 1) // "Morning-Night, Everyday"
 * formatFrequencyDisplay("1-1-1", 3, 2) // "Morning-Afternoon-Night, Every 2 Days"
 * formatFrequencyDisplay(null, 4, 1)    // "4 Times, Everyday"
 */
export function formatFrequencyDisplay(
  dosage: string | null | undefined,
  totalTimesPerDay: number | null | undefined,
  intervalDays: number | null | undefined
): string {
  let frequencyPart = '';

  // Determine frequency text
  if (totalTimesPerDay && totalTimesPerDay <= 3 && dosage) {
    // Parse "1-0-1" format
    const parts = dosage.split('-').map(Number);
    if (parts.length === 3 && parts.every(p => !isNaN(p))) {
      const timeLabels: string[] = [];
      if (parts[0] > 0) timeLabels.push('Morning');
      if (parts[1] > 0) timeLabels.push('Afternoon');
      if (parts[2] > 0) timeLabels.push('Night');
      frequencyPart = timeLabels.join('-') || 'As Needed';
    } else {
      frequencyPart = 'As Needed';
    }
  } else if (totalTimesPerDay && totalTimesPerDay > 3) {
    frequencyPart = `${totalTimesPerDay} Times`;
  } else {
    frequencyPart = 'As Needed';
  }

  // Determine interval text with proper capitalization
  let intervalPart = '';
  if (intervalDays === 0 || intervalDays === null || intervalDays === undefined) {
    intervalPart = ''; // As needed or no interval specified
  } else if (intervalDays === 1) {
    intervalPart = 'Everyday';
  } else if (intervalDays > 1) {
    intervalPart = `Every ${intervalDays} Days`;
  }

  // Join with comma
  return intervalPart ? `${frequencyPart}, ${intervalPart}` : frequencyPart;
}

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

  // X-X-X pattern (e.g. 1-0-1, 1-1-1, 0-0-1) representing Morning-Afternoon-Night
  // Also supports spaces instead of dashes: "1 0 1"
  const tripleMatch = normalized.match(/^(\d+)[-\s]+(\d+)[-\s]+(\d+)$/);
  if (tripleMatch) {
    const morning = parseInt(tripleMatch[1]);
    const afternoon = parseInt(tripleMatch[2]);
    const night = parseInt(tripleMatch[3]);

    // Count how many non-zero slots there are to determine frequency
    // Note: We count successful "events", not total pills.
    // e.g., 2-0-0 is once daily (Morning), 1-0-1 is twice daily (Morning, Night)
    let frequencyCount = 0;
    if (morning > 0) frequencyCount++;
    if (afternoon > 0) frequencyCount++;
    if (night > 0) frequencyCount++;

    if (frequencyCount === 1) return 'once_daily';
    if (frequencyCount === 2) return 'twice_daily';
    if (frequencyCount === 3) return 'three_times_daily';
    if (frequencyCount > 3) return 'four_times_daily';

    // If all are 0 (0-0-0), usually means as needed or incorrectly parsed
    if (frequencyCount === 0) return 'as_needed';
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

  // Pattern: [number] [unit] (supports abbreviations like "3d", "2w", "1m")
  // Supports: "3 days", "3d", "2 weeks", "2w", etc.
  const match = normalized.match(/(\d+)\s*(d|day|days|w|week|weeks|m|month|months|y|year|years)/i);
  if (!match) {
    console.warn(`[MedicationParser] Could not parse duration: "${durationString}"`);
    return null;
  }

  const quantity = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  // Convert to days
  if (unit.startsWith('d')) {
    return quantity;
  } else if (unit.startsWith('w')) {
    return quantity * 7;
  } else if (unit.startsWith('m')) {
    return quantity * 30; // Approximate (28-31 days)
  } else if (unit.startsWith('y')) {
    return quantity * 365; // Approximate
  }

  return null;
}

/**
 * Calculate end date from start date and duration
 *
 * @param startDate - Start date in ISO format (YYYY-MM-DD)
 * @param durationDays - Number of days (start date counts as day 1)
 * @returns End date in ISO format (YYYY-MM-DD)
 *
 * @example
 * calculateEndDate("2025-01-01", 7) // returns "2025-01-07" (7-day course: Jan 1-7)
 */
export function calculateEndDate(startDate: string, durationDays: number): string {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + durationDays - 1);  // Subtract 1 because start date counts as day 1

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
 * Generate time slots from frequency code pattern if available
 * Tries to map X-X-X patterns to specific times of day
 * Falls back to frequency-based default slots
 *
 * @param code - Original frequency code (e.g., "1-0-1")
 * @param frequency - Parsed frequency enum
 */
export function generateTimeSlotsFromFrequencyCode(code: string | undefined, frequency: MedicationFrequency): string[] {
  if (!code) return generateDefaultTimeSlots(frequency);

  const normalized = code.trim().replace(/\s+/g, '');

  // X-X-X pattern (Morning-Afternoon-Night)
  // e.g. 1-0-1 -> Morning (08:00) and Night (20:00)
  const tripleMatch = normalized.match(/^(\d+)-(\d+)-(\d+)$/);
  if (tripleMatch) {
    const morning = parseInt(tripleMatch[1]);
    const afternoon = parseInt(tripleMatch[2]);
    const night = parseInt(tripleMatch[3]);

    const slots: string[] = [];
    if (morning > 0) slots.push('08:00');
    if (afternoon > 0) slots.push('14:00');
    if (night > 0) slots.push('20:00');

    // If we found valid slots, return them
    if (slots.length > 0) return slots;
  }

  // Fallback to standard frequency slots
  return generateDefaultTimeSlots(frequency);
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
 * Parse food relationship from special instructions
 * Detects meal timing keywords and medical abbreviations
 *
 * @param specialInstructions - Special instructions text from prescription
 * @returns FoodRelationship enum value
 *
 * @example
 * parseFoodRelationship("After Dinner") // returns 'after_food'
 * parseFoodRelationship("Take on empty stomach") // returns 'empty_stomach'
 * parseFoodRelationship("PC") // returns 'after_food' (post cibum)
 */
export function parseFoodRelationship(specialInstructions: string | null | undefined): import('../types/medication').FoodRelationship {
  if (!specialInstructions) return 'anytime';

  const normalized = specialInstructions.toLowerCase().trim();

  // Empty stomach patterns
  if (
    normalized.includes('empty stomach') ||
    normalized.includes('empty-stomach') ||
    normalized.includes('before breakfast') ||
    normalized.includes('30 min before') ||
    normalized.includes('60 min before') ||
    normalized.includes('1 hour before') ||
    normalized.includes('half hour before')
  ) {
    return 'empty_stomach';
  }

  // Before food patterns
  if (
    normalized.includes('before food') ||
    normalized.includes('before meal') ||
    normalized.includes('before eating') ||
    normalized.includes('pre meal') ||
    normalized.includes('15 min before') ||
    normalized.includes('ac') || // ante cibum (before food)
    /\bac\b/.test(normalized) // word boundary check for AC
  ) {
    return 'before_food';
  }

  // With food patterns
  if (
    normalized.includes('with food') ||
    normalized.includes('with meal') ||
    normalized.includes('during meal') ||
    normalized.includes('during food') ||
    normalized.includes('while eating')
  ) {
    return 'with_food';
  }

  // After food patterns (most common)
  if (
    normalized.includes('after food') ||
    normalized.includes('after meal') ||
    normalized.includes('after eating') ||
    normalized.includes('after dinner') ||
    normalized.includes('after lunch') ||
    normalized.includes('after breakfast') ||
    normalized.includes('post meal') ||
    normalized.includes('pc') || // post cibum (after food)
    /\bpc\b/.test(normalized) // word boundary check for PC
  ) {
    return 'after_food';
  }

  // Default to anytime for anything else (including SOS, PRN, unclear instructions)
  return 'anytime';
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
  // Use code-aware time slot generation to capture 1-0-1 specific times
  const timeSlots = generateTimeSlotsFromFrequencyCode(medicine.frequency, frequency);
  const confidence = determineConfidence(medicine.assumed_enriched_data?.is_identified);

  // Build notes from special instructions
  let notes = '';
  if (medicine.special_instructions) {
    notes = medicine.special_instructions;
  }
  if (documentTitle) {
    notes = notes ? `${notes}\n\nFrom: ${documentTitle}` : `From: ${documentTitle}`;
  }

  // Parse food relationship from special instructions
  const foodRelationship = parseFoodRelationship(medicine.special_instructions);

  return {
    name: cleanMedicationName(medicine.exact_written_name),
    scientific_name: medicine.assumed_enriched_data?.scientific_name,
    medicine_type: medicine.assumed_enriched_data?.medicine_type,
    medicine_purpose: medicine.assumed_enriched_data?.medicine_purpose,
    dosage: medicine.dosage_instruction || '',
    frequency,
    original_frequency_code: medicine.frequency || '',
    duration_days: medicine.duration_days ?? durationDays,
    interval_days: medicine.interval_days ?? null,
    timing_dosage: medicine.timing?.dosage,
    total_times_per_day: medicine.timing?.total_times_per_day,
    time_of_day: timeSlots,
    food_relationship: foodRelationship,
    notes,
    confidence,
    ai_extracted: true,
    verified_by_user: false,
    source_raw: medicine,
  };
}
