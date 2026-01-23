console.log('[DEBUG] [App.tsx] Starting App.tsx module load');

import { GestureHandlerRootView } from 'react-native-gesture-handler';
console.log('[DEBUG] [App.tsx] react-native-gesture-handler imported');

import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import notifee, { EventType } from '@notifee/react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

console.log('[DEBUG] [App.tsx] React and RN components imported');
console.log('[DEBUG] [App.tsx] About to import supabaseClient...');

import { supabase } from './src/services/supabaseClient';

console.log('[DEBUG] [App.tsx] supabaseClient imported successfully');

// Notification services
import { initializeNotifications } from './src/services/notificationService';
import { setupForegroundEventHandler } from './src/services/notificationEventHandler';

import { logError } from './src/utils/debugLogger';

// Global error handler
if ((global as any).ErrorUtils) {
  const defaultErrorHandler = (global as any).ErrorUtils.getGlobalHandler();
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    console.error('[App] Caught global error:', error);
    logError('Global Unhandled Error', { error: String(error), isFatal });
    if (defaultErrorHandler) {
      defaultErrorHandler(error, isFatal);
    }
  });
}

// Screens
import WelcomeScreen from './src/screens/WelcomeScreen';
import Onboarding1Screen from './src/screens/Onboarding1Screen';
import Onboarding2Screen from './src/screens/Onboarding2Screen';
import Onboarding3Screen from './src/screens/Onboarding3Screen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import ScanDocumentScreen from './src/screens/ScanDocumentScreen';
import PrescriptionSummaryScreen from './src/screens/PrescriptionSummaryScreen';
import DocumentsScreen from './src/screens/DocumentsScreen';
import MedicationsScreen from './src/screens/MedicationsScreen';
import MedicationHomeScreen from './src/screens/MedicationHomeScreen';
import HealthScreen from './src/screens/HealthScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ProfileSwitcherModal from './src/components/ProfileSwitcherModal';
import PdfViewerScreen from './src/screens/PdfViewerScreen';
import LabReportDetailScreen from './src/screens/LabReportDetailScreen';
import LabMetricTrendScreen from './src/screens/LabMetricTrendScreen';
import MedicineAlarmScreen from './src/screens/MedicineAlarmScreen';
// Store & Hooks
import { useAuthStore } from './src/store/authStore';
import { useAppInitialization } from './src/hooks/useAppInitialization';
import { Document } from './src/types/document';

// Constants
import { Colors } from './src/constants/Colors';
import { Typography } from './src/constants/Typography';

// Types
export type RootStackParamList = {
  Welcome: undefined;
  Onboarding1: undefined;
  Onboarding2: undefined;
  Onboarding3: undefined;
  Login: undefined;
  Signup: undefined;
  Home: undefined;
  Scan: undefined;
  PrescriptionSummary: { document: Document };
  Documents: undefined;
  Medications: undefined;
  MedicationList: undefined;
  Health: undefined;
  Profile: undefined;
  PdfViewer: { uri: string; title: string };
  LabReportDetail: { labReportId: string };
  LabMetricTrend: { testResultId: string; familyMemberId: string; testCode: string; testName: string };
  MedicineAlarm: { medicationId?: string; medicationName?: string; dosage?: string; scheduleId?: string; instructions?: string; } | undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const prefix = Linking.createURL('/');

export default function App() {
  console.log('[DEBUG] [App] App component function called');

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  
  console.log('[DEBUG] [App] State initialized - showProfileModal:', showProfileModal, 'isNavigationReady:', isNavigationReady);

  const [fontsLoaded] = useFonts({
    'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
    'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
    'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
    'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
    'PlusJakartaSans-ExtraBold': PlusJakartaSans_800ExtraBold,
  });

  const { isAppReady } = useAppInitialization();
  console.log('[DEBUG] [App] useAppInitialization hook called, isAppReady:', isAppReady);

  const { isAuthenticated, hasSeenOnboarding } = useAuthStore();
  console.log('[DEBUG] [App] Auth state:', { isAuthenticated, hasSeenOnboarding });

  // Fallback: Force navigation ready after timeout if onReady doesn't fire
  useEffect(() => {
    if (isAppReady && !isNavigationReady) {
      console.log('[DEBUG] [App] Setting up navigation ready timeout fallback');
      const timer = setTimeout(() => {
        console.log('[DEBUG] [App] Navigation ready timeout fired, forcing ready state');
        setIsNavigationReady(true);
      }, 1000); // 1 second fallback timeout

      return () => clearTimeout(timer);
    }
  }, [isAppReady, isNavigationReady]);

  // Handle deep links for OAuth
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      console.log('[App] Deep link received:', event.url);
      // Force session refresh when returning from OAuth
      supabase.auth.getSession().then(({ data, error }) => {
        if (data.session) {
          console.log('[App] Session refreshed from deep link');
          useAuthStore.getState().setAuthenticated(true);
          useAuthStore.getState().setUser({
            id: data.session.user.id,
            email: data.session.user.email || '',
            name: data.session.user.user_metadata?.name || data.session.user.email?.split('@')[0] || 'User',
            createdAt: data.session.user.created_at,
          });
        }
        if (error) console.error('[App] Deep link session error:', error);
      });
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  const linking = {
    prefixes: [prefix, 'familyhealth://'],
    // Custom getInitialURL to handle Notifee initial notification
    getInitialURL: async () => {
      // Check if opened via deep link
      const url = await Linking.getInitialURL();
      if (url) return url;

      // Check if opened via notification
      const initialNotification = await notifee.getInitialNotification();
      if (initialNotification?.pressAction?.id === 'default') {
        console.log('[App] App opened via notification (Deep Linking)');
        return Linking.createURL('medicine-alarm');
      }

      return null;
    },

    // Subscribe to Notifee foreground events for deep linking
    subscribe: (listener: (url: string) => void) => {
      // Listen for deep links
      const onUrl = ({ url }: { url: string }) => listener(url);
      const linkingSub = Linking.addEventListener('url', onUrl);

      // Listen for Notifee foreground events
      const notifeeSub = notifee.onForegroundEvent(({ type, detail }) => {
        if (type === EventType.PRESS && detail.pressAction?.id === 'default') {
          console.log('[App] Notification clicked (Foreground Deep Link)');
          listener(Linking.createURL('medicine-alarm'));
        }
      });

      return () => {
        linkingSub.remove();
        notifeeSub();
      };
    },
    
    config: {
      screens: {
        Login: 'auth/callback',
        Welcome: 'welcome',
        Home: 'home',
        MedicineAlarm: 'medicine-alarm',
      },
    },
  };

  // Hide splash screen when app is ready and navigation is settled
  useEffect(() => {
    if (isAppReady && isNavigationReady) {
      console.log('[DEBUG] [App] App and Navigation ready, hiding splash screen');
      SplashScreen.hideAsync();
    }
  }, [isAppReady, isNavigationReady]);

  // Initialize notifications
  useEffect(() => {
    console.log('[DEBUG] [App] Initializing notification service');
    initializeNotifications().then((success) => {
      console.log('[DEBUG] [App] Notification initialization:', success ? 'success' : 'failed');
    });
    
    // Set up foreground event handler (for logging and side effects)
    const unsubscribe = setupForegroundEventHandler();
    console.log('[DEBUG] [App] Foreground notification handler set up');
    
    // Register navigation callback for notification service
    const { setNavigationCallback } = require('./src/services/notificationEventHandler');
    setNavigationCallback((screen: string, params: any) => {
      console.log('='.repeat(60));
      console.log('[App] 🚨 Navigation callback received');
      console.log('[App] Screen:', screen);
      console.log('[App] Params:', JSON.stringify(params));
      console.log('[App] Navigation ready?:', navigationRef.isReady());
      console.log('[App] Current state:', JSON.stringify(navigationRef.getCurrentRoute()));
      console.log('='.repeat(60));
      
      if (navigationRef.isReady()) {
        console.log('[App] Attempting navigation to', screen);
        try {
          // @ts-ignore - Dynamic navigation
          navigationRef.navigate(screen, params);
          console.log('[App] Navigation.navigate() called successfully');
        } catch (error) {
          console.error('[App] Navigation error:', error);
        }
      } else {
        console.log('[App] Navigation not ready, retrying in 500ms');
        setTimeout(() => {
          if (navigationRef.isReady()) {
            console.log('[App] Retry: attempting navigation to', screen);
            try {
              // @ts-ignore
              navigationRef.navigate(screen, params);
              console.log('[App] Retry: Navigation.navigate() called successfully');
            } catch (error) {
              console.error('[App] Retry: Navigation error:', error);
            }
          } else {
            console.log('[App] Retry: Navigation still not ready!');
          }
        }, 500);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (!isAppReady || !fontsLoaded) {
    return null; // Keep native splash screen visible
  }

  console.log('[DEBUG] [App] App ready, rendering main navigation');

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <NavigationContainer
            ref={navigationRef}
            linking={linking}
            onReady={() => {
              console.log('[DEBUG] [App] NavigationContainer onReady callback fired');
              setIsNavigationReady(true);
            }}
            onStateChange={(state) => {
              console.log('[DEBUG] [App] Navigation state changed:', state?.index);
            }}
          >
            {!isNavigationReady ? (
              <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Initializing...</Text>
              </View>
            ) : (
              <View style={styles.container}>
                <StatusBar style="dark" />
                <View style={styles.appWrapper}>
                  <Stack.Navigator
                    initialRouteName="Welcome"
                    screenOptions={{
                      headerShown: false,
                      cardStyle: { backgroundColor: 'white' },
                    }}
                  >
                    {/* Welcome Screen - shown to all users initially */}
                    <Stack.Screen name="Welcome" component={WelcomeScreen} />

                    {/* Onboarding Screens - only for first-time users */}
                    <Stack.Screen name="Onboarding1" component={Onboarding1Screen} />
                    <Stack.Screen name="Onboarding2" component={Onboarding2Screen} />
                    <Stack.Screen name="Onboarding3" component={Onboarding3Screen} />

                    {/* Login Screen */}
                    <Stack.Screen name="Login" component={LoginScreen} />

                    {/* Signup Screen */}
                    <Stack.Screen name="Signup" component={SignupScreen} />

                    {/* Authenticated Screens */}
                    <Stack.Screen name="Home">
                      {({ navigation }) => (
                        <HomeScreen
                          onNavigate={(screen, params) => {
                            if (screen === 'scan') navigation.navigate('Scan');
                            else if (screen === 'document') navigation.navigate('PrescriptionSummary', params);
                            else if (screen === 'documents') navigation.navigate('Documents');
                            else if (screen === 'medications') navigation.navigate('Medications');
                            else if (screen === 'medicationList') navigation.navigate('MedicationList');
                            else if (screen === 'health') navigation.navigate('Health');
                            else if (screen === 'profile') navigation.navigate('Profile');
                            else if (screen === 'medicineAlarm') navigation.navigate('MedicineAlarm');
                          }}
                          onProfileSwitch={() => setShowProfileModal(true)}
                        />
                      )}
                    </Stack.Screen>
                    <Stack.Screen name="Scan">
                      {({ navigation }) => (
                        <ScanDocumentScreen
                          onBack={() => {
                            if (navigation.canGoBack()) {
                              navigation.goBack();
                            } else {
                              navigation.navigate('Home');
                            }
                          }}
                        />
                      )}
                    </Stack.Screen>
                    <Stack.Screen name="PrescriptionSummary">
                      {({ navigation, route }) => {
                        const params = route.params as unknown as { document?: Document; documentId?: string };
                        return (
                          <PrescriptionSummaryScreen
                            document={params?.document}
                            documentId={params?.documentId}
                            navigation={navigation}
                            onBack={() => {
                              if (navigation.canGoBack()) {
                                navigation.goBack();
                              } else {
                                navigation.navigate('Home');
                              }
                            }}
                          />
                        );
                      }}
                    </Stack.Screen>
                    <Stack.Screen name="Documents" component={DocumentsScreen} />
                    <Stack.Screen
                      name="Medications"
                      component={MedicationsScreen}
                      options={{
                        gestureEnabled: true,
                        gestureDirection: 'horizontal',
                      }}
                    />
                    <Stack.Screen
                      name="MedicationList"
                      component={MedicationHomeScreen}
                      options={{
                        gestureEnabled: true,
                        gestureDirection: 'horizontal',
                      }}
                    />
                    <Stack.Screen name="Health" component={HealthScreen} />
                    <Stack.Screen name="Profile" component={ProfileScreen} />
                    <Stack.Screen
                      name="PdfViewer"
                      component={PdfViewerScreen}
                      options={{
                        presentation: 'modal',
                        headerShown: false,
                        cardStyle: { backgroundColor: '#000' },
                      }}
                    />
                    <Stack.Screen
                      name="LabReportDetail"
                      component={LabReportDetailScreen}
                      options={{
                        headerShown: false,
                        gestureEnabled: true,
                        gestureDirection: 'horizontal',
                      }}
                    />
                    <Stack.Screen
                      name="LabMetricTrend"
                      component={LabMetricTrendScreen}
                      options={{
                        headerShown: false,
                        gestureEnabled: true,
                        gestureDirection: 'horizontal',
                      }}
                    />
                    <Stack.Screen
                      name="MedicineAlarm"
                      component={MedicineAlarmScreen}
                      options={{
                        headerShown: false,
                        gestureEnabled: true,
                        gestureDirection: 'horizontal',
                        cardStyle: { backgroundColor: 'transparent' },
                      }}
                    />
                  </Stack.Navigator>

                  {/* Profile Switcher Modal */}
                  <ProfileSwitcherModal
                    visible={showProfileModal}
                    onClose={() => setShowProfileModal(false)}
                  />
                </View>
              </View>
            )}
          </NavigationContainer>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
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
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.styles.body,
    color: Colors.textSecondary,
    marginTop: 16,
  },
});
