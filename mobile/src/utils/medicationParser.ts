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
 * Determine if the frequency logic results in "As Needed"
 * Used to conditionally hide UI sections like Course Period
 * 
 * @param dosage - Timing pattern like "1-0-1"
 * @param totalTimesPerDay - Number of times per day
 * @returns true if frequency is "As Needed"
 */
export function isAsNeededFrequency(
  dosage: string | null | undefined,
  totalTimesPerDay: number | null | undefined
): boolean {
  if (totalTimesPerDay && totalTimesPerDay <= 3 && dosage) {
    const parts = dosage.split('-').map(Number);
    if (parts.length === 3 && parts.every(p => !isNaN(p))) {
      return false;
    }
    return true;
  } else if (totalTimesPerDay && totalTimesPerDay > 3) {
    return false;
  }
  return true;
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
export function generateDefaultTimeSlots(frequency: MedicationFrequency, preferences?: { morning_dose_time?: string, afternoon_dose_time?: string, night_dose_time?: string }): string[] {
  const morning = preferences?.morning_dose_time?.substring(0, 5) || '08:00';
  const afternoon = preferences?.afternoon_dose_time?.substring(0, 5) || '14:00';
  const night = preferences?.night_dose_time?.substring(0, 5) || '21:00';

  switch (frequency) {
    case 'once_daily':
      return [morning]; // Morning

    case 'twice_daily':
      return [morning, night]; // Morning and night

    case 'three_times_daily':
      return [morning, afternoon, night]; // Morning, afternoon, night

    case 'four_times_daily':
      // For 4 times, we need a mid-point. Default to 17:00 or somewhere between afternoon and night
      return [morning, afternoon, '17:00', night]; 

    case 'as_needed':
      return []; // No fixed schedule

    case 'weekly':
      return [morning]; // Weekly, default to morning

    case 'monthly':
      return [morning]; // Monthly, default to morning

    default:
      return [morning]; // Safe default
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
export function generateTimeSlotsFromFrequencyCode(code: string | undefined, frequency: MedicationFrequency, preferences?: { morning_dose_time?: string, afternoon_dose_time?: string, night_dose_time?: string }): string[] {
  if (!code) return generateDefaultTimeSlots(frequency, preferences);

  const morning = preferences?.morning_dose_time?.substring(0, 5) || '08:00';
  const afternoon = preferences?.afternoon_dose_time?.substring(0, 5) || '14:00';
  const night = preferences?.night_dose_time?.substring(0, 5) || '21:00';
  const evening = '18:00'; // Standard evening fallback

  const normalized = code.toUpperCase();
  const slots: string[] = [];

  // Keywords logic: Check strictly for specific time-of-day mentions
  // Sequence enforced by check order: Morning -> Afternoon -> Evening -> Night

  // Morning
  if (normalized.includes('MORNING')) {
    slots.push(morning);
  }

  // Afternoon
  if (normalized.includes('AFTERNOON')) {
    slots.push(afternoon);
  }

  // Evening
  if (normalized.includes('EVENING')) {
    slots.push(evening);
  }

  // Night
  if (normalized.includes('NIGHT')) {
    slots.push(night);
  }

  // If we found valid keyword-based slots, return them
  if (slots.length > 0) {
    return slots;
  }

  // X-X-X pattern (Morning-Afternoon-Night) fallback
  const tripleMatch = normalized.match(/^(\d+)-(\d+)-(\d+)$/);
  if (tripleMatch) {
    const m = parseInt(tripleMatch[1]);
    const a = parseInt(tripleMatch[2]);
    const n = parseInt(tripleMatch[3]);

    if (m > 0) slots.push(morning);
    if (a > 0) slots.push(afternoon);
    if (n > 0) slots.push(night); 

    if (slots.length > 0) return slots;
  }

  // X-X-X-X pattern (Morning-Afternoon-Evening-Night)
  const quadMatch = normalized.match(/^(\d+)-(\d+)-(\d+)-(\d+)$/);
  if (quadMatch) {
    const m = parseInt(quadMatch[1]);
    const a = parseInt(quadMatch[2]);
    const e = parseInt(quadMatch[3]);
    const n = parseInt(quadMatch[4]);

    if (m > 0) slots.push(morning);
    if (a > 0) slots.push(afternoon);
    if (e > 0) slots.push(evening);
    if (n > 0) slots.push(night);

    if (slots.length > 0) return slots;
  }

  // Fallback to standard frequency slots
  return generateDefaultTimeSlots(frequency, preferences);
}



/**
 * Strip all special characters and spaces, keeping only alphanumeric chars
 * Used for aggressive matching to ignore formatting/punctuation differences
 * @param str - Input string
 * @returns Normalized alphanumeric string
 */
function stripSpecialChars(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
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
  // Normalize by stripping ALL special chars and spaces
  // "Emset-4mg" -> "emset4mg"
  // "Co-Amoxiclav" -> "coamoxiclav"
  const cleanTargetName = stripSpecialChars(name);
  const cleanTargetDosage = stripSpecialChars(dosage);
  const targetNameLength = cleanTargetName.length;

  // Only check ACTIVE medications that aren't expired (User Request: "Expiry logic is correct")
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
    const cleanExistingName = stripSpecialChars(med.name);
    const cleanExistingDosage = stripSpecialChars(med.dosage);

    // 1. Exact name match (after strict cleaning)
    if (cleanExistingName === cleanTargetName) {
      // If names match identically (ignoring format), it's a match.
      return med;
    }

    // 2. Contains match (Substrings)
    if (cleanExistingName.includes(cleanTargetName) || cleanTargetName.includes(cleanExistingName)) {
      return med;
    }

    // REMOVED: Fuzzy match (Levenshtein) per user request.
    // Logic is now strict: remove spaces/special chars -> check if same.

    // 3. Check scientific name match
    if (med.scientific_name) {
      const cleanScientific = stripSpecialChars(med.scientific_name);
      if (cleanScientific === cleanTargetName || cleanTargetName.includes(cleanScientific)) {
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
  if (!exactWrittenName) return '';
  const original = exactWrittenName.trim();
  let cleaned = original;

  // 1. Remove common prescription prefixes (case insensitive)
  const prefixes = [
    'SYP', 'SYRUP', 'SYR',
    'TAB', 'TABLET', 'TABS',
    'CAP', 'CAPSULE', 'CAPS',
    'INJ', 'INJECTION',
    'SGP', 'CR', 'CREAM', 'OIN', 'OINTMENT',
    'DROP', 'DROPS', 'SUSP', 'SUSPENSION', 'SOL', 'SOLUTION'
  ];

  // Create a regex for prefixes followed by a dot and/or space
  // e.g., "SYP ", "SYP. ", "TAB.", "TAB "
  const prefixRegex = new RegExp(`^(${prefixes.join('|')})[\\s\\.]+\\s*`, 'i');
  cleaned = cleaned.replace(prefixRegex, '');

  // 2. Remove strengths in parentheses or brackets (e.g., "(200mg)", "[500]", "(100/5)")
  // This matches anything inside () or [] that contains a number
  cleaned = cleaned.replace(/\s*[([][^)\]]*?\d+[^)\]]*?[)\]]/g, '').trim();

  // 3. Remove standalone strength units (e.g., "500mg", "10ml", "0.5%", "60K", "10 units")
  // Matches Number + optional space + unit
  const units = ['mg', 'g', 'mcg', 'ml', 'iu', '%', 'u', 'units', 'k'];
  const unitRegex = new RegExp(`\\s*\\d+(\\.\\d+)?\\s*(${units.join('|')})\\b`, 'gi');
  cleaned = cleaned.replace(unitRegex, '').trim();

  // 4. Remove trailing numbers preceded by a space (e.g., "Paracetamol 500" -> "Paracetamol")
  // But ONLY if it's not the ONLY thing left (to preserve brands that are just numbers)
  // And ONLY if it's a "clean" number (not like 6-MP)
  const trailingNumberMatch = cleaned.match(/(.+)\s+\d+(\.\d+)?$/);
  if (trailingNumberMatch && trailingNumberMatch[1].trim().length > 0) {
    cleaned = trailingNumberMatch[1].trim();
  }

  // 5. Final sanitation: remove trailing punctuation/spaces
  cleaned = cleaned.replace(/[,\s.-]+$/, '').trim();

  // 6. BRAND INTEGRITY FALLBACK
  // If we cleaned it too much and it's empty, use the original (minus prefixes)
  // This handles cases like medicine name being just "6-MP" or "123"
  if (!cleaned) {
    cleaned = original.replace(prefixRegex, '').trim();
  }

  return cleaned;
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
  documentTitle: string,
  preferences?: { morning_dose_time?: string, afternoon_dose_time?: string, night_dose_time?: string }
): ParsedMedication {
  const frequency = parseMedicalFrequency(medicine.frequency);
  const durationDays = parseDuration(medicine.duration);

  // Use code-aware time slot generation to capture 1-0-1 specific times
  // Priority: timing.dosage (e.g. "0-0-1") > frequency (e.g. "Night daily")
  const originalCode = medicine.timing?.dosage || medicine.frequency;
  const timeSlots = generateTimeSlotsFromFrequencyCode(originalCode, frequency, preferences);
  const confidence = determineConfidence(medicine.assumed_enriched_data?.is_identified);

  // Build notes from special instructions
  // User Request: Prioritize dosage_instruction. If empty, fallback to special_instructions + "From: Title"
  let notes = '';

  if (medicine.dosage_instruction) {
    const instruction = medicine.dosage_instruction.trim();
    notes = instruction.charAt(0).toUpperCase() + instruction.slice(1);

    // Append special instructions if they exist and aren't contained in dosage_instruction
    if (medicine.special_instructions && !notes.includes(medicine.special_instructions)) {
      notes = `${notes}\n${medicine.special_instructions}`;
    }
  } else {
    // Fallback: Original logic
    if (medicine.special_instructions) {
      notes = medicine.special_instructions;
    }
    if (documentTitle) {
      notes = notes ? `${notes}\n\nFrom: ${documentTitle}` : `From: ${documentTitle}`;
    }
  }

  // Parse food relationship: prioritize direct value from timing, fallback to special_instructions
  let foodRelationship: import('../types/medication').FoodRelationship = 'anytime';
  if (medicine.timing?.relation_to_meal) {
    // Direct value from AI analysis (e.g., 'after_food', 'before_food', 'any')
    foodRelationship = medicine.timing.relation_to_meal as import('../types/medication').FoodRelationship;
  } else {
    // Fallback: parse from special_instructions
    foodRelationship = parseFoodRelationship(medicine.special_instructions);
  }

  return {
    name: cleanMedicationName(medicine.exact_written_name),
    strength: medicine.strength,
    form: medicine.form ?? undefined,
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
