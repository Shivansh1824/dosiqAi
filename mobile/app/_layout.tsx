import 'react-native-reanimated';
import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { 
    setupBackgroundEventHandler, 
    setupForegroundEventHandler, 
    setNavigationCallback 
} from '../src/services/notificationEventHandler';
import notifee from '@notifee/react-native';

setupBackgroundEventHandler();

import {
    useFonts,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { useAuthStore } from '../src/store/authStore';
import { useAppInitialization } from '../src/hooks/useAppInitialization';
import { Colors, Typography } from '../src/constants';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
        'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
        'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
        'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
        'PlusJakartaSans-ExtraBold': PlusJakartaSans_800ExtraBold,
    });

    const { isAppReady } = useAppInitialization();
    const { isAuthenticated, hasSeenOnboarding } = useAuthStore();
    const segments = useSegments();
    const router = useRouter();

    // Notification routing setup
    useEffect(() => {
        if (!isAppReady || !fontsLoaded) return;

        // 1. Set the callback so the background/foreground handlers can trigger navigation
        setNavigationCallback((screen, params) => {
            console.log(`[Navigation] Routing to ${screen} from notification`);
            router.push({ pathname: screen as any, params });
        });

        // 2. Listen for notifications while app is in foreground
        const unsubscribeForeground = setupForegroundEventHandler();

        // 3. Check if app was opened from a dead state via notification tap
        async function checkInitialNotification() {
            const initialNotification = await notifee.getInitialNotification();
            if (initialNotification) {
                console.log('[App] Opened from killed state via notification tap:', initialNotification.notification.id);
                const data = initialNotification.notification.data;
                const actionId = initialNotification.pressAction?.id || 'default';
                
                // If it's a default tap (not a 'taken'/'skip' button tap handled in background)
                if (data?.type === 'medication_reminder' && actionId === 'default') {
                     router.push({ 
                         pathname: '/medicinealarm', 
                         params: data as any 
                     });
                }
            }
        }
        checkInitialNotification();

        return () => {
             if (unsubscribeForeground) unsubscribeForeground();
        };
    }, [isAppReady, fontsLoaded, router]);

    // Authentication & Onboarding routing
    useEffect(() => {
        if (!isAppReady || !fontsLoaded) return;

        SplashScreen.hideAsync();

        const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup' || segments[0] === 'welcome';

        // Simplistic routing logic:
        if (!isAuthenticated && !inAuthGroup) {
            if (!hasSeenOnboarding) {
                router.replace('/welcome');
            } else {
                router.replace('/login');
            }
        } else if (isAuthenticated && (inAuthGroup || !segments[0])) {
            // Already handled by index auto-redirect if at root
            // But let's be explicit for login/signup/welcome
            if (inAuthGroup) {
                router.replace('/home');
            }
        }
    }, [isAuthenticated, isAppReady, fontsLoaded, segments, hasSeenOnboarding]);

    if (!isAppReady || !fontsLoaded) {
        return null;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ErrorBoundary>
                <SafeAreaProvider>
                    <View style={styles.container}>
                        <StatusBar style="dark" translucent backgroundColor="transparent" />
                        <View style={styles.appWrapper}>
                            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'white' } }}>
                                <Stack.Screen name="index" />
                                <Stack.Screen name="login" />
                                <Stack.Screen name="onboarding1" />
                                <Stack.Screen
                                    name="prescription-summary"
                                    options={{
                                        headerShown: true,
                                        headerTransparent: true,
                                        headerBlurEffect: 'systemUltraThinMaterial',
                                        headerBackButtonDisplayMode: 'minimal',
                                        headerTitleAlign: 'center',
                                    }}
                                />
                                <Stack.Screen
                                    name="lab-report/[id]"
                                    options={{
                                        headerShown: true,
                                        headerTransparent: true,
                                        headerTitleAlign: 'center',
                                    }}
                                />
                                {/* Other screens added here implicitly by file structure */}
                            </Stack>
                        </View>
                    </View>
                </SafeAreaProvider>
            </ErrorBoundary>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },
    appWrapper: {
        width: '100%',
        maxWidth: 428,
        flex: 1,
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 20,
        alignSelf: 'center',
    },
});
