// CRITICAL: Import Reanimated FIRST before any other imports
// This ensures the worklet runtime initializes properly
import 'react-native-reanimated';
import 'react-native-get-random-values';

import { AppRegistry } from 'react-native';

console.log('[DEBUG] [index.ts] App entry point - Starting application');
console.log('[DEBUG] [index.ts] Timestamp:', new Date().toISOString());

import { registerRootComponent } from 'expo';

console.log('[DEBUG] [index.ts] Expo registerRootComponent imported');

import App from './App';

console.log('[DEBUG] [index.ts] App component imported successfully');

// Import notification components
import MedicineAlarmScreen from './src/screens/MedicineAlarmScreen';
import { setupBackgroundEventHandler } from './src/services/notificationEventHandler';

// Register the full-screen alarm component for Android
// This is launched when a medication notification fires with fullScreenAction
AppRegistry.registerComponent('MedicineAlarmScreen', () => MedicineAlarmScreen);
console.log('[DEBUG] [index.ts] MedicineAlarmScreen registered');

// Set up background notification handler
// This handles notification actions when app is in background/killed
setupBackgroundEventHandler();
console.log('[DEBUG] [index.ts] Background notification handler set up');

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
console.log('[DEBUG] [index.ts] Registering root component...');
registerRootComponent(App);
console.log('[DEBUG] [index.ts] Root component registered successfully');

