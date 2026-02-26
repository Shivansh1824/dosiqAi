import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDocumentsStore } from '../store/documentsStore';
import { useFocusEffect } from '@react-navigation/native';

export function useDocumentList() {
    const { user } = useAuthStore();
    const { documents, isLoading, fetchDocuments } = useDocumentsStore();
    const [refreshing, setRefreshing] = useState(false);

    // Fetch documents with cache-first approach
    const loadData = useCallback(async () => {
        if (user?.id) {
            // Step 1: Load from cache instantly (no loading spinner)
            await useDocumentsStore.getState().loadFromCache(user.id);

            // Step 2: Refresh from Supabase silently in background
            await fetchDocuments(user.id, true); // silent=true
        }
    }, [user?.id, fetchDocuments]);

    // Initial load
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Refresh on focus
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    // Pull to refresh handler
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, [loadData]);

    return {
        documents,
        isLoading,
        refreshing,
        onRefresh,
        loadData
    };
}
