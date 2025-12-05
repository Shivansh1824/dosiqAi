/**
 * Health Vitals types for tracking vital signs and health metrics
 */

export type VitalType =
    | 'blood_pressure'
    | 'heart_rate'
    | 'blood_glucose'
    | 'weight'
    | 'temperature'
    | 'oxygen_saturation'
    | 'respiratory_rate';

export type BloodPressureCategory = 'normal' | 'elevated' | 'high' | 'very_high' | 'low';
export type HeartRateCategory = 'low' | 'normal' | 'elevated' | 'high';
export type GlucoseCategory = 'low' | 'normal' | 'pre_diabetic' | 'diabetic';
export type BMICategory = 'underweight' | 'normal' | 'overweight' | 'obese';

/**
 * Blood Pressure Reading
 */
export interface BloodPressureReading {
    systolic: number; // Top number (e.g., 120)
    diastolic: number; // Bottom number (e.g., 80)
    pulse?: number; // Optional pulse rate
    category: BloodPressureCategory;
}

/**
 * Health Vital Record
 */
export interface HealthVital {
    id: string;
    user_id: string;
    family_member_id?: string;

    // Vital type and value
    type: VitalType;
    value: number | BloodPressureReading; // Can be single number or BP object
    unit: string; // e.g., "bpm", "mg/dL", "kg", "°F", "%"

    // Context
    notes?: string;
    measured_at: string; // ISO datetime

    // Metadata
    created_at: string;
    updated_at: string;
}

/**
 * BMI Calculation
 */
export interface BMIData {
    weight: number; // in kg
    height: number; // in cm
    bmi: number;
    category: BMICategory;
}

/**
 * Health Summary - aggregated vital signs
 */
export interface HealthSummary {
    blood_pressure?: {
        latest: BloodPressureReading;
        average_systolic: number;
        average_diastolic: number;
        measured_at: string;
    };
    heart_rate?: {
        latest: number;
        average: number;
        resting: number;
        category: HeartRateCategory;
        measured_at: string;
    };
    blood_glucose?: {
        latest: number;
        average: number;
        fasting?: number;
        category: GlucoseCategory;
        measured_at: string;
    };
    bmi?: BMIData;
    weight?: {
        latest: number;
        trend: 'increasing' | 'decreasing' | 'stable';
        measured_at: string;
    };
    temperature?: {
        latest: number;
        measured_at: string;
    };
    oxygen_saturation?: {
        latest: number;
        measured_at: string;
    };
}

// Helper function to categorize blood pressure
export const categorizeBloodPressure = (systolic: number, diastolic: number): BloodPressureCategory => {
    if (systolic < 90 || diastolic < 60) {
        return 'low';
    } else if (systolic < 120 && diastolic < 80) {
        return 'normal';
    } else if (systolic < 130 && diastolic < 80) {
        return 'elevated';
    } else if (systolic < 140 || diastolic < 90) {
        return 'high';
    } else {
        return 'very_high';
    }
};

// Helper function to get BP category color
export const getBPCategoryColor = (category: BloodPressureCategory): string => {
    switch (category) {
        case 'normal':
            return '#10B981'; // Green
        case 'elevated':
            return '#F59E0B'; // Orange
        case 'high':
            return '#EF4444'; // Red
        case 'very_high':
            return '#DC2626'; // Dark Red
        case 'low':
            return '#3B82F6'; // Blue
    }
};

// Helper function to get BP category text
export const getBPCategoryText = (category: BloodPressureCategory): string => {
    switch (category) {
        case 'normal':
            return 'Normal';
        case 'elevated':
            return 'Elevated';
        case 'high':
            return 'High';
        case 'very_high':
            return 'Very High';
        case 'low':
            return 'Low';
    }
};

// Helper function to categorize heart rate
export const categorizeHeartRate = (bpm: number): HeartRateCategory => {
    if (bpm < 60) {
        return 'low';
    } else if (bpm <= 100) {
        return 'normal';
    } else if (bpm <= 120) {
        return 'elevated';
    } else {
        return 'high';
    }
};

// Helper function to categorize blood glucose (fasting)
export const categorizeGlucose = (mgDl: number, isFasting: boolean = true): GlucoseCategory => {
    if (!isFasting) {
        // Non-fasting thresholds are higher
        if (mgDl < 140) return 'normal';
        if (mgDl < 200) return 'pre_diabetic';
        return 'diabetic';
    }

    // Fasting glucose
    if (mgDl < 70) {
        return 'low';
    } else if (mgDl < 100) {
        return 'normal';
    } else if (mgDl < 126) {
        return 'pre_diabetic';
    } else {
        return 'diabetic';
    }
};

// Helper function to calculate BMI
export const calculateBMI = (weightKg: number, heightCm: number): BMIData => {
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);

    let category: BMICategory;
    if (bmi < 18.5) {
        category = 'underweight';
    } else if (bmi < 25) {
        category = 'normal';
    } else if (bmi < 30) {
        category = 'overweight';
    } else {
        category = 'obese';
    }

    return {
        weight: weightKg,
        height: heightCm,
        bmi: Math.round(bmi * 10) / 10,
        category,
    };
};

// Helper function to get BMI category color
export const getBMICategoryColor = (category: BMICategory): string => {
    switch (category) {
        case 'underweight':
            return '#3B82F6'; // Blue
        case 'normal':
            return '#10B981'; // Green
        case 'overweight':
            return '#F59E0B'; // Orange
        case 'obese':
            return '#EF4444'; // Red
    }
};
