/**
 * Appointment types for scheduling doctor visits and health checkups
 */

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';

export type AppointmentType =
  | 'checkup'
  | 'follow_up'
  | 'consultation'
  | 'lab_test'
  | 'imaging'
  | 'vaccination'
  | 'therapy'
  | 'other';

export interface Appointment {
  id: string;
  user_id: string;
  title: string;
  doctor_name?: string;
  location?: string;
  appointment_type: AppointmentType;
  date: string; // ISO date string
  time: string; // HH:mm format
  duration_minutes: number;
  notes?: string;
  status: AppointmentStatus;
  reminder_enabled: boolean;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentsState {
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
}

export interface AppointmentsActions {
  loadFromCache: (userId: string) => Promise<boolean>;
  fetchAppointments: (userId: string, silent?: boolean) => Promise<void>;
  addAppointment: (apt: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  clearAppointments: () => void;
}

export type AppointmentsStore = AppointmentsState & AppointmentsActions;

// Helper to get appointment type display text
export const getAppointmentTypeText = (type: AppointmentType): string => {
  switch (type) {
    case 'checkup':
      return 'Checkup';
    case 'follow_up':
      return 'Follow-up';
    case 'consultation':
      return 'Consultation';
    case 'lab_test':
      return 'Lab Test';
    case 'imaging':
      return 'Imaging';
    case 'vaccination':
      return 'Vaccination';
    case 'therapy':
      return 'Therapy';
    default:
      return 'Other';
  }
};

// Helper to get color based on appointment type
export const getAppointmentColor = (type: AppointmentType): string => {
  switch (type) {
    case 'checkup':
      return '#3B82F6'; // Blue
    case 'follow_up':
      return '#10B981'; // Green
    case 'consultation':
      return '#8B5CF6'; // Purple
    case 'lab_test':
      return '#EF4444'; // Red
    case 'imaging':
      return '#06B6D4'; // Cyan
    case 'vaccination':
      return '#F59E0B'; // Orange
    case 'therapy':
      return '#EC4899'; // Pink
    default:
      return '#6B7280'; // Gray
  }
};

// Helper to format appointment date/time for display
export const formatAppointmentDateTime = (date: string, time: string): string => {
  const appointmentDate = new Date(date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateStr = appointmentDate.toDateString();

  if (dateStr === today.toDateString()) {
    return `Today ${time}`;
  } else if (dateStr === tomorrow.toDateString()) {
    return `Tomorrow ${time}`;
  } else {
    return `${appointmentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
  }
};
