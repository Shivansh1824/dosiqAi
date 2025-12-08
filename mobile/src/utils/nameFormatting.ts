/**
 * Name formatting utilities for HomeScreen
 * Handles salutation removal, name extraction, and capitalization
 */

// Comprehensive list of salutations to remove
const SALUTATIONS = [
  'dr', 'dr.', 'doctor',
  'mr', 'mr.', 'mister',
  'mrs', 'mrs.', 'missus',
  'ms', 'ms.',
  'miss',
  'prof', 'prof.', 'professor',
  'sir',
  'madam', 'ma\'am',
  'rev', 'rev.', 'reverend',
  'hon', 'hon.', 'honorable',
  'capt', 'capt.', 'captain',
  'col', 'col.', 'colonel',
  'maj', 'maj.', 'major',
  'lt', 'lt.', 'lieutenant',
];

/**
 * Capitalizes the first letter of a string
 * @param str - String to capitalize
 * @returns Capitalized string
 */
const capitalizeFirstLetter = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Removes salutations from a name string
 * @param fullName - Full name string (e.g., "Dr Manmohan Singh")
 * @returns Name without salutation (e.g., "Manmohan Singh")
 */
const removeSalutation = (fullName: string): string => {
  if (!fullName) return '';

  const nameParts = fullName.trim().split(/\s+/);

  // Check if first part is a salutation
  const firstPart = nameParts[0]?.toLowerCase() || '';
  if (SALUTATIONS.includes(firstPart)) {
    return nameParts.slice(1).join(' ');
  }

  return fullName;
};

/**
 * Extracts and formats the first name from a full name
 * Removes salutations, extracts first name, and capitalizes properly
 *
 * @param fullName - Full name string
 * @returns Formatted first name only
 *
 * @example
 * extractFirstName("Dr Manmohan Singh") // Returns "Manmohan"
 * extractFirstName("manmohan") // Returns "Manmohan"
 * extractFirstName("Shivansh Rana") // Returns "Shivansh"
 * extractFirstName("mr. john doe") // Returns "John"
 */
export const extractFirstName = (fullName: string): string => {
  if (!fullName) return '';

  // Remove salutation
  const nameWithoutSalutation = removeSalutation(fullName);

  // Extract first name (first word after salutation removal)
  const nameParts = nameWithoutSalutation.trim().split(/\s+/);
  const firstName = nameParts[0] || '';

  // Capitalize first letter
  return capitalizeFirstLetter(firstName);
};

/**
 * Formats a full name to "First Last" format
 * Removes salutations and middle names, keeps only first and last name
 *
 * @param fullName - Full name string
 * @returns Formatted "First Last" name
 *
 * @example
 * formatProfileName("Dr Eshwara Manjot Singh") // Returns "Eshwara Singh"
 * formatProfileName("eshwara manjot singh") // Returns "Eshwara Singh"
 * formatProfileName("john doe") // Returns "John Doe"
 * formatProfileName("mrs. jane smith") // Returns "Jane Smith"
 */
export const formatProfileName = (fullName: string): string => {
  if (!fullName) return '';

  // Remove salutation
  const nameWithoutSalutation = removeSalutation(fullName);

  // Split into parts
  const nameParts = nameWithoutSalutation.trim().split(/\s+/);

  if (nameParts.length === 0) return '';
  if (nameParts.length === 1) return capitalizeFirstLetter(nameParts[0]);

  // Get first and last name (skip middle names)
  const firstName = capitalizeFirstLetter(nameParts[0]);
  const lastName = capitalizeFirstLetter(nameParts[nameParts.length - 1]);

  return `${firstName} ${lastName}`;
};
