# Clear Local Documents Feature

## Overview

This feature allows you to clear all locally stored documents from the iOS simulator (or device) without affecting the database records.

## What Gets Cleared

When you use this feature, the following are deleted:

1. **In-Memory Documents** - All documents currently loaded in the app's state
2. **AsyncStorage Cache** - Cached document metadata stored in AsyncStorage
3. **Local Files** - All document files stored in the `FamilyCareHealth/` directory

## What Remains Unchanged

- **Supabase Database Records** - All document records in the database remain intact
- **Remote File Storage** - If you're using cloud storage, those files are not affected

## How to Use

### Option 1: Via Profile Screen (Recommended)

1. Open the app on your iPhone 16e Simulator
2. Navigate to the **Profile** screen
3. Scroll down to find the **"Clear Local Documents"** button (orange button with trash icon)
4. Tap the button
5. Confirm the action in the alert dialog
6. Wait for the success confirmation

### Option 2: Via Code (Developer Console)

```javascript
import { useDocumentsStore } from './src/store/documentsStore';
import { useAuthStore } from './src/store/authStore';

// Get current user ID
const userId = useAuthStore.getState().user?.id;

// Clear all local documents
await useDocumentsStore.getState().clearAllLocalDocuments(userId);
```

### Option 3: Via Utility Script

```javascript
import clearAllLocalDocuments from './clearLocalDocuments';

await clearAllLocalDocuments();
```

## Technical Details

### Implementation

The `clearAllLocalDocuments` function is implemented in:
- **Store**: [mobile/src/store/documentsStore.ts:468-505](mobile/src/store/documentsStore.ts)
- **Type Definition**: [mobile/src/types/document.ts:160](mobile/src/types/document.ts)
- **UI Component**: [mobile/src/screens/ProfileScreen.tsx:103-113](mobile/src/screens/ProfileScreen.tsx)

### Process Flow

```
1. Clear in-memory documents array
   └─> Set documents = []

2. Clear AsyncStorage cache
   └─> Delete cache:v1:documents:{userId}

3. Delete FamilyCareHealth directory
   └─> Delete entire directory with all subdirectories and files
   └─> Removes all document images/files stored locally
```

### File Storage Structure

Local documents are stored in:
```
{DocumentDirectory}/
└── FamilyCareHealth/
    └── {UserName}/
        ├── doc_{documentId}_{title}.jpg
        ├── doc_{documentId}_{title}.png
        └── ...
```

The entire `FamilyCareHealth/` directory is deleted during cleanup.

## Use Cases

- **Development/Testing**: Clear test data without affecting production database
- **Debugging**: Reset local state when troubleshooting sync issues
- **Privacy**: Remove all local files before sharing device
- **Storage Management**: Free up local storage space
- **Fresh Start**: Reset app to clean state while keeping user account

## Important Notes

⚠️ **This operation is irreversible** - Once cleared, local files cannot be recovered (unless they exist in the database)

⚠️ **Database cleanup is manual** - You must manually delete records from Supabase if needed

⚠️ **No network required** - This operation only affects local storage

## Future Enhancements

Potential improvements for this feature:

1. Add option to clear only specific user's documents
2. Add option to clear only files (keep cache)
3. Add option to clear only cache (keep files)
4. Show storage space freed after cleanup
5. Add confirmation with document count
6. Add undo functionality (backup before delete)

## Related Files

- [mobile/src/store/documentsStore.ts](mobile/src/store/documentsStore.ts) - Document store with cleanup function
- [mobile/src/types/document.ts](mobile/src/types/document.ts) - TypeScript types
- [mobile/src/services/cacheService.ts](mobile/src/services/cacheService.ts) - AsyncStorage cache utilities
- [mobile/src/utils/fileStorage.ts](mobile/src/utils/fileStorage.ts) - File system utilities
- [mobile/src/screens/ProfileScreen.tsx](mobile/src/screens/ProfileScreen.tsx) - Profile UI with clear button
- [mobile/clearLocalDocuments.js](mobile/clearLocalDocuments.js) - Standalone utility script

## Support

If you encounter any issues with this feature, check the console logs for detailed error messages. All operations are logged with the `[DocumentsStore]` prefix.
