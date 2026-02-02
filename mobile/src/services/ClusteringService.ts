
import { Medication } from '../types/medication';

/**
 * Service to handle grouping of medications into time clusters.
 * This is the "Brain" of the clustering strategy.
 */

/**
 * Determines if a medication is active for a given date.
 * Checks:
 * 1. is_active flag
 * 2. start_date <= targetDate
 * 3. end_date >= targetDate (if exists)
 */
export function isMedicationActiveForDate(medication: Medication, targetDate: Date): boolean {


  // Normalize dates to YYYY-MM-DD for comparison to avoid time issues
  const targetDateStr = targetDate.toISOString().split('T')[0];
  const startDateStr = medication.start_date; // Assuming YYYY-MM-DD string from specific types/DB

  if (targetDateStr < startDateStr) {
    return false;
  }

  if (medication.end_date) {
    const endDateStr = medication.end_date;
    if (targetDateStr > endDateStr) {
      return false;
    }
  }

  // 4. Interval Check (The "Gap" Logic)
  // If interval_days > 1, check if today is a valid day in the cycle
  if (medication.interval_days && medication.interval_days > 1) {
    const start = new Date(startDateStr);
    // Reset time to midnight for accurate day diff
    start.setHours(0, 0, 0, 0);
    const target = new Date(targetDateStr);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays % medication.interval_days !== 0) {
      return false;
    }
  }

  return true;
}

/**
 * Groups medications by their scheduled time.
 * @param medications List of all medications
 * @param targetDate The date for which we are scheduling (defaults to today)
 * @returns Record where key is time ("HH:mm") and value is list of Medications
 */
export function groupMedicinesByTime(
  medications: Medication[],
  targetDate: Date = new Date()
): Record<string, Medication[]> {
  const clusters: Record<string, Medication[]> = {};

  medications.forEach((med) => {
    // 1. Filter out inactive medicines
    if (!isMedicationActiveForDate(med, targetDate)) {
      return;
    }

    // 2. Place into time buckets
    if (med.time_of_day && Array.isArray(med.time_of_day)) {
      med.time_of_day.forEach((rawTime) => {
        // Sanitize time (trim spaces)
        const time = rawTime.trim();
        // time is expected to be "HH:mm"
        if (!time) return;

        if (!clusters[time]) {
          clusters[time] = [];
        }
        clusters[time].push(med);
      });
    }
  });

  return clusters;
}

/**
 * Generates a deterministic ID for a cluster notification.
 * Format: cluster_{HHmm}_{YYYY-MM-DD}
 */
export function generateClusterId(time: string, date: Date): string {
  const cleanTime = time.replace(':', '');
  const dateStr = date.toISOString().split('T')[0];
  return `cluster_${cleanTime}_${dateStr}`;
}
