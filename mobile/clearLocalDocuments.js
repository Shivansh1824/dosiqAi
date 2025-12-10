/**
 * Utility script to clear all locally stored documents
 * This will delete:
 * - All in-memory documents
 * - AsyncStorage cache for documents
 * - All local files in FamilyCareHealth directory
 *
 * NOTE: Database records remain unchanged
 *
 * Usage:
 * 1. Run this script from the Expo DevTools console
 * 2. Or add it to your app's settings screen
 */

import { useDocumentsStore } from './src/store/documentsStore';
import { useAuthStore } from './src/store/authStore';

export const clearAllLocalDocuments = async () => {
  try {
    console.log('🗑️  Starting local document cleanup...');

    // Get current user ID
    const user = useAuthStore.getState().user;
    const userId = user?.id;

    if (userId) {
      console.log('👤 User ID:', userId);
    } else {
      console.warn('⚠️  No user found. Will clear all local files but not cache.');
    }

    // Call the clearAllLocalDocuments function
    await useDocumentsStore.getState().clearAllLocalDocuments(userId);

    console.log('✅ Local documents cleared successfully!');
    console.log('📝 Note: Database records remain unchanged (manual cleanup required)');

    return {
      success: true,
      message: 'Local documents cleared successfully',
    };
  } catch (error) {
    console.error('❌ Error clearing local documents:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
};

// Export for direct use
export default clearAllLocalDocuments;