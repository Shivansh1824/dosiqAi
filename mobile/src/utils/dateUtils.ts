/**
 * Date utility functions for consistent timezone handling
 * All functions work with local dates (not UTC) to prevent timezone bugs
 */

/**
 * Converts a Date object to local date string (YYYY-MM-DD)
 * WITHOUT timezone conversion
 * @param date - Date object to convert
 * @returns Local date string like "2025-12-09"
 */
export const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Creates a Date object from a date string (YYYY-MM-DD) at local midnight
 * WITHOUT timezone conversion
 * @param dateString - Date string like "2025-12-09"
 * @returns Date object at local midnight
 */
export const fromLocalDateString = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

/**
 * Normalizes a Date object to local midnight (removes time component)
 * @param date - Date object to normalize
 * @returns New Date object at local midnight
 */
export const toLocalMidnight = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
};

/**
 * Gets today's date at local midnight
 * @returns Date object for today at 00:00:00 local time
 */
export const getTodayLocal = (): Date => {
  return toLocalMidnight(new Date());
};

/**
 * Compares two dates (ignoring time) and returns if they're the same day
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if same calendar day (ignoring time)
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};
