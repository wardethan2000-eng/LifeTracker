# LifeKeeper Mobile App — Development Plan

> **Platform:** Android-first (Expo/React Native)  
> **Status:** Planning  
> **Last updated:** 2026-03-27

---

## Table of Contents

1. [Vision & Design Philosophy](#vision--design-philosophy)
2. [Architecture Decisions](#architecture-decisions)
3. [App Structure](#app-structure-expo-router)
4. [Offline-First Architecture](#offline-first-architecture)
5. [API Client Layer](#api-client-layer)
6. [Authentication](#authentication)
7. [Theming & UI](#theming--ui)
8. [Phase 0 — Foundation](#phase-0--foundation)
9. [Phase 1 — Core Capture Workflows](#phase-1--core-capture-workflows)
10. [Phase 2 — Entity Browse & Detail](#phase-2--entity-browse--detail)
11. [Phase 3 — Notifications, Sync & Polish](#phase-3--notifications-sync--polish)
12. [Phase 4 — Advanced Features & Web Parity](#phase-4--advanced-features--web-parity)
13. [Key Files Reference](#key-files-reference)
14. [Decisions & Constraints](#decisions--constraints)
15. [Open Questions](#open-questions)

---

## Vision & Design Philosophy

The LifeKeeper mobile app is a **capture-first companion** to the web dashboard. The web dashboard is the analytics, management, and configuration surface. The mobile app optimizes for speed of input when the user is physically with the thing they're tracking — in the garage, at the workbench, in the field.

### Core Principles

#### 1. Capture-First, Not Dashboard-First

Every interaction should minimize time-to-record:

- **One-tap logging** — mark maintenance done, log a hobby session, take a quick note
- **Camera-native** — photos attach to any entity; barcode scans resolve instantly
- **Voice-to-text** — system keyboard dictation for notes (no custom speech-to-text needed)
- **Minimal form friction** — smart defaults, recent selections, preset suggestions
- **Quick Capture tab** — always one tap from any screen to create a note attached to any entity

#### 2. Offline-Resilient

Field use (garage, workshop, attic, marina, shed) often means spotty or no connectivity:

- All reads serve from local cache
- All writes queue locally and sync when online
- The user should **never** see a blocking spinner that prevents capture
- Pending mutations are visible ("3 changes waiting to sync")
- Sync happens automatically and silently when connectivity returns

#### 3. Consistent but Native

- Same data model and domain language as the web app
- UI follows native Android conventions: bottom tab bar, swipe gestures, FAB for primary action, Material Design components
- Not a web wrapper — a native experience that feels right on Android
- Shared Zod schemas from `@lifekeeper/types` validate all API responses — zero type duplication

#### 4. Progressive Disclosure

- Show what's needed now, hide what's not
- Asset detail starts with the overview card; tap to expand schedules, history, inventory links
- Global search is always one tap away
- Settings and analytics are accessible but not prominent
- Lists load incrementally; detail screens expand on demand

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | **Expo SDK 52+** | Already scaffolded in `apps/mobile/`. Managed workflow, OTA updates, native module support via config plugins. |
| Navigation | **Expo Router** | File-based routing mirrors the Next.js web app conventions. Automatic deep linking for QR scans. Built on React Navigation internally. |
| UI Framework | **React Native Paper** | Material Design 3 components (buttons, inputs, cards, dialogs, FABs, search bars, chips, menus). Themed to LifeKeeper's palette. Dramatically faster than building every component from scratch. |
| State & Cache | **TanStack Query (React Query)** | Server state cache with background refetch, stale-while-revalidate, optimistic updates, and built-in offline persistence support. |
| Offline Reads | **React Query `persistQueryClient`** + **AsyncStorage** | Entire query cache serialized to disk. App boots with stale data instantly, then revalidates in background. |
| Offline Writes | **MMKV mutation queue** | Custom queue stores pending mutations in MMKV (fast synchronous KV store). Flushes in order when connectivity returns. |
| Auth | **Clerk Expo SDK** + `x-dev-user-id` bypass | Matches the API's existing hybrid auth. Development mode requires zero sign-in friction. |
| Fast KV Store | **MMKV** | Synchronous reads/writes for mutation queue, user preferences, recent searches. 30x faster than AsyncStorage for small values. |
| Build & Deploy | **EAS Build** + **EAS Update (OTA)** | Cloud builds with managed signing. Over-the-air JS updates push without Play Store review. Free tier available. |
| Shared Types | **`@lifekeeper/types`** (workspace) | Zod schemas validate API responses on mobile. Same contract as the web app. |
| Camera & Media | **expo-camera** + **expo-image-picker** + **expo-image-manipulator** | Barcode scanning (already working), photo capture from camera/gallery, client-side compression before upload. |
| File System | **expo-file-system** | Offline photo storage before upload. Document directory for cached media. |
| Push Notifications | **expo-notifications** + **FCM** (Firebase Cloud Messaging) | Push notifications for maintenance due/overdue, reminders, and digest summaries. |
| Network Detection | **`@react-native-community/netinfo`** | Detect connectivity changes to trigger mutation queue flush and background refetch. |
| Gestures | **react-native-reanimated** + **react-native-gesture-handler** | Swipe-to-complete, pull-to-refresh, and smooth animations. |
| Biometric Auth | **expo-local-authentication** | Optional fingerprint/face unlock for app access. Low effort, good security. |

---

## App Structure (Expo Router)

Expo Router uses file-based routing — each file in `app/` becomes a route. Layout files (`_layout.tsx`) define navigation containers (stacks, tabs).

```
apps/mobile/
├── app.config.ts                        # Expo config (dynamic, replaces app.json)
├── eas.json                             # EAS Build profiles (dev, preview, prod)
├── package.json
├── tsconfig.json
│
├── app/
│   ├── _layout.tsx                      # Root layout: ClerkProvider, QueryClientProvider,
│   │                                    #   PaperProvider, OfflineSyncProvider, auth gate
│   ├── (auth)/
│   │   ├── _layout.tsx                  # Auth stack (no tabs, minimal chrome)
│   │   ├── sign-in.tsx                  # Clerk sign-in screen
│   │   └── sign-up.tsx                  # Clerk sign-up screen
│   │
│   ├── (tabs)/
│   │   ├── _layout.tsx                  # Bottom tab navigator (5 tabs)
│   │   ├── index.tsx                    # Home — due items, quick actions, recent activity
│   │   ├── scan.tsx                     # Scan — barcode/QR camera
│   │   ├── search.tsx                   # Search — global full-text search
│   │   ├── capture.tsx                  # Capture — quick note/photo with entity selector
│   │   └── more.tsx                     # More — all domains, settings, profile
│   │
│   ├── assets/
│   │   ├── index.tsx                    # Asset list (filterable by category, status)
│   │   └── [id]/
│   │       ├── index.tsx                # Asset detail (hero, stats, overview)
│   │       ├── schedules.tsx            # Maintenance schedules
│   │       ├── history.tsx              # Timeline / activity log
│   │       ├── notes.tsx                # Journal entries for this asset
│   │       ├── inventory.tsx            # Linked parts & consumables
│   │       └── photos.tsx               # Photo gallery / attachments
│   │
│   ├── entries/
│   │   ├── index.tsx                    # All notes/entries feed (chronological)
│   │   ├── new.tsx                      # Quick entry creation (also reachable from Capture tab)
│   │   └── [id].tsx                     # Entry detail / edit
│   │
│   ├── projects/
│   │   ├── index.tsx                    # Project list with status pills
│   │   └── [id]/
│   │       ├── index.tsx                # Project detail (overview, phases, budget)
│   │       ├── tasks.tsx                # Task list with checkboxes
│   │       └── notes.tsx                # Project notes
│   │
│   ├── hobbies/
│   │   ├── index.tsx                    # Hobby list with status pills
│   │   └── [id]/
│   │       ├── index.tsx                # Hobby detail (sessions, goals, streaks)
│   │       ├── sessions.tsx             # Session list + quick log form
│   │       └── notes.tsx                # Hobby notes
│   │
│   ├── ideas/
│   │   ├── index.tsx                    # Ideas list with status pills
│   │   └── [id].tsx                     # Idea detail (notes, promote action)
│   │
│   ├── inventory/
│   │   ├── index.tsx                    # Inventory list (low-stock indicators)
│   │   ├── [id].tsx                     # Item detail (quantity, location, linked assets)
│   │   └── spaces/
│   │       ├── index.tsx                # Space tree (hierarchical navigation)
│   │       └── [id].tsx                 # Space contents (items within this space)
│   │
│   ├── notifications/
│   │   └── index.tsx                    # Notification center (list, mark read, badge)
│   │
│   └── settings/
│       ├── index.tsx                    # Settings menu
│       ├── profile.tsx                  # User profile
│       ├── household.tsx                # Household management (members, invites)
│       └── preferences.tsx              # Display & notification preferences
│
├── components/                          # Shared UI components
│   ├── EntityCard.tsx                   # Reusable card for any entity in lists
│   ├── StatusPill.tsx                   # Status badge matching web's pill system
│   ├── EmptyState.tsx                   # Empty list/grid fallback
│   ├── QuickAction.tsx                  # Tappable action button/card
│   ├── OfflineBanner.tsx                # "X changes pending sync" indicator
│   ├── PhotoGrid.tsx                    # Attachment photo gallery grid
│   ├── EntitySelector.tsx               # Picker for choosing asset/project/hobby/idea
│   ├── FlagChips.tsx                    # Entry flag chips (important, actionable, etc.)
│   ├── SkeletonCard.tsx                 # Loading placeholder
│   └── BarcodeScanner.tsx               # Refactored from existing (expo-camera)
│
├── hooks/                               # Custom React hooks
│   ├── useOfflineSync.ts                # Network listener + mutation queue flush
│   ├── useAuth.ts                       # Clerk auth state wrapper
│   ├── useDueItems.ts                   # Fetch due/overdue schedules and tasks
│   └── useEntitySearch.ts               # Search with debounce and recent history
│
└── lib/                                 # Non-React utilities
    ├── api.ts                           # Full typed API client (mirrors web's api.ts)
    ├── theme.ts                         # React Native Paper theme (LifeKeeper palette)
    ├── query-client.ts                  # TanStack Query config + offline persistence
    ├── offline-queue.ts                 # MMKV mutation queue (enqueue, flush, retry)
    ├── scan.ts                          # Barcode/QR scan resolution (existing, enhanced)
    ├── storage.ts                       # MMKV instance + AsyncStorage helpers
    └── constants.ts                     # API base URL, dev user ID, feature flags
```

### Bottom Tab Bar (5 Tabs)

| Tab | Icon | Purpose | Priority |
|-----|------|---------|----------|
| **Home** | house | Due items, quick actions, recent activity | Shows what needs attention now |
| **Scan** | camera | Camera for barcode/QR scanning | Core mobile-native feature |
| **Capture** | pencil | Quick note/photo creation | Fastest path to record data |
| **Search** | magnifying-glass | Global full-text search + typeahead | Find anything instantly |
| **More** | menu | All domains, settings, profile | Everything else |

The **Capture** tab is center-positioned and visually prominent (FAB-style or enlarged icon) since fast data entry is the app's primary value proposition.

---

## Offline-First Architecture

### Read Path (Query Cache)

```
User opens screen
  → TanStack Query checks cache
    → Cache hit (stale OK)? → Render immediately, refetch in background
    → Cache miss? → Show skeleton, fetch from API, cache result
  → On app launch: hydrate cache from AsyncStorage (persistQueryClient)
```

**Configuration:**
- `staleTime`: 5 minutes for most queries (lists, details)
- `gcTime` (garbage collection): 24 hours — keep data available offline for a full day
- `retry`: 2 retries with exponential backoff
- `refetchOnReconnect`: true — refresh stale data when connectivity returns

### Write Path (Mutation Queue)

```
User creates/updates/deletes entity
  → Optimistic update in query cache (immediate UI feedback)
  → Mutation serialized to MMKV queue: { id, method, path, body, timestamp }
  → If online: flush immediately (FIFO order)
  → If offline: queue persists, show "X pending" banner
  → On reconnect (NetInfo listener): flush queue sequentially
    → Success: remove from queue, invalidate related queries
    → Failure (4xx): mark as failed, surface to user for retry/discard
    → Failure (5xx/network): back off, retry on next connectivity event
```

**Mutation Queue Schema (MMKV):**
```typescript
interface QueuedMutation {
  id: string;                    // UUID for deduplication
  method: "POST" | "PATCH" | "DELETE";
  path: string;                  // API path, e.g. "/v1/households/:id/entries"
  body?: unknown;                // Request payload
  timestamp: number;             // Enqueue time (for ordering and staleness)
  entityType: string;            // For optimistic cache invalidation
  entityId?: string;             // For optimistic cache updates
  status: "pending" | "failed";  // Failed items surface to user
  retryCount: number;
}
```

**Conflict Resolution:** Last-write-wins for single-field updates. The server timestamp determines the winner. For entry body edits (multi-paragraph text), if the server returns 409 (conflict), surface both versions to the user and let them choose.

### Upload Queue (Photos)

Photos follow a separate queue because they require multipart upload:

```
User takes photo
  → Save to expo-file-system document directory (persistent across app restarts)
  → Add to upload queue (MMKV): { localUri, entityType, entityId, timestamp }
  → If online: upload via createAttachmentUpload(), delete local copy on success
  → If offline: retain local copy, show in UI with "uploading" badge
  → On reconnect: flush upload queue (sequential, large files)
```

---

## API Client Layer

The mobile API client mirrors the web's `apps/web/lib/api.ts` — same method signatures, same Zod schema validation, same error handling patterns. It lives at `apps/mobile/lib/api.ts`.

### Base Request Pattern

```typescript
import { z } from "zod";

const apiBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl ?? "http://127.0.0.1:4000";

export class MobileApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function apiRequest<T>({
  path,
  method = "GET",
  body,
  schema,
}: {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  schema?: z.ZodType<T>;
}): Promise<T> {
  const token = await getAuthToken(); // Clerk or dev bypass
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(__DEV__ ? { "x-dev-user-id": devUserId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new MobileApiError(res.status, data.message ?? `Request failed: ${res.status}`);
  }

  const data = await res.json();
  return schema ? schema.parse(data) : data;
}
```

### Domain Methods (implemented incrementally by phase)

**Phase 0:**
- `getMe()` — auth state, household membership

**Phase 1 (Capture):**
- `createEntry()`, `getEntries()`, `updateEntry()`, `deleteEntry()`, `getSurfacedEntries()`
- `createAttachmentUpload()`, `deleteAttachment()`, `getAttachmentPresignedUrl()`
- `searchHousehold()`, `getSearchSuggestions()`
- `resolveScanTag()`, `lookupAssetByTag()`, `lookupBarcode()`, `getScanSpaceDetail()`
- `getHouseholdDueWork()`, `completeMaintenanceSchedule()`

**Phase 2 (Browse & Detail):**
- `getHouseholdAssets()`, `getAssetDetail()`, `updateAsset()`, `createAsset()`
- `getMaintenanceSchedules()`, `createMaintenanceSchedule()`, `updateMaintenanceSchedule()`
- `getHouseholdProjects()`, `getProjectDetail()`, `updateProjectTask()`
- `getHouseholdHobbies()`, `getHobby()`, `createHobbySession()`
- `getHouseholdIdeas()`, `getIdea()`, `createIdea()`, `promoteIdeaToProject()`
- `getHouseholdInventory()`, `getInventoryItem()`, `createInventoryTransaction()`
- `getHouseholdSpacesTree()`, `getSpaceContents()`

**Phase 3 (Notifications & Creation Forms):**
- `getHouseholdNotifications()`, `markNotificationRead()`
- `createAsset()` (full form), `createProject()`, `createHobby()`, `createInventoryItem()`
- `getLibraryPresets()`, `applyLibraryPreset()`

**Phase 4 (Advanced):**
- `getAssetComments()`, `createAssetComment()` (and other domain comments)
- `getHouseholdDashboard()`, `getScheduleCompliance()`, analytics endpoints
- `getShareLinks()`, `createShareLink()`
- `exportHouseholdAssets()`, export endpoints
- `getHouseholdMembers()`, `getHouseholdInvitations()`

---

## Authentication

### Production: Clerk Expo SDK

```typescript
// app/_layout.tsx (root layout)
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "../lib/storage"; // SecureStore-backed token cache

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache}>
      <AuthGate />
    </ClerkProvider>
  );
}

function AuthGate() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return <SplashScreen />;
  return isSignedIn ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/sign-in" />;
}
```

### Development: Bypass

When `__DEV__` is true, skip Clerk entirely and send `x-dev-user-id` header on all API requests. This matches the existing API behavior in `apps/api/src/plugins/auth.ts`.

```typescript
// lib/api.ts
const getAuthHeaders = async (): Promise<Record<string, string>> => {
  if (__DEV__) {
    return { "x-dev-user-id": DEV_USER_ID };
  }
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
```

### Optional: Biometric Lock

After initial sign-in, offer fingerprint/face unlock for returning to the app (using `expo-local-authentication`). This protects the app without requiring full re-authentication.

---

## Theming & UI

### React Native Paper Theme

Map LifeKeeper's CSS custom properties to Paper's theme tokens:

```typescript
// lib/theme.ts
import { MD3LightTheme, MD3DarkTheme } from "react-native-paper";

const lifeKeeperColors = {
  teal:       "#0d9488",
  tealDark:   "#14342b",
  cream:      "#f3efe5",
  warmWhite:  "#fffaf2",
  textLight:  "#f7f3ea",
  textMuted:  "#35554a",
  danger:     "#dc2626",
  warning:    "#f59e0b",
  success:    "#16a34a",
  info:       "#2563eb",
  border:     "#d4cfc4",
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary:           lifeKeeperColors.teal,
    primaryContainer:  lifeKeeperColors.cream,
    secondary:         lifeKeeperColors.tealDark,
    background:        lifeKeeperColors.warmWhite,
    surface:           lifeKeeperColors.cream,
    error:             lifeKeeperColors.danger,
    outline:           lifeKeeperColors.border,
    onPrimary:         lifeKeeperColors.textLight,
    onBackground:      lifeKeeperColors.tealDark,
    onSurface:         lifeKeeperColors.tealDark,
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary:           lifeKeeperColors.teal,
    primaryContainer:  "#1a3d35",
    background:        "#0a1f1a",
    surface:           "#14342b",
    error:             lifeKeeperColors.danger,
    outline:           "#2d5a4a",
    onPrimary:         lifeKeeperColors.textLight,
    onBackground:      lifeKeeperColors.textLight,
    onSurface:         lifeKeeperColors.textLight,
  },
};
```

### Status Pill Mapping

Reuse the same status-to-color mapping from the web app:

| Domain | Status | Color |
|--------|--------|-------|
| Project | `active` | success (green) |
| Project | `on_hold` | warning (amber) |
| Project | `planning` | info (blue) |
| Project | `completed` | muted (gray) |
| Project | `cancelled` | danger (red) |
| Hobby | `active` | success |
| Hobby | `paused` | warning |
| Hobby | `archived` | muted |
| Idea | `spark` | warning |
| Idea | `developing` | info |
| Idea | `ready` | success |

### Component Conventions

- Use Paper's `<Card>`, `<List.Item>`, `<Chip>`, `<FAB>`, `<Searchbar>`, `<Dialog>`, `<Banner>` as primitives
- Custom components wrapping Paper for domain-specific patterns (`EntityCard`, `StatusPill`, `EmptyState`)
- `StyleSheet.create()` for layout and spacing; Paper handles component-level styling
- No CSS — all styles are React Native `StyleSheet` objects

---

## Phase 0 — Foundation

**Goal:** Replace the current single-screen shell with real app architecture. No features — just infrastructure.

### Steps

#### 0.1 — Add Dependencies

Update `apps/mobile/package.json`:

```
New dependencies:
- expo-router
- react-native-paper
- react-native-vector-icons (Paper peer dep)
- @tanstack/react-query
- @tanstack/react-query-persist-client
- @react-native-async-storage/async-storage
- react-native-mmkv
- @clerk/clerk-expo
- expo-secure-store (Clerk token cache)
- expo-image-picker
- expo-image-manipulator
- expo-file-system
- expo-notifications
- expo-local-authentication
- expo-splash-screen
- expo-haptics
- react-native-reanimated
- react-native-gesture-handler
- react-native-safe-area-context
- react-native-screens
- @react-native-community/netinfo
```

Run `pnpm install` from monorepo root.

#### 0.2 — Convert to Expo Router

- Move from single `App.tsx` entry to `app/` directory structure
- Create `app/_layout.tsx` as root layout wrapping providers:
  ```
  ClerkProvider → QueryClientProvider → PaperProvider → OfflineSyncProvider → Slot
  ```
- Create `app/(auth)/_layout.tsx` (stack navigator, no tabs)
- Create `app/(auth)/sign-in.tsx` and `app/(auth)/sign-up.tsx`
- Create `app/(tabs)/_layout.tsx` (bottom tab navigator with 5 tabs)
- Create placeholder screens for all 5 tabs
- Update `package.json` main entry to `expo-router/entry`
- Preserve existing `App.tsx` temporarily as reference, then remove

#### 0.3 — Define Paper Theme

- Create `lib/theme.ts` with light and dark themes (see Theming section)
- Wrap app in `<PaperProvider theme={theme}>`
- Verify Paper components render with LifeKeeper colors

#### 0.4 — Build API Client Foundation

- Expand `lib/api.ts` with the base `apiRequest()` function
- Add `getMe()` as the first real endpoint
- Configure auth header injection (Clerk token or dev bypass)
- Set up `lib/constants.ts` with API base URL, dev user ID

#### 0.5 — Configure TanStack Query + Offline Persistence

- Create `lib/query-client.ts`:
  - `QueryClient` with default `staleTime` (5 min), `gcTime` (24 hours)
  - `persistQueryClient` with `createAsyncStoragePersister`
- Create `lib/storage.ts`:
  - MMKV instance for fast KV (mutation queue, preferences)
  - AsyncStorage for query cache persistence
  - SecureStore wrapper for Clerk token cache

#### 0.6 — Set Up Auth Flow

- `ClerkProvider` with `expo-secure-store` token cache
- Auth gate in `_layout.tsx`: redirect to `(auth)` or `(tabs)` based on sign-in state
- Dev bypass: when `__DEV__`, skip Clerk and inject `x-dev-user-id`
- Sign-in / sign-up screens with Clerk UI

#### 0.7 — Build Offline Mutation Queue

- Create `lib/offline-queue.ts`:
  - `enqueue(mutation)` — serialize to MMKV
  - `flush()` — process queue FIFO, remove on success
  - `getPendingCount()` — for banner display
  - `getFailedMutations()` — for user-facing retry/discard
- Create `hooks/useOfflineSync.ts`:
  - Listen to NetInfo connectivity changes
  - On reconnect: call `flush()`
  - Expose `pendingCount` and `isOnline` to UI
- Create `components/OfflineBanner.tsx`:
  - "3 changes waiting to sync" banner, shown when `pendingCount > 0`

#### 0.8 — Configure EAS Build

- Create `eas.json` with profiles:
  - `development` — dev client, internal distribution
  - `preview` — staging build, internal distribution
  - `production` — Play Store build
- Create/update `app.config.ts`:
  - Android package: `com.lifekeeper.app`
  - Splash screen, adaptive icon
  - Runtime version policy for OTA updates
  - Extra config for API base URL per environment

### Verification

- [ ] `pnpm --filter @lifekeeper/mobile dev` → opens in Expo Dev Client
- [ ] App boots → auth gate → sign-in (or dev bypass) → empty tab bar with 5 tabs
- [ ] Paper components render with LifeKeeper teal/cream theme
- [ ] `getMe()` call succeeds and returns user/household data
- [ ] React Query cache persists across app restart (kill + relaunch)
- [ ] Toggle airplane mode → "pending sync" banner logic works (no mutations yet, but infrastructure is ready)
- [ ] `pnpm --filter @lifekeeper/mobile typecheck` passes

---

## Phase 1 — Core Capture Workflows

**Goal:** The 5 things the user will do most on mobile — all working, all offline-capable.

### 1A: Quick Note/Entry Capture

The most frequent mobile action: "I want to write something down about this thing."

**Capture Tab (`(tabs)/capture.tsx`):**
- Full-screen text input (auto-focused on tab select)
- Entity selector dropdown: pick asset, project, hobby, idea, or standalone
- Entry type selector: note, observation, measurement, lesson, decision, issue
- Flag chips: important, actionable, pinned, tip, warning
- "Save" button queues to offline mutation queue → `createEntry()`
- After save: brief success feedback, input clears, ready for next capture

**Entry List (`entries/index.tsx`):**
- Chronological feed of all entries across all entity types
- Filter by: entity type, flag, date range, search text
- Pull-to-refresh
- Tap entry → detail/edit screen

**Entry on Entity Detail Screens:**
- Every entity detail screen (asset, project, hobby, idea) has an "Add note" FAB or inline button
- Pre-fills the entity selector; user just types and saves

**API Methods:**
- `createEntry()`, `getEntries()`, `updateEntry()`, `deleteEntry()`
- `getSurfacedEntries()` — entries tied to specific entity

**Offline Behavior:**
- Create entry works offline (queued in MMKV)
- Entry list shows both cached server entries and locally-created pending entries
- Pending entries show subtle "syncing" indicator

### 1B: Photo Capture & Upload

**Camera Integration:**
- `expo-image-picker` for camera capture and gallery selection
- `expo-image-manipulator` compresses to ~500KB JPEG before upload
- Photos can be attached to: assets, entries, projects, hobbies, inventory items

**Attach to Any Entity:**
- "Add photo" button on every entity detail screen
- Takes photo → compresses → creates `Attachment` record via `createAttachmentUpload()`
- Can also pick existing photos from gallery

**Photo Gallery (`assets/[id]/photos.tsx` and equivalent):**
- Grid of attachment thumbnails
- Tap to view full-size (lightbox-style)
- Long-press to delete

**Offline Behavior:**
- Photo saved to `expo-file-system` document directory
- Upload queued separately from regular mutation queue (large files)
- Photos appear in gallery immediately with "uploading" badge
- Upload starts automatically when online
- Local copy deleted only after successful upload confirmation

**API Methods:**
- `createAttachmentUpload()` — multipart form upload
- `deleteAttachment()`
- `getAttachmentPresignedUrl()` — for viewing uploaded photos

### 1C: Global Search

**Search Tab (`(tabs)/search.tsx`):**
- Persistent search bar (auto-focused on tab select)
- Typeahead suggestions as user types (debounced 300ms)
- Results grouped by domain: Assets, Projects, Hobbies, Inventory, Entries, Ideas
- Each result shows: name, entity type icon, brief context (category, status, date)
- Tap result → navigate to entity detail screen

**Recent Searches:**
- Last 20 searches stored in MMKV
- Shown below search bar when input is empty
- Tap recent → re-execute search

**Offline Behavior:**
- Search requires connectivity (server-side full-text index)
- When offline: show "Search requires internet" message + recent searches

**API Methods:**
- `searchHousehold(householdId, query)` — full-text search
- `getSearchSuggestions()` — typeahead

### 1D: Barcode Scanning (enhanced)

Refactor the existing BarcodeScanner component into the Expo Router structure with richer post-scan flows.

**Scan Tab (`(tabs)/scan.tsx`):**
- Full-screen camera with scan overlay (reuse existing `BarcodeScanner` component)
- Supported formats: QR, UPC-A, UPC-E, EAN-8, EAN-13, Code128, Code39

**Post-Scan Routing (via existing `lib/scan.ts` logic):**
- `LK-XXXXXXXX` tag → fetch asset → navigate to `assets/[id]`
- Asset URL (from QR) → extract ID → navigate to `assets/[id]`
- Space tag → fetch space → navigate to `inventory/spaces/[id]`
- Product barcode (UPC/EAN/etc.) → lookup via `lookupBarcode()` → show product info with actions:
  - "Create inventory item" (pre-filled with product data)
  - "Link to asset" (attach barcode to existing asset)
  - "Scan another"

**Scan from Anywhere:**
- Header action button on asset list and inventory list screens opens scanner
- After scan resolves, navigates to the relevant screen

**Photo-Based Barcode:**
- "Can't scan? Take a photo" option → `uploadBarcodeImage()` for server-side recognition

**API Methods:**
- `resolveScanTag()`, `lookupAssetByTag()` — existing
- `lookupBarcode()` — existing
- `getScanSpaceDetail()`, `getScanSpaceSummary()` — existing
- `uploadBarcodeImage()` — existing

### 1E: Maintenance Quick-Complete

**Home Tab Due Items:**
- Section "Due & Overdue" at top of home screen
- Cards showing: asset name, schedule name, due date, overdue indicator
- One-tap "Done" button per item
- Optional: tap to expand for note + photo before completing

**Complete Flow:**
- Tap "Done" → `completeMaintenanceSchedule()` → optimistic UI (card moves to "completed today")
- Optional note + photo attached to the completion log entry

**Asset Detail → Schedules Tab:**
- List of all maintenance schedules for the asset
- Status pills: on-time (green), due-soon (amber), overdue (red), completed (gray)
- Tap schedule → expand details (trigger info, last completed, next due)
- "Mark Done" button inline

**API Methods:**
- `getHouseholdDueWork(householdId)` — due/overdue schedules and tasks
- `completeMaintenanceSchedule(assetId, scheduleId)` — mark done + create log
- `getMaintenanceSchedules(assetId)` — all schedules for asset

**Offline Behavior:**
- Completion queued offline; optimistic UI moves item to "completed"
- Due items list cached from last fetch

### Phase 1 Verification

- [ ] Create a note on mobile → appears on web dashboard within seconds (or after sync)
- [ ] Take a photo, attach to asset → visible on web's asset detail photos
- [ ] Search "lawn mower" → asset appears → tap → navigates to asset detail
- [ ] Scan QR code → resolves to correct asset → shows detail screen
- [ ] Scan product barcode → shows product info with "Create inventory item" action
- [ ] Mark maintenance as done → schedule status updates → completion log created
- [ ] All above work offline (queue and sync on reconnect)

---

## Phase 2 — Entity Browse & Detail

**Goal:** View all domain entities in lists, view details, and edit key fields inline. The mobile app becomes a full read layer with light editing.

### 2A: Assets

**Asset List (`assets/index.tsx`):**
- Scrollable list of all household assets
- Filter chips: category (vehicle, home, appliance, etc.), archived/active
- Sort: name, category, last maintained, created
- Pull-to-refresh
- FAB: "+" → navigate to create asset (Phase 3)

**Asset Detail (`assets/[id]/index.tsx`):**
- Hero section: name, photo, category badge, asset tag (scannable)
- Stats row: schedule count, overdue count, condition rating
- Overview cards: purchase details, warranty, location, insurance
- Inline edit: tap field to edit (name, description, serial number, etc.)
- Sub-screen navigation: Schedules, History, Notes, Inventory, Photos

**Asset Sub-Screens:**
- `schedules.tsx` — maintenance schedules with status, complete inline
- `history.tsx` — activity timeline (logs, entries, condition changes)
- `notes.tsx` — journal entries filtered to this asset
- `inventory.tsx` — linked parts/consumables with quantities
- `photos.tsx` — attachment gallery with add/delete

**API Methods:**
- `getHouseholdAssets()`, `getAssetDetail()`, `updateAsset()`, `archiveAsset()`, `unarchiveAsset()`
- `getMaintenanceSchedules()`, `completeMaintenanceSchedule()`
- `getAssetInventoryLinks()`, `addAssetInventoryLink()`, `removeAssetInventoryLink()`
- `getSurfacedEntries(householdId, { entityType: "asset", entityId })`

### 2B: Projects

**Project List (`projects/index.tsx`):**
- Status pills (planning, active, on_hold, completed, cancelled)
- Filter by status
- Sort: name, status, created, target date

**Project Detail (`projects/[id]/index.tsx`):**
- Overview: name, status pill, description, date range, budget summary
- Phase list with progress indicators
- Quick stats: tasks completed/total, budget spent/total

**Tasks Sub-Screen (`projects/[id]/tasks.tsx`):**
- Checkbox list grouped by phase
- Tap checkbox → toggle task completion (`updateProjectTask()`)
- Swipe right on task → mark complete
- Task details: assignee, due date, priority

**API Methods:**
- `getHouseholdProjects()`, `getProjectDetail()`, `updateProject()`
- `updateProjectTask()` — toggle completion, update checklist items
- `createProjectExpense()` — log expenses on the go

### 2C: Hobbies

**Hobby List (`hobbies/index.tsx`):**
- Status pills (active, paused, archived)
- Recent session date and streak indicator

**Hobby Detail (`hobbies/[id]/index.tsx`):**
- Overview: name, type, description, current streak, total sessions
- Goals section: active practice goals with progress bars
- Recent sessions list

**Sessions Sub-Screen (`hobbies/[id]/sessions.tsx`):**
- Session list (date, duration, notes preview)
- **"Log Session" FAB** — quick form:
  - Date (defaults to now)
  - Duration (picker or manual)
  - Notes (text input)
  - Optional: recipe selection, metrics
  - Save queues offline

**API Methods:**
- `getHouseholdHobbies()`, `getHobby()`, `updateHobby()`
- `createHobbySession()`, `updateHobbySession()`
- `getHobbyAnalyticsOverview()` — streaks, frequency

### 2D: Ideas

**Ideas List (`ideas/index.tsx`):**
- Status pills (spark, developing, ready)
- Sort: created, status, updated

**Idea Detail (`ideas/[id].tsx`):**
- Title, body, status, tags
- Notes section (entries for this idea)
- **"Promote to Project" action** — `promoteIdeaToProject()` with confirmation

**API Methods:**
- `getHouseholdIdeas()`, `getIdea()`, `createIdea()`, `updateIdea()`
- `promoteIdeaToProject()`

### 2E: Inventory

**Inventory List (`inventory/index.tsx`):**
- Items with quantity, location, low-stock warning badge
- Filter: category, low stock only, space
- Sort: name, quantity, last consumed

**Item Detail (`inventory/[id].tsx`):**
- Quantity display (prominent)
- Location (linked space)
- Linked assets
- Transaction history (purchases, consumptions, adjustments)
- **Quick actions:** "Consume" (decrement), "Adjust" (set quantity), "Transfer" (move to space)

**Spaces Tree (`inventory/spaces/index.tsx`):**
- Hierarchical tree: Building → Room → Area → Shelf → Bin
- Tap space → see contents
- Scan space QR → jump directly to space contents

**Space Contents (`inventory/spaces/[id].tsx`):**
- List of inventory items in this space
- General items (non-tracked)
- Quick consume/adjust from this view

**API Methods:**
- `getHouseholdInventory()`, `getInventoryItem()`, `updateInventoryItem()`
- `createInventoryTransaction()` — consume, adjust, transfer, correct
- `getHouseholdSpacesTree()`, `getSpaceContents()`
- `getSpaceByShortCode()` — for QR scan → space lookup

### Phase 2 Verification

- [ ] Asset list loads, filters by category, pull-to-refresh works
- [ ] Asset detail shows all data, inline edit saves correctly
- [ ] Project task checkbox toggles work, optimistic update is instant
- [ ] Hobby session logged on mobile → appears in web's session list
- [ ] Idea promoted to project → project created on web
- [ ] Inventory item consumed → quantity decrements on web
- [ ] Space QR scanned → navigates to space contents
- [ ] All lists render from cache when offline

---

## Phase 3 — Notifications, Sync & Polish

**Goal:** Push notifications, reliable offline sync, production-quality UX, and full entity creation forms.

### 3A: Push Notifications

**Infrastructure Required (API side):**
- New Prisma model `DeviceToken`: `{ id, userId, token, platform, createdAt }`
- New API endpoint: `POST /v1/devices/register` and `DELETE /v1/devices/:id`
- FCM adapter in notification worker (`apps/api/src/workers/`) — send push alongside email
- Notification payload includes deep link URL for mobile navigation

**Mobile Implementation:**
- `expo-notifications` for receiving and displaying push notifications
- Register FCM token on sign-in → `POST /v1/devices/register`
- Unregister on sign-out
- Notification handler: parse deep link → navigate to entity

**Notification Center (`notifications/index.tsx`):**
- List of notifications (due soon, due, overdue, announcements)
- Swipe to mark read
- Badge count on tab bar
- Tap notification → deep link to entity

**Deep Link Mapping:**

| Notification Type | Deep Link |
|---|---|
| `due_soon` / `due` / `overdue` | `/assets/[assetId]/schedules` |
| `inventory_low_stock` | `/inventory/[itemId]` |
| `note_reminder` | `/entries/[entryId]` |
| `announcement` | `/notifications` |

### 3B: Offline Sync Hardening

**Conflict Resolution:**
- Default: last-write-wins (server timestamp authority)
- Entry body edits: if server returns 409, display both versions and let user choose
- Optimistic updates rollback on 4xx errors with brief error toast

**Queue Visibility:**
- `OfflineBanner` component shows persistently when mutations are pending
- "3 changes waiting to sync" → tap to expand list of pending mutations
- Failed mutations: "1 change failed — tap to retry or discard"

**Retry Strategy:**
- On reconnect: flush immediately
- On failure: exponential backoff (2s, 4s, 8s, max 60s)
- After 5 failures: mark mutation as "failed", surface to user
- User can: retry (re-enqueue), discard (remove from queue), or edit (modify and re-enqueue)

**Cache Eviction:**
- LRU-based: keep 500 most recently accessed entities in query cache
- `gcTime`: 24 hours for detail views, 1 hour for list views
- Manual "Clear cache" option in settings

### 3C: UX Polish

**Pull-to-Refresh:**
- All list screens support pull-to-refresh → invalidates React Query cache

**Skeleton Screens:**
- While query is loading (no cached data), show placeholder components
- `SkeletonCard` component: animated shimmer matching card layout

**Haptic Feedback:**
- Scan success: medium impact
- Complete maintenance: light impact
- Delete action: heavy impact
- Uses `expo-haptics`

**Swipe Actions:**
- List items support horizontal swipe gestures
- Swipe right → context-dependent positive action (complete schedule, mark read)
- Swipe left → context-dependent negative action (archive, delete)
- Uses `react-native-gesture-handler` + `react-native-reanimated`

**Dark Mode:**
- Paper theme supports `darkTheme` variant (see Theming section)
- Follow system setting by default, with manual override in settings
- Uses `useColorScheme()` hook + user preference in MMKV

**Splash Screen:**
- LifeKeeper logo on teal background
- `expo-splash-screen` with auto-hide on auth check complete

### 3D: Full Entity Creation Forms

**Create Asset (`assets/new.tsx`):**
- Multi-step form:
  1. Name + category selection
  2. Preset selection (from library presets) — auto-fills schedules, metrics, fields
  3. Photo capture (optional)
  4. Location + purchase details (optional)
- Save → navigate to new asset detail
- API: `createAsset()`, `getLibraryPresets()`, `applyLibraryPreset()`

**Create Project:**
- Name, description, status
- Optional: template selection, target dates
- API: `createProject()`, `getProjectTemplates()`, `instantiateProjectTemplate()`

**Create Hobby:**
- Name, type, description
- API: `createHobby()`

**Create Idea:**
- Title, body, status (spark/developing/ready)
- API: `createIdea()`

**Create Inventory Item:**
- Name, quantity, unit, space location
- Optional: linked assets, reorder threshold
- API: `createInventoryItem()`, `getHouseholdSpacesTree()`

### Phase 3 Verification

- [ ] Push notification received on device when maintenance becomes due
- [ ] Tap notification → app opens to correct asset's schedule screen
- [ ] Airplane mode → create note → turn off airplane → note syncs automatically
- [ ] "3 changes pending sync" banner appears and disappears correctly
- [ ] Failed mutation shows "1 change failed" → tap retry → succeeds
- [ ] Dark mode toggle works, all screens readable
- [ ] Create asset with preset → schedules auto-populated
- [ ] Pull-to-refresh works on all list screens
- [ ] Haptic feedback fires on complete/scan/delete actions

---

## Phase 4 — Advanced Features & Web Parity

**Goal:** Feature completeness approaching web parity. These are lower-priority features that round out the mobile experience.

### 4A: Comments & Collaboration

- Threaded comments on assets, projects, hobbies
- Comment list below entity detail
- Reply to existing comments
- API: `getAssetComments()`, `createAssetComment()`, `getProjectComments()`, etc.

### 4B: Analytics (read-only)

- Dashboard cards on home screen: compliance %, cost overview, hobby streaks
- Asset cost summary page
- Inventory valuation
- Charts via `victory-native` or `react-native-chart-kit`
- API: `getHouseholdDashboard()`, `getScheduleCompliance()`, `getHouseholdCostOverview()`, `getHobbyAnalyticsOverview()`

### 4C: Canvas (read-only viewer)

- View idea canvases and entity canvases
- Pan/zoom with gestures
- No editing on mobile (too complex for touch)
- API: `getCanvases()`, canvas node/edge queries

### 4D: Exports & Sharing

- Export asset report as PDF → Android share sheet
- Generate share link for an asset → copy to clipboard
- API: `exportHouseholdAssets()`, `createShareLink()`, `getPublicAssetReport()`

### 4E: Household Management

- View household members with roles
- Send invitations by email
- Switch between households (if user belongs to multiple)
- API: `getHouseholdMembers()`, `getHouseholdInvitations()`, `acceptInvitation()`

### Phase 4 Verification

- [ ] Comment thread renders, new comment appears in list
- [ ] Dashboard analytics match web dashboard values
- [ ] Canvas renders nodes and edges, pan/zoom works
- [ ] PDF export generates and opens Android share sheet
- [ ] Share link copies to clipboard, opens in browser
- [ ] Household members list renders, invite sends

---

## Phase 5 — Entity Sub-Screen Parity

**Goal:** Close the gap between web and mobile on entity detail navigation. Every domain tool (Assets, Projects, Hobbies, Ideas) must expose the same set of sub-screens that exist on the web, completing the mobile feature parity matrix.

**Status:** ✅ Completed 2026-03-28

### Parity gaps addressed

| Sub-screen | Assets | Projects | Hobbies | Ideas |
|---|---|---|---|---|
| Canvas | ✅ (added) | ✅ (added) | ✅ (added) | ✅ (added) |
| Activity/History | ✅ (existing) | ✅ (added) | ✅ (added) | ✅ (added) |
| Notes | ✅ (existing) | ✅ (existing) | ✅ (existing) | ✅ (added) |
| Inventory/Supplies | ✅ (existing) | ✅ (added) | ✅ (added) | N/A |

### 5A: Canvas sub-screens for all domains

Each entity detail screen now navigates to an entity-scoped canvas list that calls `getCanvases(householdId, { entityType, entityId })`. Tapping a canvas opens the read-only viewer at `/canvas/[canvasId]`.

**New files:**
- `apps/mobile/app/assets/[id]/canvas.tsx`
- `apps/mobile/app/projects/[id]/canvas.tsx`
- `apps/mobile/app/hobbies/[id]/canvas.tsx`
- `apps/mobile/app/ideas/[id]/canvas.tsx`

### 5B: Activity sub-screens for Projects, Hobbies, Ideas

Uses `getHouseholdActivity` with client-side filtering by `entityId`, same pattern as `assets/[id]/history.tsx`.

**New files:**
- `apps/mobile/app/projects/[id]/activity.tsx`
- `apps/mobile/app/hobbies/[id]/activity.tsx`
- `apps/mobile/app/ideas/[id]/activity.tsx`

### 5C: Ideas Notes sub-screen

Ideas previously rendered notes inline on the detail screen. Now navigates to a dedicated notes sub-screen matching Hobbies/Projects/Assets pattern.

**New file:** `apps/mobile/app/ideas/[id]/notes.tsx`

### 5D: Project Supplies sub-screen

Read-only view of supply counts per phase from `getProjectDetail().phases`. Shows procurement progress (procured/total) per phase. Full supply item details available on web.

**New file:** `apps/mobile/app/projects/[id]/supplies.tsx`

### 5E: Hobby Inventory sub-screen

Shows `inventoryLinks` from `getHobbyDetail()`. Each link includes item name, quantity on hand, and unit. Tapping an item navigates to `/inventory/[id]`.

**New file:** `apps/mobile/app/hobbies/[id]/inventory.tsx`

### 5F: Nav entries wired in all detail screens

- `assets/[id]/index.tsx` — added Canvas between Comments and Inventory
- `projects/[id]/index.tsx` — added Canvas, Activity, Supplies
- `hobbies/[id]/index.tsx` — added Canvas, Activity, Inventory to `SUB_SCREENS`
- `ideas/[id]/index.tsx` — added Notes, Canvas, Activity (in addition to existing Comments)

### Phase 5 Verification

- [ ] Asset detail Sections card shows Canvas entry; tapping opens canvas list for that asset
- [ ] Project detail shows Canvas, Activity, Supplies entries
- [ ] Hobby detail shows Canvas, Activity, Inventory entries
- [ ] Idea detail shows Notes, Comments, Canvas, Activity entries
- [ ] Canvas list screen lists canvases filtered to the entity; tapping opens read-only viewer
- [ ] Activity screen shows activity log filtered to entity
- [ ] Ideas Notes screen allows creating and listing notes
- [ ] Project Supplies screen shows per-phase supply counts
- [ ] Hobby Inventory screen shows linked inventory items with quantities

---

## Key Files Reference

### Existing Files (modify or reference)

| File | Purpose |
|------|---------|
| `apps/mobile/App.tsx` | Current entry point. Will be replaced by `app/_layout.tsx`. Keep as reference during migration, then remove. |
| `apps/mobile/lib/api.ts` | Current 3-endpoint API client. Expand to full client. |
| `apps/mobile/lib/scan.ts` | Barcode/QR scan resolution logic. Keep and enhance. |
| `apps/mobile/components/BarcodeScanner.tsx` | Camera barcode scanner. Refactor into Expo Router, keep core logic. |
| `apps/mobile/package.json` | Add all new dependencies here. |
| `apps/mobile/tsconfig.json` | May need to add `app/` to `include` paths for Expo Router. |
| `apps/web/lib/api.ts` | Reference implementation — mirror all API methods for mobile. |
| `packages/types/src/index.ts` | Shared Zod schemas. Already used by mobile. Source of truth for all types. |
| `apps/api/src/plugins/auth.ts` | Auth plugin with dev bypass. Mobile client must match headers. |
| `apps/api/src/routes/` | All API route files. Reference for endpoint paths and request/response shapes. |
| `apps/api/src/lib/serializers/` | Response serializers. Defines the shape of what the mobile client receives. |

### New Files to Create (by phase)

| File | Phase | Purpose |
|------|-------|---------|
| `apps/mobile/app/_layout.tsx` | 0 | Root layout with all providers + auth gate |
| `apps/mobile/app/(auth)/_layout.tsx` | 0 | Auth stack navigator |
| `apps/mobile/app/(auth)/sign-in.tsx` | 0 | Clerk sign-in screen |
| `apps/mobile/app/(auth)/sign-up.tsx` | 0 | Clerk sign-up screen |
| `apps/mobile/app/(tabs)/_layout.tsx` | 0 | Bottom 5-tab navigator |
| `apps/mobile/app/(tabs)/index.tsx` | 0–1 | Home tab (due items, quick actions) |
| `apps/mobile/app/(tabs)/scan.tsx` | 1 | Barcode scan tab |
| `apps/mobile/app/(tabs)/search.tsx` | 1 | Global search tab |
| `apps/mobile/app/(tabs)/capture.tsx` | 1 | Quick note/photo capture tab |
| `apps/mobile/app/(tabs)/more.tsx` | 0 | Settings + domain navigation |
| `apps/mobile/lib/theme.ts` | 0 | Paper theme (light + dark) |
| `apps/mobile/lib/query-client.ts` | 0 | TanStack Query config + persistence |
| `apps/mobile/lib/offline-queue.ts` | 0 | MMKV mutation queue |
| `apps/mobile/lib/storage.ts` | 0 | MMKV instance + SecureStore token cache |
| `apps/mobile/lib/constants.ts` | 0 | API URL, dev user ID, feature flags |
| `apps/mobile/hooks/useOfflineSync.ts` | 0 | Network listener + queue flush |
| `apps/mobile/hooks/useAuth.ts` | 0 | Clerk auth state wrapper |
| `apps/mobile/components/OfflineBanner.tsx` | 0 | Pending sync indicator |
| `apps/mobile/components/EntityCard.tsx` | 1 | Reusable entity list card |
| `apps/mobile/components/StatusPill.tsx` | 1 | Status badge component |
| `apps/mobile/components/EmptyState.tsx` | 1 | Empty list fallback |
| `apps/mobile/components/PhotoGrid.tsx` | 1 | Attachment photo gallery |
| `apps/mobile/components/EntitySelector.tsx` | 1 | Picker for entity type + entity |
| `apps/mobile/app.config.ts` | 0 | Expo dynamic config |
| `eas.json` | 0 | EAS Build profiles |

---

## Decisions & Constraints

| Decision | Rationale |
|----------|-----------|
| **Android-first** | iOS deferred. Expo Router + Paper are cross-platform, so iOS is additive later with minimal code changes. |
| **Offline-first from day one** | Field use demands it. Retrofitting offline support is much harder than building it into the architecture from the start. |
| **No canvas editing on mobile** | Touch-based node/edge editing is too complex for the initial release. Read-only canvas viewer is sufficient. Full editing stays on web. |
| **No rich text editor on mobile** | Entry body is plain text on mobile. React Native rich text editors are unreliable and add significant complexity. Web handles rich text editing. |
| **Charts deferred to Phase 4** | Analytics are read-only summaries initially. Full chart rendering is Phase 4 polish work. |
| **Shared API client pattern** | Mobile `lib/api.ts` mirrors web's `lib/api.ts` method signatures, same Zod schemas from `@lifekeeper/types`, same error handling pattern. This ensures parity and makes it easy to port API calls between platforms. |
| **React Native Paper over custom UI** | A feature-rich app with ~40 screens needs buttons, inputs, dialogs, lists, menus, chips, FABs, and search bars. Building all from scratch with `StyleSheet.create()` would multiply development time. Paper provides these with theming support. |
| **MMKV for mutation queue** | AsyncStorage is async and slow for frequent reads/writes. MMKV is synchronous and 30x faster — critical for the mutation queue which is read/written on every network change and app launch. |
| **Last-write-wins conflict resolution** | Simple, predictable, and correct for 90%+ of mobile use cases (single-user household or non-overlapping edits). Full CRDT/OT is overkill. Entry body conflicts surface both versions for manual resolution. |
| **Image compression client-side** | Phone cameras produce 3–12 MB photos. Compressing to ~500 KB JPEG on-device via `expo-image-manipulator` before upload saves bandwidth (critical on cellular), upload time, and server storage. |

---

## Open Questions

These are decisions that can be deferred but should be resolved before they become relevant:

1. **Push notification infrastructure timing** — Adding FCM push requires a `DeviceToken` model in Prisma, a `registerDevice` endpoint, and a FCM adapter in the notification worker. This is Phase 3 scope but the Prisma model could be added in Phase 0 to avoid a migration later. **Recommendation:** Add the model in Phase 0, implement the endpoint and adapter in Phase 3.

2. **Biometric auth** — Should we enable fingerprint/face unlock via `expo-local-authentication` for app re-entry? Low effort to add. **Recommendation:** Yes, add in Phase 0 as an optional setting.

3. **Tablet layout** — Android tablets have different screen dimensions. Should we plan responsive layouts or defer? **Recommendation:** Defer. Phone-first. Paper components are responsive enough for small tablets. True tablet optimization is a future consideration.

4. **Widget support** — Android home screen widgets (e.g., "next due maintenance" card). Expo supports this via `expo-widgets` (experimental). **Recommendation:** Defer to post-Phase 4. Nice-to-have, not core.

5. **Background sync** — Should the app sync mutations in the background (when the app is not in the foreground)? Expo supports background tasks via `expo-task-manager`. **Recommendation:** Defer to Phase 3. Foreground sync on reconnect is sufficient initially.

6. **Data export from mobile** — PDF/CSV export on mobile requires either server-side generation (API already supports this) or on-device rendering. **Recommendation:** Server-side generation, download file, open Android share sheet. Phase 4.
