/**
 * Normalizes a string by converting to lowercase, 
 * replacing special characters (- / ( ) , .) with spaces,
 * collapsing multiple spaces, and trimming.
 * 
 * This follows the same logic as the backend biomarker matching.
 * 
 * @param str - The string to normalize
 * @returns The normalized string
 */
export const normalizeBiomarkerName = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[-/(),.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const formatCategoryName = (category: string): string => {
  if (category === 'All') return 'All';
  return category
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

/**
 * Formats a reference range into a human-readable string.
 * Supports: "min - max", "> min", or "< max".
 */
export const formatReferenceRange = (
  min: number | string | null | undefined,
  max: number | string | null | undefined,
  unit?: string | null
): string => {
  const hasMin = min != null && min !== '';
  const hasMax = max != null && max !== '';

  if (!hasMin && !hasMax) return '';

  let range = '';
  if (hasMin && hasMax) {
    range = `${min} - ${max}`;
  } else if (hasMax) {
    range = `< ${max}`;
  } else if (hasMin) {
    range = `> ${min}`;
  }

  return unit ? `${range} ${unit}` : range;
};
