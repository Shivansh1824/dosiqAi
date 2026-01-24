/**
 * Enhanced medication types for the new Medication tab screen
 * These extend the existing Medication interface with additional fields for scheduling and tracking
 */

// Medicine form types
export type MedicineType =
    | 'pill'
    | 'capsule'
    | 'tablet'
    | 'syrup'
    | 'liquid'
    | 'injection'
    | 'drops'
    | 'inhaler'
    | 'cream'
    | 'other';

// Medication status for daily tracking
export type MedicationStatus = 'pending' | 'taken' | 'missed' | 'skipped';

// Time of day categories
export type TimeOfDayCategory = 'morning' | 'afternoon' | 'evening' | 'night';

// Instruction types
export type MedicationInstruction =
    | 'before_meal'
    | 'after_meal'
    | 'with_food'
    | 'empty_stomach'
    | 'before_sleep'
    | 'with_water'
    | 'as_needed'
    | 'other';

/**
 * Enhanced Medication Schedule interface
 * Extends the base Medication with additional scheduling and tracking fields
 */
export interface MedicationSchedule {
    id: string;
    user_id: string;
    family_member_id?: string;

    // Basic info
    name: string;
    dosage: string; // e.g., "500mg", "10ml", "1 tablet"
    type: MedicineType;

    // Scheduling
    frequency: string; // e.g., "Daily", "Twice daily", "Every 8 hours"
    times: string[]; // Array of time strings e.g., ["08:00", "14:00", "20:00"]
    start_date: string; // ISO date string
    end_date?: string; // ISO date string, optional for ongoing medications
    duration_days?: number; // Alternative to end_date

    // Instructions
    instructions: MedicationInstruction;
    custom_instructions?: string; // For "other" or additional notes
    purpose?: string; // What is this medication for? e.g., "For viral fever"

    // Reminders
    reminder_enabled: boolean;
    reminder_minutes_before?: number; // e.g., 15 minutes before scheduled time

    // Status
    is_active: boolean;
    color: string;

    // Metadata
    created_at: string;
    updated_at: string;
}

/**
 * Medication Log - tracks when medications are taken
 */
export interface MedicationLog {
    id: string;
    medication_id: string;
    user_id: string;

    // Scheduled vs actual
    scheduled_date: string; // ISO date string (just date, no time)
    scheduled_time: string; // Time string e.g., "08:00"
    taken_at?: string; // ISO datetime string when actually taken

    // Status
    status: MedicationStatus;

    // Notes
    notes?: string; // e.g., "Felt nauseous after taking"

    // Metadata
    created_at: string;
    updated_at: string;
}

/**
 * Daily medication schedule view
 * Used for displaying medications grouped by time of day
 */
export interface DailyMedicationView {
    date: string; // ISO date string
    morning: MedicationWithStatus[];
    afternoon: MedicationWithStatus[];
    evening: MedicationWithStatus[];
    night: MedicationWithStatus[];
}

/**
 * Medication with current status for a specific date/time
 */
export interface MedicationWithStatus extends MedicationSchedule {
    scheduled_time: string;
    status: MedicationStatus;
    log_id?: string; // ID of the log entry if exists
    taken_at?: string;

    // AI extraction source tracking
    ai_extracted?: boolean; // Whether this medication was extracted by AI from a document
    source_document_id?: string; // ID of the source document (prescription)
    source_document_title?: string; // Title of the source document for display
}

// Helper function to get medicine type icon name
export const getMedicineTypeIcon = (type: MedicineType): string => {
    switch (type) {
        case 'pill':
        case 'capsule':
        case 'tablet':
            return 'circle';
        case 'syrup':
        case 'liquid':
            return 'droplet';
        case 'injection':
            return 'activity';
        case 'drops':
            return 'droplet';
        case 'inhaler':
            return 'wind';
        case 'cream':
            return 'package';
        default:
            return 'package';
    }
};

// Helper function to get medicine type color
export const getMedicineTypeColor = (type: MedicineType): string => {
    switch (type) {
        case 'pill':
        case 'capsule':
        case 'tablet':
            return '#3B82F6'; // Blue
        case 'syrup':
        case 'liquid':
            return '#8B5CF6'; // Purple
        case 'injection':
            return '#EF4444'; // Red
        case 'drops':
            return '#06B6D4'; // Cyan
        case 'inhaler':
            return '#10B981'; // Green
        case 'cream':
            return '#F59E0B'; // Orange
        default:
            return '#6B7280'; // Gray
    }
};

// Helper function to get instruction display text
export const getInstructionText = (instruction: MedicationInstruction): string => {
    switch (instruction) {
        case 'before_meal':
            return 'Before Meal';
        case 'after_meal':
            return 'After Meal';
        case 'with_food':
            return 'With Food';
        case 'empty_stomach':
            return 'Empty Stomach';
        case 'before_sleep':
            return 'Before Sleep';
        case 'with_water':
            return 'With Water';
        case 'as_needed':
            return 'As Needed';
        default:
            return 'Other';
    }
};

// Helper function to normalize time strings to HH:mm format
export const normalizeTime = (time: string): string => {
    if (!time) return '';
    const parts = time.split(':');
    if (parts.length < 2) return '';
    const hours = parts[0].padStart(2, '0');
    const minutes = parts[1].padStart(2, '0');
    return `${hours}:${minutes}`;
};

// Helper function to categorize time into time of day (4 categories)
export const getTimeOfDayCategory = (time: string): TimeOfDayCategory | null => {
    if (!time) return null;
    const parts = time.split(':');
    if (parts.length === 0) return null;
    const hour = parseInt(parts[0]);

    if (isNaN(hour)) return null;

    if (hour >= 4 && hour < 12) {
        return 'morning';
    } else if (hour >= 12 && hour < 16) {
        return 'afternoon';
    } else if (hour >= 16 && hour < 20) {
        return 'evening';
    } else {
        return 'night';
    }
};

// Helper function to get time of day display text
export const getTimeOfDayText = (category: TimeOfDayCategory): string => {
    switch (category) {
        case 'morning':
            return 'Morning Dose';
        case 'afternoon':
            return 'Afternoon Dose';
        case 'evening':
            return 'Evening Dose';
        case 'night':
            return 'Night Dose';
    }
};

// Helper function to get time of day icon
export const getTimeOfDayIcon = (category: TimeOfDayCategory): string => {
    switch (category) {
        case 'morning':
            return 'sunrise';
        case 'afternoon':
            return 'sun';
        case 'evening':
            return 'sunset';
        case 'night':
            return 'moon';
    }
};

/**
 * Generates reminder times based on a cyclical logic for frequencies > 3.
 * Always includes Morning (08:00), Afternoon (14:00), Night (21:00).
 * Extras are added by cycling through Morning->Afternoon->Night and adding offsets.
 * 
 * Logic ensures compatibility with ReminderTimesSection to prevent duplicate bars.
 */
export const generateCyclicReminderTimes = (totalTimesPerDay: number): string[] => {
    // Base times are Morning, Afternoon, Night (3 groups for verification screen)
    // We expect these to be passed from the database/preferences layer
    // Removed hardcoded fallbacks to ensure sync with user preferences
    const morning = '';
    const afternoon = '';
    const night = '';

    if (totalTimesPerDay <= 0) return [];

    // Base times tailored for standard intervals
    if (totalTimesPerDay === 1) return [morning];
    if (totalTimesPerDay === 2) return [morning, night];
    if (totalTimesPerDay === 3) return [morning, afternoon, night];

    // For > 3, start with base 3 times and add extras cyclically
    const baseTimes = [morning, afternoon, night];
    const result = [...baseTimes];
    const extrasNeeded = totalTimesPerDay - 3;

    for (let i = 0; i < extrasNeeded; i++) {
        const cycleIndex = i % 3; // 0, 1, 2 (Morning, Afternoon, Night)
        const offsetPass = Math.floor(i / 3) + 1; // 1, 1, 1, 2, 2, 2...

        const baseTime = baseTimes[cycleIndex];
        const [h, m] = baseTime.split(':').map(Number);

        let newHour = h + offsetPass;
        // Handle wrap around 24h
        if (newHour >= 24) newHour -= 24;

        const newTime = `${newHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        result.push(newTime);
    }

    return result.sort();
};
