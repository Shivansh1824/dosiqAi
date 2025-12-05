// CRITICAL: Import Reanimated FIRST before any other imports
// This ensures the worklet runtime initializes properly
import 'react-native-reanimated';

console.log('[DEBUG] [index.ts] App entry point - Starting application');
console.log('[DEBUG] [index.ts] Timestamp:', new Date().toISOString());

import { registerRootComponent } from 'expo';

console.log('[DEBUG] [index.ts] Expo registerRootComponent imported');

import App from './App';

console.log('[DEBUG] [index.ts] App component imported successfully');

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
console.log('[DEBUG] [index.ts] Registering root component...');
registerRootComponent(App);
console.log('[DEBUG] [index.ts] Root component registered successfully');
