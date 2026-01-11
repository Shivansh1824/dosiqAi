/**
 * Prescription Display Helpers
 * Consolidated utilities for prescription-related UI display
 */

import { MedicineInfo, MealRelation, MedicineForm } from '../types/document';
import { Colors } from '../constants';

/**
 * Get emoji icon for medicine form
 */
export const getFormIcon = (form?: MedicineForm | null): string => {
    switch (form) {
        case 'Syrup': return '🧴';
        case 'Tablet': return '💊';
        case 'Capsule': return '💊';
        case 'Injection': return '💉';
        case 'Drops': return '💧';
        case 'Cream': return '🧴';
        case 'Inhaler': return '🌬️';
        default: return '💊';
    }
};

/**
 * Parse time_of_day "1-0-1" format to boolean flags
 */
export const parseTimeOfDay = (timeStr?: string): { morning: boolean; afternoon: boolean; night: boolean } => {
    if (!timeStr) return { morning: false, afternoon: false, night: false };
    const parts = timeStr.split('-').map(p => p === '1');
    return {
        morning: parts[0] || false,
        afternoon: parts[1] || false,
        night: parts[2] || false,
    };
};

/**
 * Get human-readable meal timing text
 */
export const getMealText = (relation?: MealRelation | string | null): string | null => {
    switch (relation) {
        case 'before_food': return 'Before food';
        case 'after_food': return 'After food';
        case 'with_food': return 'With food';
        case 'empty_stomach': return 'Empty stomach';
        case 'any': return 'Any time';
        default: return null;
    }
};

/**
 * Get human-readable interval text from days
 */
export const getIntervalText = (days?: number): string | null => {
    switch (days) {
        case 0: return 'As needed';
        case 1: return 'Daily';
        case 2: return 'Alternate days';
        case 7: return 'Weekly';
        default: return days ? `Every ${days} days` : null;
    }
};

/**
 * Get confidence indicator color based on confidence value (0.0-1.0)
 */
export const getConfidenceColor = (confidence?: number): string => {
    if (!confidence) return Colors.gray400;
    if (confidence >= 0.9) return Colors.success;
    if (confidence >= 0.7) return Colors.warning;
    return Colors.error;
};

/**
 * Get color for medicine type badge
 */
export const getTypeColor = (type?: string): string => {
    switch (type?.toLowerCase()) {
        case 'antibiotic': return '#2563EB';
        case 'analgesic': return '#059669';
        case 'antacid/ppi': return '#7C3AED';
        case 'antihistamine': return '#DB2777';
        case 'vitamin/supplement': return '#F59E0B';
        default: return Colors.gray500;
    }
};

/**
 * Format document type for display (e.g., "lab_report" -> "Lab Report")
 */
export const formatDocumentType = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
};

/**
 * Get category icon for other information chips
 */
export const getCategoryIcon = (category: string): string => {
    switch (category) {
        case 'Vitals': return '⚖️';
        case 'Lifestyle': return '🏃';
        case 'Diet': return '🥗';
        case 'Allergy': return '⚠️';
        case 'Notes': return '📝';
        default: return '📋';
    }
};

/**
 * Format date for display (e.g., "Jan 12, 2026")
 */
export const formatDisplayDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

/**
 * Shorten doctor name if too long
 * Removes "Dr." prefix, checks length, and re-adds "Dr." prefix
 */
export const formatDoctorName = (rawName: string, maxLength: number = 14): string => {
    const personName = rawName.replace(/^Dr\.?\s*/i, '').trim();
    const nameParts = personName.split(' ');
    const firstName = nameParts[0] || '';
    return personName.length > maxLength
        ? `Dr. ${firstName}`
        : `Dr. ${personName}`;
};
