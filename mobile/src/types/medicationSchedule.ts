import { Medication, FoodRelationship } from './medication';

export type MedicationStatus = 'taken' | 'skipped' | 'missed' | 'pending';

export interface MedicationWithStatus extends Medication {
  scheduled_time: string;
  status: MedicationStatus;
  taken_at?: string | null;
  reminder_enabled: boolean;
  instructions: string;
  times: string[];
  type: 'tablet' | 'capsule' | 'syrup' | 'injection' | 'inhaler' | 'drops' | 'cream' | 'other';
}

export type TimeOfDayCategory = 'morning' | 'afternoon' | 'evening' | 'night';

export const getTimeOfDayCategory = (timeStr: string): TimeOfDayCategory => {
  const [hour] = timeStr.split(':').map(Number);
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};

export const getTimeOfDayText = (category: TimeOfDayCategory): string => {
  switch (category) {
    case 'morning': return 'Morning';
    case 'afternoon': return 'Afternoon';
    case 'evening': return 'Evening';
    case 'night': return 'Night';
  }
};

export const getTimeOfDayIcon = (category: TimeOfDayCategory): string => {
  switch (category) {
    case 'morning': return 'sun';
    case 'afternoon': return 'cloud';
    case 'evening': return 'moon';
    case 'night': return 'star';
  }
};

export const mapFoodRelationshipToInstruction = (foodRelationship?: FoodRelationship): string => {
  if (!foodRelationship) return 'Can be taken anytime';
  switch (foodRelationship) {
    case 'empty_stomach': return 'Take on an empty stomach';
    case 'before_food': return 'Take 30 mins before food';
    case 'with_food': return 'Take with food';
    case 'after_food': return 'Take after food';
    case 'anytime': return 'Can be taken anytime';
    default: return 'Can be taken anytime';
  }
};

export const getInstructionText = (med: MedicationWithStatus): string => {
  return med.instructions || mapFoodRelationshipToInstruction(med.food_relationship);
};
