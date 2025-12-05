import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { FamilyMember, FamilyMemberInsert, FamilyMemberUpdate } from '../types/familyMember';
import { saveToCache, loadFromCache, CacheKeys } from '../services/cacheService';

interface FamilyMembersState {
    familyMembers: FamilyMember[];
    activeMember: FamilyMember | null;
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;
}

interface FamilyMembersActions {
    fetchFamilyMembers: (userId: string, silent?: boolean) => Promise<void>;
    loadFromCache: (userId: string) => Promise<boolean>;
    addFamilyMember: (data: FamilyMemberInsert) => Promise<void>;
    updateFamilyMember: (id: string, data: FamilyMemberUpdate) => Promise<void>;
    deleteFamilyMember: (id: string) => Promise<void>;
    setActiveMember: (member: FamilyMember | null) => void;
    clearFamilyMembers: () => void;
    ensurePrimaryMemberExists: (userId: string, userName: string) => Promise<FamilyMember | null>;
}

type FamilyMembersStore = FamilyMembersState & FamilyMembersActions;

export const useFamilyMembersStore = create<FamilyMembersStore>((set, get) => ({
    // State
    familyMembers: [],
    activeMember: null,
    isLoading: false,
    isInitialized: false,
    error: null,

    // Actions
    /**
     * Load family members from cache
     * @returns true if cache was found and loaded, false otherwise
     */
    loadFromCache: async (userId: string): Promise<boolean> => {
        if (!userId) return false;

        try {
            const cached = await loadFromCache<FamilyMember[]>(CacheKeys.familyMembers(userId));
            if (cached && cached.length > 0) {
                console.log('[FamilyMembersStore] Loaded', cached.length, 'family members from cache');
                set({ familyMembers: cached, isLoading: false, isInitialized: true });

                // Set first member as active if none selected
                if (!get().activeMember) {
                    set({ activeMember: cached[0] });
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('[FamilyMembersStore] Error loading from cache:', error);
            return false;
        }
    },

    fetchFamilyMembers: async (userId: string, silent = false) => {
        // Only show loading spinner if not a silent refresh
        if (!silent) {
            set({ isLoading: true, error: null });
        }

        try {
            const { data, error } = await supabase
                .from('family_members')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Save to cache for next time
            await saveToCache(CacheKeys.familyMembers(userId), data || []);

            console.log(`[FamilyMembersStore] Fetched ${data?.length || 0} family members (silent: ${silent})`);
            set({ familyMembers: data || [], isLoading: false, isInitialized: true });

            // Set first member as active if none selected
            if (!get().activeMember && data && data.length > 0) {
                set({ activeMember: data[0] });
            }
        } catch (error: any) {
            console.error('[FamilyMembersStore] Error fetching family members:', error);
            set({ error: error.message, isLoading: false });
        }
    },

    addFamilyMember: async (data: FamilyMemberInsert) => {
        set({ isLoading: true, error: null });

        try {
            const { data: newMember, error } = await supabase
                .from('family_members')
                .insert([data])
                .select()
                .single();

            if (error) throw error;

            console.log('[FamilyMembersStore] Added family member:', newMember.id);

            set((state) => ({
                familyMembers: [...state.familyMembers, newMember],
                isLoading: false,
            }));

            // Set as active if it's the first member
            if (get().familyMembers.length === 1) {
                set({ activeMember: newMember });
            }
        } catch (error: any) {
            console.error('[FamilyMembersStore] Error adding family member:', error);
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    updateFamilyMember: async (id: string, data: FamilyMemberUpdate) => {
        set({ isLoading: true, error: null });

        try {
            const { data: updatedMember, error } = await supabase
                .from('family_members')
                .update(data)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            console.log('[FamilyMembersStore] Updated family member:', id);

            set((state) => ({
                familyMembers: state.familyMembers.map((m) =>
                    m.id === id ? updatedMember : m
                ),
                activeMember: state.activeMember?.id === id ? updatedMember : state.activeMember,
                isLoading: false,
            }));
        } catch (error: any) {
            console.error('[FamilyMembersStore] Error updating family member:', error);
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    deleteFamilyMember: async (id: string) => {
        set({ isLoading: true, error: null });

        try {
            const { error } = await supabase
                .from('family_members')
                .delete()
                .eq('id', id);

            if (error) throw error;

            console.log('[FamilyMembersStore] Deleted family member:', id);

            set((state) => {
                const newMembers = state.familyMembers.filter((m) => m.id !== id);
                return {
                    familyMembers: newMembers,
                    activeMember: state.activeMember?.id === id
                        ? (newMembers[0] || null)
                        : state.activeMember,
                    isLoading: false,
                };
            });
        } catch (error: any) {
            console.error('[FamilyMembersStore] Error deleting family member:', error);
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    setActiveMember: (member: FamilyMember | null) => {
        console.log('[FamilyMembersStore] Set active member:', member?.name || 'None');
        set({ activeMember: member });
    },

    clearFamilyMembers: () => {
        set({ familyMembers: [], activeMember: null, error: null });
    },

    /**
     * Ensures a primary "Self" family member exists for the user
     * Creates one if it doesn't exist, and sets it as active
     * @returns The primary family member, or null if no valid session
     */
    ensurePrimaryMemberExists: async (userId: string, userName: string): Promise<FamilyMember | null> => {
        try {
            const currentMembers = get().familyMembers;

            // Check if a "Self" profile already exists
            let selfMember = currentMembers.find(m => m.relationship === 'Self');

            if (selfMember) {
                console.log('[FamilyMembersStore] Primary member already exists:', selfMember.id);
                // Validate that it's not a placeholder (has valid UUID)
                if (selfMember.id.startsWith('local-')) {
                    console.warn('[FamilyMembersStore] Found placeholder member, will not use for database operations');
                    // Don't set as active if it's a placeholder
                    set({ isInitialized: true });
                    return null;
                }
                // Set as active and mark as initialized
                if (!get().activeMember) {
                    set({ activeMember: selfMember, isInitialized: true });
                } else {
                    set({ isInitialized: true });
                }
                return selfMember;
            }

            // IMPORTANT: Only create database record if Supabase is configured and session is active
            // Without an active Supabase session, RLS policies will block the INSERT
            if (!isSupabaseConfigured()) {
                console.warn('[FamilyMembersStore] Supabase not configured, cannot create family member');
                set({ isInitialized: true });
                return null;
            }

            // Verify Supabase session is active before attempting database INSERT
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                console.warn('[FamilyMembersStore] No active Supabase session, cannot create family member');
                set({ isInitialized: true });
                return null;
            }

            // Create primary "Self" profile in database (session is active)
            console.log('[FamilyMembersStore] Creating primary member for user:', userId);
            const { data: newMember, error } = await supabase
                .from('family_members')
                .insert([{
                    user_id: userId,
                    name: userName || 'Me',
                    relationship: 'Self',
                }])
                .select()
                .single();

            if (error) throw error;

            console.log('[FamilyMembersStore] Primary member created:', newMember.id);

            // Add to state and set as active
            set((state) => ({
                familyMembers: [...state.familyMembers, newMember],
                activeMember: newMember,
                isInitialized: true,
            }));

            return newMember;
        } catch (error: any) {
            console.error('[FamilyMembersStore] Error ensuring primary member exists:', error);
            set({ isInitialized: true });
            return null;
        }
    },
}));
