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
