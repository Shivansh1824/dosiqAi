export interface FamilyMember {
    id: string;
    user_id: string;
    linked_user_id?: string;
    name: string;
    relationship?: string;
    gender?: string;
    date_of_birth?: string;
    morning_dose_time?: string;
    afternoon_dose_time?: string;
    night_dose_time?: string;
    snooze_duration?: number;
    reminder_style?: 'standard' | 'assurance';
    alert_display_mode?: 'temporary' | 'alert';
    created_at: string;
    updated_at: string;
}

export type FamilyMemberInsert = Omit<FamilyMember, 'id' | 'created_at' | 'updated_at'>;
export type FamilyMemberUpdate = Partial<Omit<FamilyMember, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export const RELATIONSHIPS = [
    'Self',
    'Spouse',
    'Child',
    'Parent',
    'Sibling',
    'Grandparent',
    'Grandchild',
    'Other'
] as const;

export const GENDERS = [
    'Male',
    'Female',
    'Other'
] as const;

export type Relationship = typeof RELATIONSHIPS[number];
export type Gender = typeof GENDERS[number];
