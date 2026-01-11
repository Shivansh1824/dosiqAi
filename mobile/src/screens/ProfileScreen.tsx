import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes } from '../constants';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useDocumentsStore } from '../store/documentsStore';

export default function ProfileScreen() {
    const navigation = useNavigation();
    const { user, logout } = useAuthStore();
    const { clearAllLocalDocuments, clearAllCloudDocuments, clearAllAccountData } = useDocumentsStore();
    const [isClearing, setIsClearing] = useState(false);
    const [showClearOptions, setShowClearOptions] = useState(false);

    const menuItems = [
        { icon: 'user', label: 'Personal Information' },
        { icon: 'users', label: 'Family Members' },
        { icon: 'settings', label: 'Settings' },
        { icon: 'help-circle', label: 'Help & Support' },
        { icon: 'shield', label: 'Privacy & Security' },
        { icon: 'trash-2', label: 'Clear Documents', isDestructive: true },
    ];

    const handleLogout = () => {
        logout();
        navigation.reset({
            index: 0,
            routes: [{ name: 'Welcome' as never }],
        });
    };

    const handleMenuPress = (label: string) => {
        if (label === 'Clear Documents') {
            setShowClearOptions(true);
        } else {
            // Placeholder for other menu items
            console.log(`Pressed ${label}`);
        }
    };

    const handleClearLocalDocuments = () => {
        setShowClearOptions(false);
        setTimeout(() => {
            Alert.alert(
                'Clear Local Documents',
                'This will delete all locally stored documents and files from this device.\n\nNote: Database records remain unchanged and will need to be cleaned manually.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Clear Local',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                setIsClearing(true);
                                await clearAllLocalDocuments(user?.id);
                                Alert.alert('Success', 'All local documents have been cleared successfully.', [{ text: 'OK' }]);
                            } catch (error) {
                                Alert.alert('Error', 'Failed to clear local documents: ' + (error instanceof Error ? error.message : 'Unknown error'), [{ text: 'OK' }]);
                            } finally {
                                setIsClearing(false);
                            }
                        },
                    },
                ]
            );
        }, 300);
    };

    const handleClearCloudDocuments = () => {
        setShowClearOptions(false);
        setTimeout(() => {
            Alert.alert(
                'Clear Cloud Documents',
                'This will permanently delete all your Documents and Files from the server.\n\n(Medications, Vitals, and Appointments will be preserved)',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete Docs',
                        style: 'destructive',
                        onPress: async () => {
                            if (!user?.id) return;
                            try {
                                setIsClearing(true);
                                await clearAllCloudDocuments(user.id);
                                Alert.alert('Deleted', 'All cloud documents and files deleted.', [{ text: 'OK' }]);
                            } catch (error) {
                                Alert.alert('Error', 'Failed to clear cloud documents: ' + (error instanceof Error ? error.message : 'Unknown error'), [{ text: 'OK' }]);
                            } finally {
                                setIsClearing(false);
                            }
                        },
                    },
                ]
            );
        }, 300);
    };

    const handleClearAccountData = () => {
        setShowClearOptions(false);
        setTimeout(() => {
            Alert.alert(
                '⚠️ Clear Account Data',
                'WARNING: This will delete EVERYTHING:\n\n• Documents & Files\n• Medications\n• Vitals & Charts\n• Appointments\n\nOnly Family Profiles will be preserved. This cannot be undone.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete EVERYTHING',
                        style: 'destructive',
                        onPress: async () => {
                            if (!user?.id) return;
                            try {
                                setIsClearing(true);
                                await clearAllAccountData(user.id);
                                Alert.alert('Account Reset', 'All account data has been wiped successfully.', [{ text: 'OK' }]);
                            } catch (error) {
                                Alert.alert('Error', 'Failed to clear account data: ' + (error instanceof Error ? error.message : 'Unknown error'), [{ text: 'OK' }]);
                            } finally {
                                setIsClearing(false);
                            }
                        },
                    },
                ]
            );
        }, 300);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                <View style={styles.profileHeader}>
                    <View style={styles.avatarContainer}>
                        <Feather name="user" size={40} color={Colors.primary} />
                    </View>
                    <Text style={styles.userName}>{user?.name || 'User'}</Text>
                    <Text style={styles.userEmail}>{user?.email || 'email@example.com'}</Text>
                </View>

                <View style={styles.menuContainer}>
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.menuItem}
                            activeOpacity={0.7}
                            onPress={() => handleMenuPress(item.label)}
                        >
                            <View style={styles.menuIcon}>
                                <Feather
                                    name={item.icon as any}
                                    size={20}
                                    // Professional Red/Error color instead of Orange/Yellow
                                    color={item.isDestructive ? Colors.error : Colors.textSecondary}
                                />
                            </View>
                            <Text style={[styles.menuLabel, { color: Colors.textPrimary }]}>
                                {item.label}
                            </Text>
                            <Feather name="chevron-right" size={20} color={Colors.gray400} />
                        </TouchableOpacity>
                    ))}
                </View>

                {isClearing && (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Processing...</Text>
                    </View>
                )}

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
                    <Feather name="log-out" size={20} color={Colors.error} />
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Clear Documents Modal */}
            <Modal
                transparent={true}
                visible={showClearOptions}
                animationType="fade"
                onRequestClose={() => setShowClearOptions(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowClearOptions(false)}>
                    <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Clear Documents</Text>
                            <TouchableOpacity onPress={() => setShowClearOptions(false)}>
                                <Feather name="x" size={24} color={Colors.gray500} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>Choose which documents to clear:</Text>

                        <View style={styles.optionsContainer}>
                            {/* Option 1: Local Documents */}
                            <TouchableOpacity style={styles.optionButton} onPress={handleClearLocalDocuments}>
                                <View style={[styles.optionIconContainer, { backgroundColor: Colors.gray50 }]}>
                                    <Feather name="smartphone" size={24} color={Colors.textPrimary} />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>Clear Local Documents</Text>
                                    <Text style={styles.optionDescription}>Remove files from this device only</Text>
                                </View>
                                <Feather name="chevron-right" size={20} color={Colors.gray400} />
                            </TouchableOpacity>

                            {/* Option 2: Cloud Documents */}
                            <TouchableOpacity style={styles.optionButton} onPress={handleClearCloudDocuments}>
                                <View style={[styles.optionIconContainer, { backgroundColor: Colors.gray50 }]}>
                                    <Feather name="cloud-off" size={24} color={Colors.textPrimary} />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>Clear Cloud Documents</Text>
                                    <Text style={styles.optionDescription}>Delete files & reports only</Text>
                                </View>
                                <Feather name="chevron-right" size={20} color={Colors.gray400} />
                            </TouchableOpacity>

                            {/* Option 3: Account Data */}
                            <TouchableOpacity style={styles.optionButton} onPress={handleClearAccountData}>
                                <View style={[styles.optionIconContainer, { backgroundColor: Colors.gray50 }]}>
                                    <Feather name="database" size={24} color={Colors.textPrimary} />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>Clear Account Data</Text>
                                    <Text style={styles.optionDescription}>Delete Charts, Meds, Vitals & Docs</Text>
                                </View>
                                <Feather name="chevron-right" size={20} color={Colors.gray400} />
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
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
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: Sizes.xl,
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.primaryLight + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Sizes.md,
    },
    userName: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 4,
    },
    userEmail: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    menuContainer: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Sizes.sm,
        marginBottom: Sizes.xl,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Sizes.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray50,
    },
    menuIcon: {
        width: 32,
        alignItems: 'center',
        marginRight: Sizes.sm,
    },
    menuLabel: {
        flex: 1,
        fontSize: 16,
        color: Colors.textPrimary,
    },
    loadingContainer: {
        alignItems: 'center',
        marginBottom: Sizes.md,
    },
    loadingText: {
        color: Colors.textSecondary,
        fontSize: 14,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Sizes.md,
        backgroundColor: Colors.error + '10',
        borderRadius: 12,
        gap: Sizes.sm,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.error,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: Sizes.xl,
        paddingBottom: Sizes.xl + 20, // Extra padding for bottom safe area visual
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Sizes.md,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    modalSubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: Sizes.lg,
    },
    optionsContainer: {
        gap: Sizes.md,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Sizes.md,
        backgroundColor: Colors.bgSecondary,
        borderRadius: 16,
        gap: Sizes.md,
    },
    optionIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionTextContainer: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    optionDescription: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
});
