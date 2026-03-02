import { create } from 'zustand';
import { from, auth } from '../lib/apiClient';
import { FamilyMember, FamilyMemberInsert, FamilyMemberUpdate } from '../types/familyMember';
import { saveToCache, loadFromCache, CacheKeys } from '../services/cacheService';
import { sanitizeErrorMessage, withRetry } from '../utils/apiUtils';

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
            const data = await withRetry(async () => {
                const { data: result, error } = await from('family_members')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: true });

                if (error) throw error;
                return result;
            }, 2, 1000, 'fetchFamilyMembers');

            // Save to cache for next time
            await saveToCache(CacheKeys.familyMembers(userId), data || []);

            console.log(`[FamilyMembersStore] Fetched ${data?.length || 0} family members (silent: ${silent})`);
            set({ familyMembers: data || [], isLoading: false, isInitialized: true });

            // Set first member as active if none selected
            if (!get().activeMember && data && data.length > 0) {
                set({ activeMember: data[0] });
            }
        } catch (error: any) {
            // Note: withRetry already handles infrastructure error logging cleanly
            set({ error: error.message, isLoading: false });
        }
    },

    addFamilyMember: async (data: FamilyMemberInsert) => {
        set({ isLoading: true, error: null });

        try {
            const newMember = await withRetry(async () => {
                const { data: result, error } = await from('family_members')
                    .insert([data])
                    .select()
                    .single();

                if (error) throw error;
                return result;
            }, 2, 1000, 'addFamilyMember');

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
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    updateFamilyMember: async (id: string, data: FamilyMemberUpdate) => {
        set({ isLoading: true, error: null });

        try {
            const updatedMember = await withRetry(async () => {
                const { data: result, error } = await from('family_members')
                    .update(data)
                    .eq('id', id)
                    .select()
                    .single();

                if (error) throw error;
                return result;
            }, 2, 1000, 'updateFamilyMember');

            console.log('[FamilyMembersStore] Updated family member:', id);

            set((state) => ({
                familyMembers: state.familyMembers.map((m) =>
                    m.id === id ? updatedMember : m
                ),
                activeMember: state.activeMember?.id === id ? updatedMember : state.activeMember,
                isLoading: false,
            }));
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    deleteFamilyMember: async (id: string) => {
        set({ isLoading: true, error: null });

        try {
            const { error } = await from('family_members')
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
            set({ error: sanitizeErrorMessage(error.message), isLoading: false });
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
     * 
     * DEFENSIVE: Handles race conditions by querying database first and gracefully
     * handling duplicate key errors (23505) if another call creates the member simultaneously
     */
    ensurePrimaryMemberExists: async (userId: string, userName: string): Promise<FamilyMember | null> => {
        // PREVENT redundant parallel calls from multiple UI entry points
        if (get().isInitialized && get().activeMember) {
            return get().activeMember;
        }

        try {
            // Verify API session is active before attempting database operations
            const { data: { session }, error: sessionError } = await auth.getSession();
            if (sessionError || !session) {
                console.warn('[FamilyMembersStore] No active API session, cannot create family member');
                set({ isInitialized: true });
                return null;
            }

            // DEFENSIVE FIX: Query database FIRST (single source of truth)
            // This prevents race conditions where multiple calls check in-memory state
            // before any of them complete the insert
            const { data: existingMembers, error: queryError } = await from('family_members')
                .select('*')
                .eq('user_id', userId)
                .eq('relationship', 'Self')
                .limit(1);

            if (queryError) {
                console.error('[FamilyMembersStore] Error querying for Self member:', queryError);
                set({ isInitialized: true });
                return null;
            }

            // If Self member exists in database, use it
            if (existingMembers && existingMembers.length > 0) {
                const selfMember = existingMembers[0];
                console.log('[FamilyMembersStore] Primary member already exists:', selfMember.id);

                // Validate that it's not a placeholder (has valid UUID)
                if (selfMember.id.startsWith('local-')) {
                    console.warn('[FamilyMembersStore] Found placeholder member, will not use for database operations');
                    set({ isInitialized: true });
                    return null;
                }

                // Update in-memory state if not already there
                const currentMembers = get().familyMembers;
                if (!currentMembers.find(m => m.id === selfMember.id)) {
                    set(state => ({
                        familyMembers: [...state.familyMembers, selfMember],
                    }));
                }

                // Set as active and mark as initialized
                if (!get().activeMember) {
                    set({ activeMember: selfMember, isInitialized: true });
                } else {
                    set({ isInitialized: true });
                }

                return selfMember;
            }

            // No Self member exists - try to create one
            console.log('[FamilyMembersStore] Creating primary member for user:', userId);

            const { data: newMember, error } = await from('family_members')
                .insert([{
                    user_id: userId,
                    name: userName || 'Me',
                    relationship: 'Self',
                }])
                .select()
                .single();

            // DEFENSIVE FIX: Handle duplicate key error gracefully
            // Error code 23505 = unique_violation (duplicate key)
            // This can happen if another simultaneous call already created the Self member
            if (error) {
                if (error.code === '23505') {
                    // Another call/thread created it between our query and insert
                    console.log('[FamilyMembersStore] Duplicate detected (race condition), fetching existing member');

                    // Fetch the member that was created by the other call
                    const { data: fetchedMembers } = await from('family_members')
                        .select('*')
                        .eq('user_id', userId)
                        .eq('relationship', 'Self')
                        .limit(1);

                    if (fetchedMembers && fetchedMembers.length > 0) {
                        const selfMember = fetchedMembers[0];
                        console.log('[FamilyMembersStore] Successfully recovered from race condition:', selfMember.id);

                        // Update state with the existing member
                        set(state => ({
                            familyMembers: [...state.familyMembers.filter(m => m.id !== selfMember.id), selfMember],
                            activeMember: selfMember,
                            isInitialized: true,
                        }));

                        return selfMember;
                    }
                }

                // Other database error - throw it
                throw error;
            }

            // Success - new member created
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
