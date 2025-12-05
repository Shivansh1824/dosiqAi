import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes, Typography } from '../constants';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useDocumentsStore } from '../store/documentsStore';

export default function DocumentsScreen() {
    const navigation = useNavigation();
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

    // Format date for display
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Documents</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                }
            >
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.loadingText}>Loading documents...</Text>
                    </View>
                ) : documents.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Feather name="file-text" size={64} color={Colors.gray300} />
                        <Text style={styles.emptyText}>No documents yet</Text>
                        <Text style={styles.emptySubtext}>
                            Scan or upload your first health document to get started
                        </Text>
                    </View>
                ) : (
                    documents.map((doc) => (
                        <TouchableOpacity
                            key={doc.id}
                            style={styles.documentCard}
                            activeOpacity={0.7}
                            onPress={() => (navigation as any).navigate('Document', { document: doc })}
                        >
                            <View style={[styles.documentIconContainer, { backgroundColor: doc.color + '15' }]}>
                                <Feather name="file-text" size={24} color={doc.color} />
                            </View>
                            <View style={styles.documentInfo}>
                                <Text style={styles.documentTitle}>{doc.title}</Text>
                                <View style={styles.documentMeta}>
                                    <View style={styles.typeBadge}>
                                        <Text style={styles.typeBadgeText}>{doc.type}</Text>
                                    </View>
                                    <Text style={styles.documentDate}>{formatDate(doc.created_at)}</Text>
                                </View>
                            </View>
                            <Feather name="chevron-right" size={20} color={Colors.gray400} />
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bgSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Sizes.lg,
        paddingVertical: Sizes.md,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray100,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: Sizes.lg,
        gap: Sizes.md,
        flexGrow: 1,
    },
    documentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Sizes.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    documentIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Sizes.md,
    },
    documentInfo: {
        flex: 1,
    },
    documentTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: 6,
    },
    documentMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Sizes.sm,
    },
    typeBadge: {
        backgroundColor: Colors.gray100,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    typeBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.gray600,
    },
    documentDate: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    // Loading & Empty States
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Sizes.xxl * 2,
    },
    loadingText: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginTop: Sizes.md,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Sizes.xxl * 2,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginTop: Sizes.lg,
    },
    emptySubtext: {
        fontSize: 14,
        color: Colors.gray400,
        marginTop: Sizes.sm,
        textAlign: 'center',
        maxWidth: 280,
    },
});
