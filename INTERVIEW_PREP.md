# FamilyCareHealth - Interview Preparation Guide for Freshers

> **Your App Summary**: A mobile health management app that helps families digitize medical documents, extract health data using AI, track medications, and manage appointments. Built with React Native and backed by Supabase.

---

## Part 1: Understanding the Basics

### What is FamilyCareHealth?

**Simple Answer:**
"FamilyCareHealth is a mobile app I built to help families manage their health records digitally. Users can scan prescriptions and medical reports, and the app uses AI to automatically extract important information like medications, vital signs, and diagnoses. It also helps track medications and appointments for the whole family."

**Key Stats to Mention:**
- 15 screens in the mobile app
- AI-powered document analysis
- Supports multiple family members
- Offline-first (works without internet)
- 18,600+ lines of TypeScript code

---

## Part 2: Technology Stack Explained

### 2.1 Frontend - React Native

**What is it?**
React Native is a framework for building mobile apps using JavaScript/TypeScript. Instead of writing separate code for iOS and Android, you write once and it runs on both platforms.

**Why did you choose it?**
- **Cross-platform**: One codebase for both iOS and Android
- **Popular**: Large community, many packages available
- **JavaScript/TypeScript**: I'm comfortable with web technologies
- **Fast development**: Hot reload lets me see changes instantly

**Interview Questions:**

**Q: What is React Native?**
**A:** "React Native is a JavaScript framework developed by Meta (Facebook) that allows you to build native mobile apps for iOS and Android using React. Unlike web apps, React Native compiles to actual native components, so the app performs like a native app."

**Q: What's the difference between React and React Native?**
**A:** "React is for building web applications and renders to HTML/CSS. React Native is for mobile apps and renders to native iOS/Android components. For example, in React you use `<div>`, but in React Native you use `<View>`."

**Q: Why not just build a web app?**
**A:** "Mobile apps provide better performance, can access device features like the camera and notifications, work offline more easily, and give a better user experience for mobile users. For a health app where people need quick access to their medical records, a native mobile experience is important."

---

### 2.2 Expo Framework

**What is it?**
Expo is a framework built on top of React Native that makes development easier by providing pre-configured tools, libraries, and build services.

**Why did you use it?**
- **Easier setup**: No need to configure Xcode/Android Studio from scratch
- **Built-in libraries**: Camera, file system, notifications already integrated
- **EAS Build**: Cloud-based build service
- **OTA updates**: Can push updates without going through app stores

**Interview Questions:**

**Q: What is Expo?**
**A:** "Expo is a framework and platform built around React Native that simplifies mobile app development. It provides pre-configured libraries for common features like camera, location, and push notifications. It also includes EAS (Expo Application Services) for building and deploying apps to the app stores."

**Q: What's the difference between Expo and bare React Native?**
**A:** "Expo provides a managed workflow with pre-configured tools and libraries, making development faster. Bare React Native gives you more control but requires more manual setup. I used Expo because it handles complex configurations automatically, but I can still add custom native code when needed using development builds."

---

### 2.3 TypeScript

**What is it?**
TypeScript is JavaScript with type checking. It helps catch errors before running the code.

**Why did you use it?**
- **Fewer bugs**: Catches mistakes while coding
- **Better autocomplete**: IDE knows what properties objects have
- **Self-documenting**: Types show what data looks like
- **Required for large projects**: Industry standard

**Interview Questions:**

**Q: Why use TypeScript over JavaScript?**
**A:** "TypeScript adds static type checking to JavaScript, which helps catch errors during development instead of at runtime. For example, if I define a Document type with specific properties, TypeScript will warn me if I try to access a property that doesn't exist. This is especially important in a health app where data accuracy is critical."

**Q: Can you show an example of TypeScript in your project?**
**A:** "Sure! In my project, I defined all data types in the `/mobile/src/types/` folder. For example, here's my Document type:

```typescript
interface Document {
  id: string;
  user_id: string;
  title: string;
  type: 'Lab Report' | 'Prescription' | 'Imaging' | 'Medical Record';
  file_path: string;
  ai_analysis_result?: DocumentAnalysisResult;
  created_at: string;
}
```

This ensures I can't accidentally assign the wrong type of data to these fields."

---

### 2.4 State Management - Zustand

**What is it?**
State management is how you store and manage data that multiple screens need to access (like user info, documents, medications).

**Why Zustand instead of Redux?**
- **Simpler**: Less code to write
- **TypeScript-friendly**: Better type inference
- **Smaller bundle**: Takes up less space in the app
- **Easier to learn**: More straightforward for beginners

**Interview Questions:**

**Q: What is state management and why do you need it?**
**A:** "State management is how you handle data that multiple parts of your app need to access. For example, when a user logs in, many screens need to know who the current user is. Without state management, you'd have to pass this data through every component. Zustand provides a central store where all screens can access and update shared data."

**Q: Why did you choose Zustand over Redux?**
**A:** "I chose Zustand because it's much simpler than Redux. In Redux, you need actions, reducers, and a lot of boilerplate code. Zustand lets me create a store with just a few lines. Here's a simple example from my app:

```typescript
const useDocumentsStore = create<DocumentsStore>((set) => ({
  documents: [],
  isLoading: false,
  addDocument: async (doc) => {
    set({ documents: [doc, ...documents] });
    await supabase.from('documents').insert(doc);
  },
}));
```

It's much more readable and requires less code."

**Q: How many stores do you have and why?**
**A:** "I have 7 separate stores in my app:
1. **authStore** - User authentication
2. **documentsStore** - Medical documents
3. **medicationsStore** - Medications
4. **appointmentsStore** - Appointments
5. **familyMembersStore** - Family profiles
6. **healthVitalsStore** - Health metrics
7. **medicationLogsStore** - Medication intake tracking

I separated them to keep concerns isolated and make the code easier to maintain. Each store handles one specific domain."

---

### 2.5 Backend - Supabase

**What is it?**
Supabase is an open-source alternative to Firebase. It provides a PostgreSQL database, authentication, file storage, and serverless functions.

**Why Supabase instead of Firebase?**
- **PostgreSQL**: More powerful than Firebase's NoSQL
- **SQL queries**: Familiar and powerful
- **Row Level Security**: Built-in security at database level
- **Open source**: Can self-host if needed
- **Edge Functions**: Serverless TypeScript functions

**Interview Questions:**

**Q: What is Supabase?**
**A:** "Supabase is a backend-as-a-service (BaaS) platform that provides a PostgreSQL database, authentication, real-time subscriptions, storage, and serverless functions. It's similar to Firebase but uses a SQL database instead of NoSQL, which gives more flexibility for complex queries."

**Q: How did you structure your database?**
**A:** "I have 6 main tables:

1. **users** - Managed by Supabase Auth automatically
2. **family_members** - Stores profiles for each family member
3. **documents** - Medical documents with file paths and AI analysis results
4. **medications** - Medication details with dosage and frequency
5. **appointments** - Doctor appointments
6. **upload_limits** - Daily upload tracking to prevent abuse

All tables use Row Level Security (RLS) policies so users can only access their own data."

**Q: What is Row Level Security?**
**A:** "Row Level Security (RLS) is a PostgreSQL feature that restricts database access at the row level. For example, I have a policy that says:

```sql
CREATE POLICY 'Users can only view their own documents'
ON documents FOR SELECT
USING (auth.uid() = user_id);
```

This means even if someone tries to query another user's documents, the database will block it. Security is enforced at the database level, not just in my app code."

**Q: What are Edge Functions and how do you use them?**
**A:** "Edge Functions are serverless functions that run on Supabase's servers. I use one called `analyze-document` to process medical documents with AI. Here's why I used an Edge Function instead of calling the AI API directly from the app:

1. **Security**: Keeps my API key secret (not exposed in the app)
2. **Rate limiting**: I can control how many documents each user analyzes
3. **Processing**: Heavy lifting happens on the server, not on the user's phone

The function takes a document image, sends it to OpenRouter API (Google Gemini), and returns structured health data."

---

### 2.6 Navigation - React Navigation

**What is it?**
React Navigation is the most popular library for handling navigation (moving between screens) in React Native apps.

**Interview Questions:**

**Q: How did you implement navigation?**
**A:** "I use React Navigation with a Stack Navigator. The flow is:

1. **Welcome Screen** → Onboarding screens (3 slides)
2. **Login/Signup** → Authentication
3. **Home Screen** → Main app with bottom tabs
4. **Bottom Tabs** → Home, Documents, Medications, Health, Profile

I also use modal screens for things like adding family members or viewing the calendar."

**Q: What's the difference between Stack and Tab navigation?**
**A:** "Stack navigation is like a stack of cards - you push new screens on top and pop them off when going back. Tab navigation shows multiple screens accessible via tabs at the bottom. In my app, I use Stack navigation for the login flow, then Tab navigation for the main app features."

---

## Part 3: Key Features Implementation

### 3.1 AI Document Analysis

**How it works:**

1. User takes photo or uploads document
2. App compresses image to reduce size
3. App converts image to base64
4. App calls Supabase Edge Function with image data
5. Edge Function sends to OpenRouter API (Google Gemini 2.5 Flash)
6. AI extracts: patient info, vitals, medications, diagnoses
7. Results saved to database in structured format
8. User sees extracted data in the app

**Interview Questions:**

**Q: How does the AI document analysis work?**
**A:** "When a user uploads a medical document, here's what happens:

1. The image is compressed using `expo-image-manipulator` to reduce file size
2. I convert it to base64 format
3. I call my Supabase Edge Function called `analyze-document`
4. The Edge Function forwards the image to OpenRouter API, which uses Google Gemini 2.5 Flash model
5. The AI returns structured JSON with extracted data like medications, vital signs, patient info
6. I save this to my database and display it to the user

The whole process takes about 5-10 seconds and costs less than a penny per document."

**Q: Why use OpenRouter instead of calling OpenAI directly?**
**A:** "OpenRouter is an API gateway that gives access to multiple AI models through one interface. I chose it because:

1. **Cost**: Google Gemini 2.5 Flash costs $0.0004 per document (cheaper than GPT-4)
2. **Flexibility**: I can easily switch to different models without changing my code
3. **Reliability**: If one model is down, I can failover to another

For a student project, keeping costs low while maintaining quality was important."

**Q: How do you prevent abuse (users uploading unlimited documents)?**
**A:** "I implemented a rate limiting system:

1. Created an `upload_limits` table in the database
2. Each time a user uploads, I check their count for today
3. If they've hit the limit (5 per day), the upload is rejected
4. The limit resets at midnight UTC
5. This is enforced both in the app and in the Edge Function (server-side)

This keeps my AI costs under control while still providing value to users."

---

### 3.2 Offline-First Architecture

**What does this mean?**
The app works without internet by storing data locally first, then syncing with the server when online.

**How it works:**

1. All data stored locally in AsyncStorage (key-value store)
2. When user opens a screen, data loads from cache instantly
3. In the background, app fetches latest data from Supabase
4. If data changed, UI updates silently
5. User actions save locally first, then sync to server

**Interview Questions:**

**Q: What is offline-first architecture?**
**A:** "Offline-first means the app prioritizes local data storage and works without internet. When a user opens the Documents screen, here's what happens:

1. Instantly load documents from AsyncStorage cache (~50ms)
2. Show cached data immediately (no loading spinner)
3. Silently fetch from Supabase in background
4. If there are updates, refresh the UI smoothly
5. If offline, show cached data only

This gives a much better user experience than waiting for network requests every time."

**Q: How do you handle conflicts when data changes both locally and on the server?**
**A:** "Currently, I use a simple last-write-wins strategy - the most recent update is kept. For a future version, I'd implement:

1. **Versioning**: Each record has a version number
2. **Conflict detection**: Check if server version changed since last fetch
3. **Conflict resolution**: Show user both versions and let them choose
4. **Operational transforms**: For real-time collaboration

For this MVP, conflicts are rare since most users are the only ones editing their data."

---

### 3.3 File Storage Strategy

**The Challenge:**
iOS changes the app's container path every time you rebuild. If you store absolute paths like `/var/mobile/Containers/.../document.jpg`, they break after rebuilding.

**The Solution:**

1. Store **relative paths** in the database: `documents/user_123/doc_1.jpg`
2. At runtime, convert to **absolute paths**: `{DocumentDirectory}/documents/user_123/doc_1.jpg`
3. Use helper functions: `getAbsolutePath()` and `getRelativePath()`

**Interview Questions:**

**Q: How do you handle file storage?**
**A:** "I use `expo-file-system` to store files locally. When a user uploads a document:

1. I save the file to the app's document directory
2. I store a **relative path** in the database (e.g., `documents/user_123/doc_1.jpg`)
3. When displaying the file, I convert the relative path to an absolute path
4. This solves the iOS container path changing issue

The files are organized by user: `{DocumentDirectory}/FamilyCareHealth/{UserName}/doc_{id}_{title}.ext`"

**Q: Why not store files in Supabase Storage?**
**A:** "I chose local storage for several reasons:

1. **Offline access**: Documents available without internet
2. **Speed**: No network delay when viewing
3. **Cost**: No storage fees
4. **Privacy**: Files never leave the device unless explicitly shared

For a future version, I'd add optional cloud backup to Supabase Storage for users who want it."

---

### 3.4 Family Member Profiles

**How it works:**
- Each user can create profiles for family members (spouse, children, parents)
- All health data is isolated by family member
- A "profile switcher" modal lets you change who you're viewing data for
- One "active member" at a time

**Interview Questions:**

**Q: How does multi-user support work?**
**A:** "Each user can create multiple family member profiles. The structure is:

1. **User** (the account owner)
2. **Family Members** (profiles they create)
   - Primary member = user themselves ("Me")
   - Additional members = spouse, kids, parents, etc.

All health data (documents, medications, appointments) belongs to a specific family member. When you switch profiles, the app filters all data to show only that person's records:

```typescript
documents.filter(doc => doc.family_member_id === activeMember.id)
```

This keeps data separate and organized."

**Q: How do you ensure data doesn't leak between family members?**
**A:** "Data isolation happens at multiple levels:

1. **Database level**: Each record has a `family_member_id` foreign key
2. **Query level**: All queries filter by the active family member
3. **UI level**: Profile switcher clearly shows who you're viewing

Additionally, Row Level Security (RLS) in Supabase ensures users can only query their own family members' data."

---

## Part 4: Design & UX Decisions

### 4.1 Design System

**What is it?**
A design system is a set of reusable components, colors, typography, and spacing rules that keep the UI consistent.

**Your design system:**
- **Colors**: `/mobile/src/constants/Colors.ts` (20+ colors)
- **Typography**: `/mobile/src/constants/Typography.ts` (title, body, caption styles)
- **Spacing**: `/mobile/src/constants/Sizes.ts` (8px-based scale)

**Interview Questions:**

**Q: How did you maintain UI consistency?**
**A:** "I created a design system with centralized design tokens:

1. **Colors**: Primary blue (#4A90E2) for trust, secondary green (#66BB6A) for health
2. **Typography**: Consistent font sizes (36px for titles, 16px for body text)
3. **Spacing**: 8px-based scale (xs: 4px, sm: 8px, md: 16px, lg: 24px)

All components use these tokens instead of hardcoded values. For example:

```typescript
<Text style={{ fontSize: Typography.sizes.body, color: Colors.textPrimary }}>
  Hello
</Text>
```

This makes it easy to change the theme globally."

**Q: Why did you choose blue and green as primary colors?**
**A:** "Color psychology is important in health apps:

- **Blue (#4A90E2)**: Represents trust, calm, and professionalism - critical for medical apps
- **Green (#66BB6A)**: Represents health, growth, and wellness
- **Orange (#FB8C00)**: For alerts and important actions
- **Red (#EF5350)**: For critical values or errors

These choices make the app feel trustworthy and medical-grade."

---

### 4.2 Performance Optimizations

**Optimizations you made:**

1. **Image compression**: Reduce file sizes before storage
2. **Cache-first loading**: Instant screen loads from cache
3. **Calculated colors**: Colors computed on-the-fly instead of stored in DB
4. **Lazy loading**: Load data only when needed
5. **Debounced search**: Wait for user to stop typing before searching

**Interview Questions:**

**Q: What performance optimizations did you implement?**
**A:** "Several key optimizations:

1. **Image Compression**: Medical images can be 5-10MB. I compress them to ~500KB using `expo-image-manipulator` without visible quality loss.

2. **Cache-First Loading**: Instead of showing loading spinners, I load data from AsyncStorage cache instantly (<50ms) while fetching fresh data in the background.

3. **Calculated Colors**: Instead of storing colors in the database, I calculate them on-the-fly based on type/index. This saves database space and makes queries faster.

4. **Optimized Re-renders**: I use React.memo() for expensive components and useMemo() for calculations.

These optimizations make the app feel instant and responsive."

**Q: How did you measure performance?**
**A:** "I tracked several metrics:

- **Cold start time**: ~2 seconds
- **Screen navigation**: <100ms with cache hits
- **Image compression**: <1 second for typical photos
- **AI analysis**: 5-10 seconds (network dependent)

I used React DevTools Profiler to identify slow components and optimize them."

---

## Part 5: Common Interview Questions & Answers

### Architecture & Design

**Q: Walk me through your app's architecture.**
**A:** "My app uses a three-tier architecture:

**1. Frontend (React Native + Expo)**
- 15 screens organized by feature
- 26 reusable components
- 7 Zustand stores for state management
- TypeScript for type safety

**2. Backend (Supabase)**
- PostgreSQL database with 6 tables
- Row Level Security for data isolation
- Edge Functions for AI processing
- Authentication (email, OAuth, phone)

**3. External Services**
- OpenRouter API for AI document analysis (Google Gemini)
- expo-camera for photo capture
- AsyncStorage for local caching

The app follows an offline-first pattern where all data is stored locally first, then synced to Supabase when online."

---

**Q: What was the biggest technical challenge you faced?**
**A:** "The biggest challenge was implementing the AI document analysis while keeping costs low and maintaining user privacy. Here's how I solved it:

**Problem**: Calling OpenAI GPT-4 directly would cost ~$0.10 per document and require sending sensitive health data to external servers.

**Solution**:
1. Used OpenRouter to access cheaper models (Google Gemini: $0.0004/doc)
2. Implemented rate limiting (5 uploads/day) to control costs
3. Created a Supabase Edge Function to keep API keys secure
4. Structured the AI prompt to return consistent JSON format

This approach reduced costs by 99% while maintaining accuracy."

---

**Q: How do you ensure data security?**
**A:** "Security is critical for a health app. I implemented multiple layers:

**1. Authentication**
- Supabase Auth with JWT tokens
- Support for email, Google, Apple, and phone OTP
- Automatic token refresh
- Secure session storage

**2. Database Security**
- Row Level Security (RLS) policies on all tables
- Users can only access their own data
- Foreign key constraints to prevent orphaned data

**3. API Security**
- API keys stored in Edge Functions (not in app code)
- JWT verification on all API requests
- Rate limiting to prevent abuse

**4. Local Storage**
- Files encrypted at rest (iOS/Android defaults)
- AsyncStorage for sensitive data
- No logging of health information"

---

**Q: How would you scale this app to millions of users?**
**A:** "Great question! Here's my scaling plan:

**1. Database**
- Add read replicas for queries
- Implement database sharding by user_id
- Add indexes on frequently queried columns
- Use connection pooling

**2. File Storage**
- Move to cloud storage (S3/Supabase Storage)
- Add CDN for faster global delivery
- Implement automatic backups

**3. AI Processing**
- Add queue system (Bull/RabbitMQ) for document processing
- Scale Edge Functions horizontally
- Consider batch processing for multiple documents

**4. Monitoring**
- Add Sentry for error tracking
- Implement analytics (Mixpanel/Amplitude)
- Set up performance monitoring
- Create alerting for critical issues

**5. Caching**
- Add Redis for frequently accessed data
- Implement service worker for web version
- Use CDN for static assets

**6. Cost Management**
- Implement tiered pricing (free: 5 docs/day, premium: unlimited)
- Optimize AI prompts to reduce token usage
- Use cheaper models for simple documents"

---

**Q: What testing strategy did you use?**
**A:** "Currently, I've focused on manual testing with a comprehensive checklist covering:

- Authentication flows
- Document upload and analysis
- Medication tracking
- Family member management
- Offline functionality

**For production, I would add:**

**1. Unit Tests (Jest)**
```typescript
describe('medicationParser', () => {
  it('should parse Q6H to every 6 hours', () => {
    expect(parseFrequency('Q6H')).toBe('Every 6 hours');
  });
});
```

**2. Integration Tests**
- Test Zustand store operations
- Test Supabase queries
- Test AI analysis flow

**3. E2E Tests (Detox)**
- Test complete user journeys
- Test offline mode
- Test error handling

**4. Performance Tests**
- Monitor cold start time
- Check for memory leaks
- Test with large datasets

I prioritized building features first, but testing is next on my roadmap."

---

### Technology Choices

**Q: Why mobile app instead of web app?**
**A:** "I chose mobile for several reasons:

1. **Camera Access**: Scanning documents needs the camera
2. **Offline Access**: Health records should be available anywhere
3. **Notifications**: Medication reminders need push notifications
4. **Better UX**: Native apps feel more responsive and integrated
5. **File System**: Local file storage for documents

That said, I also built a web dashboard (React + Vite) for family members who prefer larger screens, like when reviewing health trends on a computer."

---

**Q: What would you do differently if you started over?**
**A:** "A few things I'd change:

1. **Testing First**: I'd write tests from the beginning instead of retroactively
2. **Microservices**: Separate AI processing into its own service
3. **GraphQL**: Instead of REST, use GraphQL for more flexible queries
4. **Monorepo**: Use Turborepo to share code between web and mobile
5. **Analytics**: Add analytics from day one to understand user behavior
6. **Feature Flags**: Implement feature flags for gradual rollouts

But overall, I'm happy with the architecture. The offline-first approach and clean separation of concerns make it easy to maintain and extend."

---

### Behavioral Questions

**Q: Tell me about this project.**
**A:** "FamilyCareHealth is a mobile health management app I built to solve a real problem I observed - families struggling to keep track of medical records, prescriptions, and appointments.

**The Problem**: Medical documents pile up, handwriting is hard to read, and it's difficult to track medications across family members.

**My Solution**: A mobile app that:
1. Scans medical documents using AI to extract key information
2. Tracks medications with reminders
3. Manages appointments
4. Supports multiple family members

**Technical Implementation**:
- Built with React Native (Expo) for cross-platform support
- Used TypeScript for type safety
- Implemented offline-first architecture for reliability
- Integrated AI (Google Gemini) for document analysis
- Used Supabase for backend (database, auth, serverless functions)

**Results**:
- 18,600+ lines of code
- 15 screens, 26 components
- AI analysis costs <$0.001 per document
- Fully functional offline

This project taught me full-stack mobile development, backend integration, AI APIs, and the importance of user-centered design."

---

**Q: What did you learn from building this?**
**A:** "I learned several valuable lessons:

**1. Technical Skills**
- Mobile app architecture (React Native, Expo)
- State management (Zustand)
- Database design (PostgreSQL, RLS)
- AI integration (OpenRouter API)
- TypeScript for large codebases

**2. Product Thinking**
- Prioritize features (MVP vs. nice-to-have)
- Consider user privacy and security first
- Offline-first design for better UX
- Cost optimization (AI API costs)

**3. Problem-Solving**
- iOS container path changes → relative paths
- Large image files → compression
- Expensive APIs → cheaper alternatives
- Slow loading → caching strategy

**4. Trade-offs**
- Local storage vs. cloud storage
- Cost vs. accuracy (AI models)
- Development speed vs. custom solutions
- Security vs. convenience

The most important lesson: always think from the user's perspective. Health data is sensitive and personal - security and privacy can't be afterthoughts."

---

**Q: How did you handle setbacks or bugs?**
**A:** "One example: I spent hours debugging why the app crashed when uploading PDFs.

**The Problem**: PDF files weren't being read correctly, causing the app to crash.

**My Approach**:
1. **Reproduced** the bug consistently
2. **Isolated** the issue to the file reading logic
3. **Researched** React Native PDF libraries and their limitations
4. **Found** that I needed to handle PDF mime types differently than images
5. **Implemented** separate handling for PDFs vs. images
6. **Tested** with various PDF types to ensure it worked

**What I Learned**:
- Always check library documentation thoroughly
- Test with diverse inputs, not just happy paths
- Error boundaries are critical for graceful degradation
- Add comprehensive logging for debugging

This systematic approach helps me tackle bugs efficiently."

---

## Part 6: Quick Reference Cheat Sheet

### Technologies Used

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **React Native** | Mobile app framework | Cross-platform, JavaScript-based, large community |
| **Expo** | React Native tooling | Simplified setup, EAS builds, OTA updates |
| **TypeScript** | Programming language | Type safety, fewer bugs, better autocomplete |
| **Zustand** | State management | Simpler than Redux, great TypeScript support |
| **Supabase** | Backend (BaaS) | PostgreSQL, RLS, auth, edge functions, open source |
| **OpenRouter** | AI API gateway | Access to multiple models, cost-effective |
| **React Navigation** | Navigation | Most popular, flexible, well-documented |
| **AsyncStorage** | Local storage | Persistent key-value store for caching |
| **Expo File System** | File storage | Save and retrieve files locally |

---

### Key Numbers to Remember

- **18,600+** lines of TypeScript code
- **15** screens in mobile app
- **26** reusable components
- **7** Zustand stores
- **6** database tables
- **5** documents/day upload limit
- **$0.0004** cost per AI analysis
- **<2 seconds** cold start time
- **<100ms** screen navigation (cached)
- **iOS 18.6+** minimum version
- **Android SDK 34+** minimum version

---

### File Structure Landmarks

```
mobile/
├── src/
│   ├── screens/          → 15 screens (UI)
│   ├── components/       → 26 reusable components
│   ├── store/            → 7 Zustand stores (state)
│   ├── services/         → Supabase client, AI service
│   ├── types/            → TypeScript interfaces
│   ├── utils/            → Helper functions
│   └── constants/        → Design tokens (colors, typography)
├── supabase/
│   ├── functions/        → Edge Functions (AI analysis)
│   └── migrations/       → Database schema
├── App.tsx               → Root component (navigation setup)
└── app.config.js         → Expo configuration
```

---

### Core Concepts to Explain Clearly

1. **Offline-First**: App works without internet by caching data locally
2. **Row Level Security**: Database enforces who can see what data
3. **Edge Functions**: Serverless functions that run on Supabase's servers
4. **State Management**: Centralized data store that screens can access
5. **Type Safety**: TypeScript prevents many bugs by catching type errors
6. **AI Document Analysis**: Extract health data from images using AI
7. **Rate Limiting**: Prevent abuse by limiting uploads per user
8. **Cache-First Loading**: Show cached data instantly, fetch fresh data in background

---

## Part 7: Practice Exercise

### Mock Interview Roleplay

**Interviewer: "Tell me about your FamilyCareHealth project."**

**Your Answer (Template):**
"FamilyCareHealth is a mobile health management app I built to help families digitize and manage medical records. The app has three core features:

1. **AI Document Analysis**: Users can scan prescriptions and lab reports, and the app extracts medications, vital signs, and diagnoses automatically using Google Gemini AI.

2. **Medication Tracking**: The app maintains a medication list (including AI-extracted ones) and provides reminders for each family member.

3. **Health Metrics**: Users can track vitals like blood pressure, glucose, and weight over time.

I built it with React Native and TypeScript for the mobile app, Supabase for the backend, and implemented an offline-first architecture so it works without internet. The AI analysis costs less than a penny per document by using OpenRouter instead of expensive APIs.

The project has about 18,600 lines of code across 15 screens and taught me full-stack mobile development, backend integration, and AI API usage."

---

### Common Pitfalls to Avoid

❌ **DON'T SAY**: "I used AI to build everything."
✅ **DO SAY**: "I leveraged AI tools to accelerate development, but I wrote and understand all the code. I can explain any part of the architecture."

❌ **DON'T SAY**: "I just followed tutorials."
✅ **DO SAY**: "I researched best practices and adapted them to my specific needs. For example, I chose Zustand over Redux after comparing their approaches."

❌ **DON'T SAY**: "I don't know, I just copied it."
✅ **DO SAY**: "Let me walk you through that section. It handles [specific functionality] by [explanation]."

❌ **DON'T SAY**: "This was the only way to do it."
✅ **DO SAY**: "I considered multiple approaches and chose this because [reasons]. Trade-offs include [pros and cons]."

---

## Part 8: Deep Dive Topics (If Asked)

### How React Native Works Internally

**Simple Explanation:**
React Native has three threads:

1. **JavaScript Thread**: Runs your React code
2. **Native Thread**: Runs iOS/Android UI
3. **Bridge**: Passes messages between JavaScript and Native

When you write `<View>`, React Native translates it to `UIView` (iOS) or `android.view.View` (Android).

**New Architecture** (which you enabled):
- **JSI** (JavaScript Interface): Direct access from JS to native (no bridge)
- **Fabric**: New rendering system (faster UI updates)
- **TurboModules**: New native module system (lazy loading)

---

### How Zustand Works Internally

**Simple Explanation:**
Zustand uses React's Context API and hooks under the hood:

```typescript
// Simplified version
const create = (createState) => {
  let state;
  const listeners = new Set();

  const setState = (partial) => {
    state = { ...state, ...partial };
    listeners.forEach(listener => listener());
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  state = createState(setState);

  return {
    getState: () => state,
    setState,
    subscribe,
  };
};
```

When you call `setState`, it notifies all subscribed components to re-render.

---

### How Supabase Authentication Works

**Flow:**
1. User enters email/password
2. Supabase returns JWT (JSON Web Token)
3. JWT stored in AsyncStorage
4. JWT included in all API requests (Authorization header)
5. Supabase verifies JWT before allowing database access
6. JWT auto-refreshes before expiration

**JWT Structure:**
```json
{
  "sub": "user-id-123",
  "email": "user@example.com",
  "role": "authenticated",
  "iat": 1234567890,
  "exp": 1234571490
}
```

---

### How AI Document Analysis Works

**Step-by-Step:**

1. **Image Capture**: User takes photo (expo-camera) or picks from library
2. **Compression**: `expo-image-manipulator` reduces size (quality: 0.8)
3. **Base64 Encoding**: Convert to text format for API transmission
4. **API Call**: Send to Supabase Edge Function
5. **Edge Function**: Forwards to OpenRouter with prompt
6. **OpenRouter**: Routes to Google Gemini 2.5 Flash
7. **AI Processing**: Vision model analyzes image and extracts text/data
8. **Structured Output**: AI returns JSON with medications, vitals, etc.
9. **Database Save**: Store in Postgres JSONB column
10. **UI Update**: Display results in app

**Prompt Engineering:**
The prompt is stored as an environment secret in Supabase. It instructs the AI to:
- Extract patient demographics
- Identify vital signs with units
- List medications with dosage
- Summarize findings in plain language
- Return JSON in a specific format

---

## Part 9: Final Tips

### Before the Interview

1. **Run the app**: Make sure it works on your device
2. **Practice explaining**: Talk through features out loud
3. **Review code**: Read through key files (stores, screens, services)
4. **Prepare questions**: Have 2-3 questions about the company ready
5. **Rehearse answers**: Practice common questions above

### During the Interview

1. **Be honest**: If you don't know something, say "I don't know, but here's how I'd find out"
2. **Show enthusiasm**: Talk about what you enjoyed building
3. **Explain trade-offs**: Show you understand pros and cons
4. **Use examples**: Reference specific code from your project
5. **Think out loud**: Share your thought process

### Red Flags to Avoid

❌ Memorizing answers word-for-word (be natural)
❌ Saying "I don't know" without elaborating
❌ Pretending you built everything from scratch
❌ Being unable to explain technology choices
❌ Not knowing basic concepts (what is TypeScript, what is a database)

### Green Flags to Demonstrate

✅ Understanding the "why" behind decisions
✅ Knowing trade-offs and alternatives
✅ Being able to walk through code
✅ Showing continuous learning
✅ Discussing challenges and how you overcame them

---

## Part 10: Homework Assignments

Before your interview, do these exercises:

### Exercise 1: Explain to a Non-Technical Person
Practice explaining your app to someone who doesn't know programming. Use analogies:
- "Zustand is like a central filing cabinet that all parts of the app can access"
- "Offline-first is like downloading a map before a road trip so you don't need internet"

### Exercise 2: Draw the Architecture
On paper, draw:
1. The flow from user login to viewing a document
2. The AI analysis pipeline
3. The database schema with relationships

### Exercise 3: Code Walkthrough
Pick a complex file (like `documentsStore.ts`) and explain each function out loud as if teaching someone.

### Exercise 4: What's Next?
Prepare an answer for "What would you add next?" with specific features:
- Real-time medication reminders with push notifications
- Health trend charts using Recharts
- Export health reports as PDF
- Integration with Apple Health/Google Fit

---

## Conclusion

You've built a **production-ready, full-stack mobile application** that demonstrates:

- **Frontend skills**: React Native, TypeScript, state management
- **Backend skills**: Database design, API integration, serverless functions
- **AI integration**: Document analysis, structured data extraction
- **Product thinking**: Offline-first, privacy, cost optimization
- **Problem-solving**: Technical challenges, performance optimization

**Key message for your interview:**
"I built FamilyCareHealth to solve a real problem, learned modern mobile development along the way, and created a functional app with AI-powered features while keeping costs low and user privacy paramount. I'm excited to bring these skills to your team and continue learning."

---

**Good luck with your interview! 🚀**

You've got this. You built a real app with real features. Be confident, be honest, and show your passion for learning and building.