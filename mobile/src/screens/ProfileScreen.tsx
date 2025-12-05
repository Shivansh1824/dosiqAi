import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes, Typography } from '../constants';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';

export default function ProfileScreen() {
    const navigation = useNavigation();
    const { user, logout } = useAuthStore();

    const menuItems = [
        { icon: 'user', label: 'Personal Information' },
        { icon: 'users', label: 'Family Members' },
        { icon: 'settings', label: 'Settings' },
        { icon: 'help-circle', label: 'Help & Support' },
        { icon: 'shield', label: 'Privacy & Security' },
    ];

    const handleLogout = () => {
        logout();
        // Navigation will be handled by the auth listener or manual navigation if needed
        // But since we are in a stack, we might need to reset navigation
        // For now, the App.tsx logic might handle it if it listens to auth state
        // Or we can manually navigate to Welcome
        navigation.reset({
            index: 0,
            routes: [{ name: 'Welcome' as never }],
        });
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
                        <TouchableOpacity key={index} style={styles.menuItem} activeOpacity={0.7}>
                            <View style={styles.menuIcon}>
                                <Feather name={item.icon as any} size={20} color={Colors.textSecondary} />
                            </View>
                            <Text style={styles.menuLabel}>{item.label}</Text>
                            <Feather name="chevron-right" size={20} color={Colors.gray400} />
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
                    <Feather name="log-out" size={20} color={Colors.error} />
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>
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
});
