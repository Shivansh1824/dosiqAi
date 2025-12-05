/**
 * Dynamic Health Metrics types
 * Completely data-driven - no hardcoded metrics
 */

export type MetricType = 'vital' | 'finding';
export type MetricStatus = 'normal' | 'warning' | 'critical';
export type TrendDirection = 'up' | 'down' | 'stable';

/**
 * Health Metric - Universal interface for all health data
 */
export interface HealthMetric {
    id: string;
    type: MetricType;           // Determines card style (vital or finding)
    label: string;              // e.g., "Kidney Stone Size", "Heart Rate", "Vitamin D"
    value: string | number;     // e.g., "4mm", "72", "25"
    unit?: string;              // e.g., "mm", "bpm", "ng/mL"
    status: MetricStatus;       // normal, warning, critical
    iconName: string;           // MaterialCommunityIcons name e.g., "heart-pulse", "water", "pill"
    trend?: TrendDirection;     // up, down, stable (optional)
    detail?: string;            // Additional context for findings
    date?: string;              // For findings - when it was recorded
    actionLabel?: string;       // For findings - action button text
}

/**
 * Alert for health warnings
 */
export interface HealthAlert {
    id: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
}

// Helper to get status color
export const getStatusColor = (status: MetricStatus): string => {
    switch (status) {
        case 'normal':
            return '#10B981'; // Green
        case 'warning':
            return '#F59E0B'; // Yellow
        case 'critical':
            return '#EF4444'; // Red
    }
};

// Helper to get status text
export const getStatusText = (status: MetricStatus): string => {
    switch (status) {
        case 'normal':
            return 'Normal';
        case 'warning':
            return 'Warning';
        case 'critical':
            return 'Critical';
    }
};
