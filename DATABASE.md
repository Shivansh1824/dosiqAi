# FamilyCareHealth Database Architecture & Sync Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Data Flow Architecture](#data-flow-architecture)
4. [Caching Strategy](#caching-strategy)
5. [Store Pattern](#store-pattern)
6. [Sync Mechanisms](#sync-mechanisms)
7. [File Storage](#file-storage)
8. [Migration Guide (Supabase → Cloudflare R2)](#migration-guide)

---

## System Overview

### Technology Stack
- **Frontend**: React Native (Expo)
- **State Management**: Zustand
- **Database**: Supabase (PostgreSQL)
- **File Storage**: Supabase Storage
- **Local Cache**: AsyncStorage
- **Authentication**: Supabase Auth

### Core Principles
1. **Cache-First Loading**: Instant UI with cached data
2. **Silent Background Refresh**: Update data without loading spinners
3. **Optimistic Updates**: Update UI immediately, sync later
4. **Offline Support**: App works with cached data when offline

---

## Database Schema

### Current Supabase Tables

#### 1. `users` (Managed by Supabase Auth)
```sql
- id: uuid (primary key)
- email: text
- created_at: timestamp
```

#### 2. `family_members`
```sql
- id: uuid (primary key)
- user_id: uuid (foreign key → users.id)
- name: text
- relationship: text
- date_of_birth: date
- blood_group: text
- allergies: text[]
- medical_conditions: text[]
- created_at: timestamp
- updated_at: timestamp
```

#### 3. `documents`
```sql
- id: uuid (primary key)
- user_id: uuid (foreign key → users.id)
- family_member_id: uuid (foreign key → family_members.id, nullable)
- title: text
- type: text (prescription, lab_report, etc.)
- file_path: text (Supabase Storage path)
- file_size: bigint
- mime_type: text
- thumbnail_path: text (nullable)
- tags: text[]
- notes: text
- uploaded_at: timestamp
- created_at: timestamp
- updated_at: timestamp
```

#### 4. `medications`
```sql
- id: uuid (primary key)
- user_id: uuid (foreign key → users.id)
- family_member_id: uuid (foreign key → family_members.id, nullable)
- name: text
- dosage: text
- frequency: text
- start_date: date
- end_date: date (nullable)
- is_active: boolean
- color: text
- created_at: timestamp
- updated_at: timestamp
```

#### 5. `appointments`
```sql
- id: uuid (primary key)
- user_id: uuid (foreign key → users.id)
- family_member_id: uuid (foreign key → family_members.id, nullable)
- doctor_name: text
- appointment_type: text
- date: date
- time: time
- location: text
- notes: text
- status: text (scheduled, completed, cancelled)
- color: text
- created_at: timestamp
- updated_at: timestamp
```

#### 6. `health_vitals` (NEW - for AI-extracted metrics)
```sql
- id: uuid (primary key)
- user_id: uuid (foreign key → users.id)
- family_member_id: uuid (foreign key → family_members.id, nullable)
- type: text (vital, finding)
- label: text (e.g., "Blood Pressure", "Blood Sugar")
- value: text (e.g., "120/80", "95")
- unit: text (e.g., "mmHg", "mg/dL")
- status: text (normal, warning, critical)
- icon_name: text (MaterialCommunityIcons name)
- trend: text (up, down, stable)
- detail: text (additional context)
- measured_at: timestamp
- created_at: timestamp
- updated_at: timestamp
```

### Row Level Security (RLS)
All tables have RLS enabled with policies:
- Users can only access their own data
- `auth.uid() = user_id` check on all operations

---

## Data Flow Architecture

### 1. App Initialization Flow

```
App Start
    ↓
Check Auth State (Supabase)
    ↓
If Authenticated:
    ↓
Load All Data from Cache (AsyncStorage)
    ├── Documents
    ├── Medications
    ├── Appointments
    ├── Family Members
    └── Health Vitals
    ↓
Display UI with Cached Data (INSTANT)
    ↓
Silently Fetch from Supabase in Background
    ↓
Update UI if Data Changed
    ↓
Save to Cache
```

### 2. Screen Navigation Flow

```
User Navigates to Screen
    ↓
useFocusEffect Hook Triggered
    ↓
Step 1: Load from Cache
    ├── Call store.loadFromCache(userId)
    ├── Update UI immediately
    └── No loading spinner
    ↓
Step 2: Silent Background Refresh
    ├── Call store.fetch*(userId, silent=true)
    ├── Fetch from Supabase
    ├── Update UI if changed
    └── Save to cache
```

### 3. Data Mutation Flow (Add/Update/Delete)

```
User Action (e.g., Add Medication)
    ↓
Optimistic Update (Update UI immediately)
    ↓
Send to Supabase
    ↓
If Success:
    ├── Confirm update in store
    └── Save to cache
    ↓
If Error:
    ├── Rollback UI
    └── Show error message
```

### 4. AI Document Analysis Flow

```
User Uploads Document
    ↓
Upload to Supabase Storage
    ↓
Create Document Record in DB
    ↓
AI Analyzes Document (Extract Health Metrics)
    ↓
Extract: Blood Pressure, Sugar, etc.
    ↓
Call: addVitalsFromAI(userId, extractedVitals)
    ↓
Batch Insert to health_vitals Table
    ↓
Update Health Overview Screen
    ↓
Save to Cache
```

---

## Caching Strategy

### Cache Service (`src/services/cacheService.ts`)

#### Cache Keys Format
```
cache:v1:{dataType}:{userId}

Examples:
- cache:v1:documents:user-123
- cache:v1:medications:user-123
- cache:v1:vitals:user-123
```

#### Cache Operations

**1. Save to Cache**
```typescript
await saveToCache(key, data);
// Stores: { data, timestamp, version: 'v1' }
```

**2. Load from Cache**
```typescript
const cached = await loadFromCache(key);
// Returns data if exists, null otherwise
```

**3. Clear Cache**
```typescript
await clearCache(key);        // Clear specific key
await clearAllCache();        // Clear all app cache
```

#### Cache Versioning
- Current version: `v1`
- When schema changes, increment version
- Old cache automatically invalidated

---

## Store Pattern

### Zustand Store Structure

Every data store follows this pattern:

```typescript
interface StoreState {
  items: T[];           // Data array
  isLoading: boolean;   // Loading state
  error: string | null; // Error state
}

interface StoreActions {
  // Cache operations
  loadFromCache: (userId: string) => Promise<void>;
  
  // Fetch operations
  fetch*: (userId: string, silent?: boolean) => Promise<void>;
  
  // CRUD operations
  add*: (item: Omit<T, 'id'>) => Promise<void>;
  update*: (id: string, updates: Partial<T>) => Promise<void>;
  delete*: (id: string) => Promise<void>;
}
```

### Example: Documents Store

**File**: `src/store/documentsStore.ts`

```typescript
export const useDocumentsStore = create<DocumentsStore>((set) => ({
  documents: [],
  isLoading: false,
  error: null,

  // 1. Load from cache (instant)
  loadFromCache: async (userId) => {
    const cached = await loadFromCache(`documents:${userId}`);
    if (cached) set({ documents: cached });
  },

  // 2. Fetch from Supabase (with silent option)
  fetchDocuments: async (userId, silent = false) => {
    if (!silent) set({ isLoading: true });
    
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId);
    
    if (data) {
      set({ documents: data, isLoading: false });
      await saveToCache(`documents:${userId}`, data);
    }
  },

  // 3. Add document
  addDocument: async (document) => {
    const { data } = await supabase
      .from('documents')
      .insert([document])
      .select()
      .single();
    
    set((state) => ({
      documents: [data, ...state.documents]
    }));
  },
}));
```

---

## Sync Mechanisms

### 1. Manual Refresh (Pull-to-Refresh)

```typescript
const onRefresh = async () => {
  setRefreshing(true);
  await fetchDocuments(userId, true); // silent=true
  setRefreshing(false);
};
```

### 2. Automatic Background Sync

**Document Sync Hook** (`src/hooks/useDocumentSync.ts`)

```typescript
// Syncs every 30 minutes
useEffect(() => {
  const interval = setInterval(() => {
    fetchDocuments(userId, true); // Silent refresh
  }, 30 * 60 * 1000); // 30 minutes
  
  return () => clearInterval(interval);
}, [userId]);
```

### 3. Real-time Sync (Future Enhancement)

```typescript
// Supabase Realtime (not yet implemented)
supabase
  .channel('documents')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'documents' },
    (payload) => {
      // Update local state
    }
  )
  .subscribe();
```

---

## File Storage

### Supabase Storage Structure

```
Buckets:
├── documents/
│   ├── {userId}/
│   │   ├── {documentId}.pdf
│   │   ├── {documentId}.jpg
│   │   └── thumbnails/
│   │       └── {documentId}_thumb.jpg
```

### File Upload Flow

```
1. User selects file
    ↓
2. Generate unique filename
    ↓
3. Upload to Supabase Storage
   - Path: documents/{userId}/{filename}
    ↓
4. Get public URL
    ↓
5. Create document record in DB
   - file_path: storage path
   - file_size: bytes
   - mime_type: image/jpeg, application/pdf
    ↓
6. Download to local storage (optional)
   - expo-file-system
   - FileSystem.documentDirectory
    ↓
7. Update UI
```

### Local File Storage (`src/utils/fileStorage.ts`)

```typescript
// Download file locally
await downloadDocument(documentId, fileUrl);

// Stored at:
FileSystem.documentDirectory + 'documents/' + filename

// Retrieve local path
const localPath = await getLocalDocumentPath(documentId);
```

---

## Migration Guide (Supabase → Cloudflare R2)

### Overview
Cloudflare R2 is S3-compatible object storage. Migration involves:
1. Database migration (Supabase PostgreSQL → ?)
2. File storage migration (Supabase Storage → R2)
3. Auth migration (Supabase Auth → ?)

### Step 1: Database Migration Options

**Option A: Keep Supabase PostgreSQL**
- Only migrate file storage to R2
- Keep database on Supabase
- Easiest migration path

**Option B: Migrate to Cloudflare D1**
- Cloudflare's SQLite-based database
- Requires schema conversion
- More complex migration

**Option C: Migrate to External PostgreSQL**
- Use Neon, Railway, or self-hosted
- Keep same schema
- Update connection string

### Step 2: File Storage Migration (Supabase → R2)

#### Current Supabase Storage Code
```typescript
// Upload
const { data } = await supabase.storage
  .from('documents')
  .upload(path, file);

// Download
const { data } = await supabase.storage
  .from('documents')
  .download(path);
```

#### New R2 Code (S3-compatible)
```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Upload
await s3Client.send(new PutObjectCommand({
  Bucket: 'documents',
  Key: path,
  Body: file,
}));

// Download
const { Body } = await s3Client.send(new GetObjectCommand({
  Bucket: 'documents',
  Key: path,
}));
```

### Step 3: Create Storage Abstraction Layer

**File**: `src/services/storageService.ts`

```typescript
interface StorageService {
  upload(path: string, file: Blob): Promise<string>;
  download(path: string): Promise<Blob>;
  delete(path: string): Promise<void>;
  getPublicUrl(path: string): string;
}

// Supabase implementation
class SupabaseStorage implements StorageService {
  async upload(path, file) {
    const { data } = await supabase.storage
      .from('documents')
      .upload(path, file);
    return data.path;
  }
  // ... other methods
}

// R2 implementation
class R2Storage implements StorageService {
  async upload(path, file) {
    await s3Client.send(new PutObjectCommand({
      Bucket: 'documents',
      Key: path,
      Body: file,
    }));
    return path;
  }
  // ... other methods
}

// Factory
export const storage: StorageService = 
  USE_R2 ? new R2Storage() : new SupabaseStorage();
```

### Step 4: Migration Checklist

**Pre-Migration:**
- [ ] Backup all data from Supabase
- [ ] Export database schema
- [ ] List all storage buckets and files
- [ ] Document all API endpoints

**Database Migration:**
- [ ] Set up new database (D1, Neon, etc.)
- [ ] Run schema migration scripts
- [ ] Migrate data (use pg_dump/restore)
- [ ] Update connection strings in app
- [ ] Test all queries

**File Storage Migration:**
- [ ] Create R2 bucket
- [ ] Set up CORS policies
- [ ] Migrate files (use rclone or custom script)
- [ ] Update file URLs in database
- [ ] Implement storage abstraction layer
- [ ] Test upload/download

**Auth Migration:**
- [ ] Choose auth provider (Clerk, Auth0, custom)
- [ ] Migrate user accounts
- [ ] Update auth flows in app
- [ ] Test login/signup

**Testing:**
- [ ] Test all CRUD operations
- [ ] Test file upload/download
- [ ] Test offline mode
- [ ] Test cache invalidation
- [ ] Performance testing

**Deployment:**
- [ ] Deploy new backend
- [ ] Update app configuration
- [ ] Gradual rollout (beta users first)
- [ ] Monitor errors
- [ ] Keep Supabase as fallback (temporary)

---

## Current App Workflow Summary

### User Journey: Upload Document → AI Analysis → Health Metrics

```
1. User uploads medical report (PDF/Image)
    ↓
2. File uploaded to Supabase Storage
   - Path: documents/{userId}/{documentId}.pdf
    ↓
3. Document record created in DB
   - Table: documents
   - Fields: title, type, file_path, etc.
    ↓
4. AI analyzes document (external service)
   - Extract: Blood Pressure, Sugar, Cholesterol, etc.
   - Returns: Array of HealthMetric objects
    ↓
5. Store extracted metrics
   - Call: addVitalsFromAI(userId, metrics)
   - Table: health_vitals
    ↓
6. Update Health Overview screen
   - Fetch vitals from DB
   - Display in dynamic cards
   - Show trends and status
    ↓
7. Cache everything
   - Documents cached
   - Vitals cached
   - Next load is instant
```

### Data Stores in Use

| Store | File | Purpose | Cache Key |
|-------|------|---------|-----------|
| Auth | `authStore.ts` | User authentication | N/A |
| Documents | `documentsStore.ts` | Medical documents | `documents:{userId}` |
| Medications | `medicationsStore.ts` | Medication tracking | `medications:{userId}` |
| Appointments | `appointmentsStore.ts` | Doctor appointments | `appointments:{userId}` |
| Family Members | `familyMembersStore.ts` | Family profiles | `familyMembers:{userId}` |
| Health Vitals | `healthVitalsStore.ts` | AI-extracted metrics | `vitals:{userId}` |

---

## Performance Optimizations

### 1. Cache-First Loading
- **Problem**: Slow initial load from database
- **Solution**: Load from AsyncStorage first (instant)
- **Result**: UI appears in <100ms

### 2. Silent Background Refresh
- **Problem**: Loading spinners on every navigation
- **Solution**: Fetch with `silent=true` flag
- **Result**: Smooth UX, no loading interruptions

### 3. Optimistic Updates
- **Problem**: Waiting for server response
- **Solution**: Update UI immediately, rollback on error
- **Result**: Instant feedback

### 4. Pagination (Future)
- **Problem**: Loading 1000+ documents at once
- **Solution**: Implement cursor-based pagination
- **Result**: Faster queries, less memory

### 5. Image Optimization
- **Problem**: Large image files
- **Solution**: Generate thumbnails, lazy load full images
- **Result**: Faster screen loads

---

## Debugging & Monitoring

### Enable Debug Logs

```typescript
// In each store
console.log('[DocumentsStore] Fetching documents for user:', userId);
console.log('[DocumentsStore] Cache hit:', cached ? 'YES' : 'NO');
console.log('[DocumentsStore] Fetched', data.length, 'documents');
```

### Monitor Cache Performance

```typescript
const cacheMetadata = await getCacheMetadata('documents:user-123');
console.log('Cache age:', Date.now() - cacheMetadata.timestamp);
```

### Error Tracking

```typescript
try {
  await fetchDocuments(userId);
} catch (error) {
  console.error('[DocumentsStore] Error:', error);
  // Send to error tracking service (Sentry, etc.)
}
```

---

## Future Enhancements

1. **Real-time Sync**: Supabase Realtime subscriptions
2. **Offline Queue**: Queue mutations when offline, sync when online
3. **Conflict Resolution**: Handle concurrent edits
4. **Delta Sync**: Only sync changed records
5. **Compression**: Compress cached data
6. **Encryption**: Encrypt sensitive data in cache
7. **Background Sync**: Use background tasks for sync

---

## Contact & Support

For questions about this architecture:
- Review this document
- Check store implementations in `src/store/`
- Check cache service in `src/services/cacheService.ts`
- Review data flow in screen components

**Last Updated**: December 2025  
**Version**: 1.0  
**Database**: Supabase PostgreSQL  
**Storage**: Supabase Storage  
**Cache**: AsyncStorage
