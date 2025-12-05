import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';
import { HealthMetric } from '../types/healthMetrics';
import { saveToCache, loadFromCache } from '../services/cacheService';

interface HealthVitalsState {
    vitals: HealthMetric[];
    isLoading: boolean;
    error: string | null;
}

interface HealthVitalsActions {
    fetchVitals: (userId: string, silent?: boolean) => Promise<void>;
    loadFromCache: (userId: string) => Promise<void>;
    addVital: (vital: Omit<HealthMetric, 'id'>, userId: string) => Promise<void>;
    updateVital: (id: string, updates: Partial<HealthMetric>) => Promise<void>;
    deleteVital: (id: string) => Promise<void>;
    addVitalsFromAI: (userId: string, extractedVitals: Omit<HealthMetric, 'id'>[]) => Promise<void>;
}

type HealthVitalsStore = HealthVitalsState & HealthVitalsActions;

export const useHealthVitalsStore = create<HealthVitalsStore>((set, get) => ({
    vitals: [],
    isLoading: false,
    error: null,

    // Load vitals from cache
    loadFromCache: async (userId: string) => {
        try {
            const cached = await loadFromCache(`vitals:${userId}`);
            if (cached && Array.isArray(cached)) {
                set({ vitals: cached });
            }
        } catch (error) {
            console.error('Error loading vitals from cache:', error);
        }
    },

    // Fetch vitals from database
    fetchVitals: async (userId: string, silent = false) => {
        if (!silent) {
            set({ isLoading: true, error: null });
        }

        try {
            const { data, error } = await supabase
                .from('health_vitals')
                .select('*')
                .eq('user_id', userId)
                .order('measured_at', { ascending: false });

            if (error) throw error;

            // Transform database records to HealthMetric format
            const vitals: HealthMetric[] = (data || []).map((record: any) => ({
                id: record.id,
                type: record.type || 'vital',
                label: record.label,
                value: record.value,
                unit: record.unit,
                status: record.status,
                iconName: record.icon_name,
                trend: record.trend,
                detail: record.detail,
                date: record.measured_at,
            }));

            set({ vitals, isLoading: false });

            // Save to cache
            await saveToCache(`vitals:${userId}`, vitals);
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
            console.error('Error fetching vitals:', error);
        }
    },

    // Add a new vital
    addVital: async (vital: Omit<HealthMetric, 'id'>, userId: string) => {
        set({ isLoading: true, error: null });

        try {
            const { data, error } = await supabase
                .from('health_vitals')
                .insert([
                    {
                        user_id: userId, // This should be passed from the component
                        type: vital.type,
                        label: vital.label,
                        value: vital.value,
                        unit: vital.unit,
                        status: vital.status,
                        icon_name: vital.iconName,
                        trend: vital.trend,
                        detail: vital.detail,
                        measured_at: vital.date || new Date().toISOString(),
                    },
                ])
                .select()
                .single();

            if (error) throw error;

            // Add to local state
            const newVital: HealthMetric = {
                id: data.id,
                type: data.type,
                label: data.label,
                value: data.value,
                unit: data.unit,
                status: data.status,
                iconName: data.icon_name,
                trend: data.trend,
                detail: data.detail,
                date: data.measured_at,
            };

            set((state) => ({
                vitals: [newVital, ...state.vitals],
                isLoading: false,
            }));
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
            console.error('Error adding vital:', error);
        }
    },

    // Update a vital
    updateVital: async (id: string, updates: Partial<HealthMetric>) => {
        set({ isLoading: true, error: null });

        try {
            const { error } = await supabase
                .from('health_vitals')
                .update({
                    label: updates.label,
                    value: updates.value,
                    unit: updates.unit,
                    status: updates.status,
                    icon_name: updates.iconName,
                    trend: updates.trend,
                    detail: updates.detail,
                })
                .eq('id', id);

            if (error) throw error;

            // Update local state
            set((state) => ({
                vitals: state.vitals.map((v) =>
                    v.id === id ? { ...v, ...updates } : v
                ),
                isLoading: false,
            }));
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
            console.error('Error updating vital:', error);
        }
    },

    // Delete a vital
    deleteVital: async (id: string) => {
        set({ isLoading: true, error: null });

        try {
            const { error } = await supabase
                .from('health_vitals')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Remove from local state
            set((state) => ({
                vitals: state.vitals.filter((v) => v.id !== id),
                isLoading: false,
            }));
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
            console.error('Error deleting vital:', error);
        }
    },

    // Add multiple vitals from AI extraction
    // This is called when AI analyzes a medical report
    addVitalsFromAI: async (userId: string, extractedVitals: Omit<HealthMetric, 'id'>[]) => {
        set({ isLoading: true, error: null });

        try {
            // Prepare records for database
            const records = extractedVitals.map((vital) => ({
                user_id: userId,
                type: vital.type,
                label: vital.label,
                value: vital.value,
                unit: vital.unit,
                status: vital.status,
                icon_name: vital.iconName,
                trend: vital.trend,
                detail: vital.detail,
                measured_at: vital.date || new Date().toISOString(),
            }));

            const { data, error } = await supabase
                .from('health_vitals')
                .insert(records)
                .select();

            if (error) throw error;

            // Transform and add to local state
            const newVitals: HealthMetric[] = (data || []).map((record: any) => ({
                id: record.id,
                type: record.type,
                label: record.label,
                value: record.value,
                unit: record.unit,
                status: record.status,
                iconName: record.icon_name,
                trend: record.trend,
                detail: record.detail,
                date: record.measured_at,
            }));

            set((state) => ({
                vitals: [...newVitals, ...state.vitals],
                isLoading: false,
            }));

            console.log(`✅ Added ${newVitals.length} vitals from AI extraction`);
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
            console.error('Error adding vitals from AI:', error);
        }
    },
}));
