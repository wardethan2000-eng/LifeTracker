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

## Phase 6 — Polish & Completeness

**Goal:** Close the remaining feature gaps and UX rough edges that exist after Phase 5. All primary domain tools have full sub-screen parity; Phase 6 makes the app feel production-ready for daily use.

**Status:** ✅ Completed 2026-03-28

### Gaps addressed

#### 6A: Idea Creation Form

Ideas was the only primary domain with no creation path on mobile — the list had no FAB and no `new.tsx` screen.

**Changes:**
- `apps/mobile/app/ideas/new.tsx` — multi-field creation form: title (required), description (optional), stage (spark/developing/ready), priority (low/medium/high). On success navigates to the new idea detail screen.
- `apps/mobile/app/ideas/index.tsx` — added `<FAB icon="plus" label="New idea" />` using the container/SafeAreaView/FAB pattern from the Projects screen.

#### 6B: Color Scheme Preference Wiring

The Settings screen stored a user theme preference (system/light/dark) to MMKV but the root layout ignored it and always followed the device setting.

**Changes:**
- `apps/mobile/app/_layout.tsx` — `RootLayout` now reads the initial preference from MMKV via `mmkvGet(STORAGE_KEYS.COLOR_SCHEME)`, holds it in `useState`, and subscribes to MMKV changes via `storage.addOnValueChangedListener`. The effective color scheme overrides the system setting when the user has explicitly selected light or dark. `StatusBar` style and `PaperProvider` theme both reflect the preference immediately when Settings is changed.

#### 6C: Unread Notification Badge in Tab Bar

The More tab had no indicator when unread notifications were waiting.

**Changes:**
- `apps/mobile/app/(tabs)/_layout.tsx` — Added `useQuery` calls for `getMe` and `getHouseholdNotifications({ status: "unread", limit: 1 })` (stale time 1 min). The `unreadCount` from `HouseholdNotificationList` drives `tabBarBadge` on the More tab.

#### 6D: Failed Mutation Retry / Discard UI

The `OfflineBanner` showed failure count but provided no way for the user to act on failures.

**Changes:**
- `apps/mobile/hooks/useOfflineSync.ts` — Extended return type with `failedMutations: QueuedMutation[]`, `retry(id)`, and `discard(id)` helpers. `refreshCounts()` now also refreshes the `failedMutations` list after each flush or user action.
- `apps/mobile/components/OfflineBanner.tsx` — Banner is now a `<Pressable>` when failures exist. Tapping it opens a Paper `<Dialog>` (via `<Portal>`) listing each failed mutation with its description, path, retry count, and timestamp. Each row has **Retry** (re-enqueues as pending) and **Discard** (removes permanently) buttons. The Dialog auto-closes when the last failure is resolved.

### Phase 6 Verification

- [ ] Ideas list shows "New idea" FAB → tapping opens creation form → saving navigates to idea detail
- [ ] Creating an idea with title only succeeds; description is optional
- [ ] Settings → Theme → Light forces light mode immediately without restart
- [ ] Settings → Theme → Dark forces dark mode immediately without restart
- [ ] Settings → Theme → System follows device setting
- [ ] More tab shows badge number matching unread notification count
- [ ] Badge clears after all notifications are marked read
- [ ] Trigger an offline failure → OfflineBanner shows red "X failed — tap to review"
- [ ] Tapping the banner opens dialog listing the failed mutation
- [ ] Retry re-queues the mutation; banner updates count
- [ ] Discard removes the mutation; banner hides once queue is empty

---

## Phase 7 — Photo Gallery & Entity-Linked Capture ✅ Completed

**Goal:** Replace the `photos.tsx` placeholder stub with a real upload + gallery flow, and give the Capture tab entity-linking so notes can be attached to a specific asset, project, hobby, or idea.

### 7A — Attachment API methods (`apps/mobile/lib/api.ts`)

Three methods appended after `confirmAttachmentUpload`:

- `getEntityAttachments(householdId, entityType, entityId)` — `GET /v1/households/:id/attachments?entityType=X&entityId=Y` → `Attachment[]`
- `getAttachmentDownloadUrl(householdId, attachmentId)` — `GET /v1/households/:id/attachments/:attachmentId/download` → `{ url: string }`
- `deleteAttachment(householdId, attachmentId)` — `DELETE /v1/households/:id/attachments/:attachmentId` → `void`

### 7B — EntitySelector component (`apps/mobile/components/EntitySelector.tsx`)

New component. Props: `householdId`, `value: EntitySelection | null`, `onChange`.

Shows a trigger `<Button>` with the currently linked entity name (or "None (standalone)"). Tapping opens a Paper `<Dialog>` with:
- Searchbar to filter across all domains
- "None (standalone)" list item (links to household home entry)
- Four sections: Assets, Projects, Hobbies, Ideas — each fetched lazily (enabled only when dialog is open)
- Selected item highlighted in primary color

The dialog only fires queries when open (`enabled: open && !!householdId`), so it doesn't add background traffic.

**Bug fixes bundled with this work:**
- `app/ideas/[id]/index.tsx` — import paths corrected from `../../` to `../../../`
- `app/ideas/[id]/notes.tsx` — `getEntries` returns `EntryListResponse` (paginated object), not an array; fixed to extract `.items`

### 7C — Entity-linked Capture tab (`apps/mobile/app/(tabs)/capture.tsx`)

- Added `entity: EntitySelection | null` state
- `EntitySelector` component rendered below the type chips with "Linked to" label
- `resolvedEntityType` / `resolvedEntityId` derive the final values — fall back to `"home"` / `householdId` when no entity is selected
- Both the online mutation and offline queue body now use resolved entity fields
- `TouchableOpacity` import removed (was unused)

### 7D — Asset Photos & Files screen (`apps/mobile/app/assets/[id]/photos.tsx`)

Full replacement of the Phase 1 placeholder stub:

**Gallery:**
- Loads `getEntityAttachments(householdId, "asset", id)` via React Query
- 2-column `FlatList` grid; tile size adapts to screen width
- Each tile is a `PhotoTile` sub-component that lazily fetches its download URL via `getAttachmentDownloadUrl` (staleTime 5 min, React Query deduplication prevents duplicate calls)
- Image tiles render the URL in `<Image>`; non-image files show a file/PDF emoji icon
- Filename overlay at tile bottom
- Tap → `Linking.openURL(downloadUrl)` to open in browser/viewer
- Long-press → triggers delete confirmation dialog

**Upload:**
- FAB "Add photo" → `Alert.alert` with Camera / Photo library options
- Supports multi-select from library (`allowsMultipleSelection: true`)
- Each selected image: compress via `ImageManipulator` (max 1200px, 85% quality) → get file size with `expo-file-system` → `requestAttachmentUpload` → `FileSystem.uploadAsync` (binary PUT to presigned S3 URL) → `confirmAttachmentUpload`
- Invalidates `["asset-attachments", id]` on success; haptic success feedback
- FAB shows "Uploading…" with disabled state during in-progress upload

**Delete:**
- Long-press sets `deleteTargetId`; Paper `<Dialog>` appears with explicit "Delete photo" / Cancel
- On confirm: calls `deleteAttachment`; haptic success; invalidates attachment list

### Phase 7 Verification

- [ ] Capture tab shows "Linked to" picker — default is "None (standalone)"
- [ ] Tapping "Linked to" opens entity dialog; search filters across all domains
- [ ] Selecting an asset name updates the button label
- [ ] Saving a note with an entity linked creates the entry with the correct `entityType`/`entityId`
- [ ] Asset detail → Photos tab shows "No photos yet" with correct empty state (no "Phase 3" copy)
- [ ] FAB → Camera captures and uploads; photo appears in grid
- [ ] FAB → Photo library allows multi-select; all selected photos upload
- [ ] Tap a grid tile opens the file in browser/viewer
- [ ] Long-press a tile shows delete dialog naming the action "Delete photo"
- [ ] Confirming delete removes the tile from the grid

---

## Phase 8 — Bug Fixes & Quality Improvements ✅ Completed

**Goal:** Systematically resolve all identified runtime bugs, dead-end stubs, and data-integrity issues found in the Phase 7 audit.

### 8A — Server-side activity filtering (`lib/api.ts`, 4 activity screens)

**Bug:** All four entity activity screens (`assets/[id]/history.tsx`, `projects/[id]/activity.tsx`, `hobbies/[id]/activity.tsx`, `ideas/[id]/activity.tsx`) were fetching up to 50 **household-wide** activity events and discarding all entries not matching the entity ID client-side. In an active household, entity-specific history older than the 50th most recent event never appeared.

**Fix:** Extended `getHouseholdActivity()` in `lib/api.ts` to accept optional `entityType` and `entityId` params (the API route at `GET /v1/households/:id/activity` already supported them). All four screens now pass the correct values and drop the client-side `.filter()`.

### 8B — Hobbies notes crash bug (`app/hobbies/[id]/notes.tsx`)

**Bug:** `getEntries()` returns `EntryListResponse` — a paginated object `{ items: Entry[], nextCursor }` — not a plain array. The component was passing this object directly to `FlatList data=`, producing a runtime crash (or silent empty list) when the query resolved.

**Fix:** Changed `data: entries = []` to `data: entriesData` and derived `entries = entriesData?.items ?? []`. Also removed the `as any[]` cast from `FlatList data=`. The same pattern was already used in asset notes, project notes, and idea notes — this was a copy-paste omission.

### 8C — Product barcode dead-end (`app/(tabs)/scan.tsx`)

**Bug:** When a product barcode (UPC, EAN, Code-128, Code-39) was scanned, `lookupBarcodeMobile()` succeeded and returned product data but the result was thrown away and an `Alert.alert` showed "Full product detail screen coming in Phase 1."

**Fix:** The scan screen now stores the `BarcodeLookupResult` in `productResult` state and shows a Paper `<Dialog>` (via `<Portal>`) with the product name, brand, category, description, and a "View image" link button when an image URL is available. Dismissing the dialog resets state and resumes scanning. `BarcodeLookupResult` is now also re-exported from `lib/api.ts`.

### 8D — Push notification toggle (`app/settings/index.tsx`)

**Bug:** The push notification `<Switch>` was `disabled` and permanently stuck at `value=true` — non-interactive UI showing a false "enabled" state.

**Fix:**
- On mount: checks actual OS permission status via `Notifications.getPermissionsAsync()` to reflect real state
- Toggle ON: calls `Notifications.requestPermissionsAsync()` → on grant, calls `Notifications.getExpoPushTokenAsync()` → registers token via `registerDevice()` → stores the returned `DeviceToken.id` in MMKV under `STORAGE_KEYS.DEVICE_TOKEN_ID`
- Toggle OFF: retrieves stored token ID from MMKV → calls `unregisterDevice(id)` → clears MMKV entry
- `pushPending` state disables the switch during async operations

### 8E — Version string (`app/settings/index.tsx`)

**Fix:** About section description replaced `"Phase 3 · Expo SDK 52"` with `\`Version ${appVersion} · Expo SDK 52\`` where `appVersion` is read from `Constants.expoConfig?.version`.

### Phase 8 Verification

- [ ] Asset history shows only that asset's activity (not other entities' events)
- [ ] Project/Hobby/Idea activity screens do the same
- [ ] Hobby notes screen loads and displays entries correctly (no crash)
- [ ] Scan a product barcode → dialog appears with product name/brand/category
- [ ] Dismiss dialog → camera resumes scanning
- [ ] Settings → Notifications toggle is OFF if permissions not granted
- [ ] Toggling ON requests OS permission → if granted, switch stays ON
- [ ] About section shows real app version (e.g. "Version 1.0.0 · Expo SDK 52")

---

## Phase 9 — Supplies Drill-Through, Search Fix, Comment Fix, Data Integrity ✅ Completed

**Goal:** Address remaining bugs and UX gaps identified in the Phase 8 audit focused on data integrity, navigation correctness, and interaction safety.

### 9A — Project supplies drill-through (`app/projects/[id]/supplies.tsx`, new `phases/[phaseId]/supplies.tsx`)

**Problem:** The project supplies screen showed only phase-level aggregate counts (total / procured). Individual supply item names, SKUs, quantities, suppliers, and per-item procurement status were invisible — the API level was completely missing.

**Fix:**
- Added `getProjectPhaseSupplies(householdId, projectId, phaseId)` to `lib/api.ts`, calling `GET /v1/households/:id/projects/:id/phases/:id/supplies` and validating against `projectPhaseSupplyListSchema`.
- Rewrote `supplies.tsx` phase cards to be tappable, navigating to `/projects/[id]/phases/[phaseId]/supplies`. Cards now show a compact `procured/total ›` summary.
- Created `app/projects/[id]/phases/[phaseId]/supplies.tsx` — a new drill-through screen that shows each `ProjectPhaseSupply` item with name, category, quantity needed/on hand, unit, estimated cost, supplier name, supplier link button, procurement status chip, and notes.

### 9B — `getHouseholdIdeas` pagination cursor discarded (`lib/api.ts`, `app/ideas/index.tsx`, `components/EntitySelector.tsx`)

**Bug:** `getHouseholdIdeas()` returned `Promise<IdeaSummary[]>` by stripping `nextCursor` with `.then((r) => r.items)` — making cursor-based load-more impossible and hiding the full paginated API response. The same function is used by both the ideas list screen and `EntitySelector`.

**Fix:**
- Changed return type to `Promise<{ items: IdeaSummary[]; nextCursor?: string | null | undefined }>` — full paginated result now preserved.
- Updated `app/ideas/index.tsx`: `const ideas = data?.items ?? []` (same pattern as all other paginated list screens).
- Updated `components/EntitySelector.tsx`: `(ideas?.items ?? []).filter(...)` to unwrap from the paginated result.

### 9C — Silent navigation failure in search (`app/(tabs)/search.tsx`)

**Bug:** Tapping on search results for entity types with no mobile screen (`inventory_item`, `schedule`, `log`, `comment`) silently swallowed the navigation failure inside a `try/catch` block — the user got no feedback and nothing happened.

**Fix:**
- Added a `MOBILE_ENTITY_TYPES` set covering supported entity types.
- For unsupported entity types, shows a `<Snackbar>` "Not available in the mobile app yet" instead of attempting navigation.
- Removed the `try/catch` wrapper entirely; navigation to supported types is now direct.

### 9D — CommentThread double-delete race condition (`components/CommentThread.tsx`)

**Bug:** The `destroy` `useMutation` did not destructure `isPending`, so the Delete button had no disabled or loading state. A user could tap Delete multiple times, firing parallel delete requests against the same comment ID.

**Fix:**
- Destructured `isPending: destroying` from the `destroy` mutation.
- Added `loading={destroying}` and `disabled={destroying}` to the Delete button.
- Added `onError` handlers to all three mutations (`save`, `destroy`, `reply`) — failures are now logged instead of silently discarded.

### 9E — Dead code removal

- Deleted `components/ComingSoon.tsx` — a Phase 0 placeholder component with zero imports anywhere in the codebase.

### Phase 9 Verification

- [ ] Tapping a phase card in Project Supplies navigates to the item-level drill-through
- [ ] Drill-through shows individual supply names, quantities, supplier info, and procurement status chips
- [ ] Ideas list screen loads correctly (no regression from paginated unwrap change)
- [ ] EntitySelector still shows Ideas group when ideas exist
- [ ] Searching for an inventory item or schedule and tapping it shows "Not available in mobile app yet" snackbar
- [ ] Searching for an asset/project/hobby/idea and tapping navigates correctly
- [ ] Rapid-tapping Delete on a comment is prevented (button goes loading/disabled after first tap)
- [ ] `ComingSoon.tsx` is gone — zero TypeScript errors

---

## Phase 10 — Entry Edit/Delete, Photo Upload, Home Tab Feedback ✅ Completed

**Goal:** Wire up missing CRUD on notes screens, make captured photos actually upload to the selected entity, and surface error/success feedback on the home tab task-completion button.

### 10A — `updateEntry` API method missing (`lib/api.ts`)

**Bug:** `updateEntry` was never added to the mobile API client, so editing an existing journal entry / note was impossible regardless of what the UI did.

**Fix:**
- Imported `type UpdateEntryInput` from `@lifekeeper/types`.
- Added `updateEntry(householdId, entryId, input: UpdateEntryInput): Promise<Entry>` — calls `PATCH /v1/households/:id/entries/:id` and validates with `entrySchema`.

### 10B — Inline edit/delete on all 4 notes screens

**Bug:** All four notes screens (`assets/[id]/notes.tsx`, `projects/[id]/notes.tsx`, `hobbies/[id]/notes.tsx`, `ideas/[id]/notes.tsx`) were read-only — no edit, no delete.

**Fix (consistent pattern across all 4 screens):**
- Added `editingEntry: { id: string; body: string } | null` and `deletingId: string | null` state.
- Added `saveEdit` mutation (calls `updateEntry`) and `remove` mutation (calls `deleteEntry`).
- Each note card's body is now wrapped in a `noteRow` flex row with pencil + trash `IconButton`s on the right.
- Tapping pencil replaces the card body with an inline `TextInput` + Save/Cancel buttons.
- Tapping trash shows an inline "Delete this note?" confirmation row below the card with Keep / Delete buttons.
- New styles: `noteRow`, `noteActions`, `deleteConfirm`, `deleteActions`.

### 10C — Home tab silent failure and missing haptic feedback (`app/(tabs)/index.tsx`)

**Bug:** The "Mark as done" button on the home tab's overdue tasks list had no error handling (`onError` was absent) and no success feedback beyond re-rendering the list.

**Fix:**
- Added `import * as Haptics from "expo-haptics"`.
- Added `Alert` to the react-native import.
- `complete` mutation `onSuccess`: `Haptics.notificationAsync(NotificationFeedbackType.Success)`.
- `complete` mutation `onError`: `Alert.alert("Error", "Could not mark as done. Please try again.")`.

### 10D — Capture tab `canSave` missing `householdId` guard (`app/(tabs)/capture.tsx`)

**Bug:** `canSave` was computed as `!!body.trim() && !saving` — the Save button could become enabled even when `householdId` was not yet loaded, causing a thrown error inside `mutationFn`.

**Fix:** `const canSave = !!body.trim() && !!householdId && !saving;`

### 10E — Photo upload dead code in capture tab (`app/(tabs)/capture.tsx`)

**Bug:** The capture tab let users pick/take a photo (stored in `photoUri` state) and selected an entity, but never uploaded the photo — it was silently discarded after `createEntry` succeeded.

**Fix:**
- Added `import * as FileSystem from "expo-file-system"`.
- Added `requestAttachmentUpload` and `confirmAttachmentUpload` to the `lib/api` import.
- After `createEntry` succeeds, if `photoUri` is set and `entity` is a real entity (not the home fallback),  the photo is uploaded: `FileSystem.getInfoAsync` → `requestAttachmentUpload` → `FileSystem.uploadAsync` (PUT, BINARY_CONTENT) → `confirmAttachmentUpload`. The upload is wrapped in `try/catch` so a failed photo upload never discards the already-saved entry.

### Phase 10 Verification

- [ ] Tapping the pencil icon on any note (assets, projects, hobbies, ideas) opens inline edit form
- [ ] Saving an edit updates the note in place without navigating away
- [ ] Tapping the trash icon shows inline delete confirmation; confirming removes the note
- [ ] "Keep" on delete confirmation dismisses without deleting
- [ ] Home tab "Mark as done" shows success haptic on completion
- [ ] Home tab "Mark as done" shows Alert on network failure
- [ ] Capture tab Save button stays disabled until both body is non-empty AND householdId is loaded
- [ ] Capturing a photo and saving to a specific asset/project/hobby/idea attaches the photo to that entity
- [ ] Capturing a note without a photo (or without a specific entity selected) saves cleanly without errors

---

## Phase 11 — Bug Fixes: Scanner, Mutations, Query Errors, Data Gaps ✅ Completed

**Goal:** Fix a set of correctness bugs found by auditing the completed screens — broken scanner state, silent mutation failures, infinite loading states on API errors, stale cache invalidation, and missing data in detail views.

### 11A — QR scanner locked after successful navigation (`app/(tabs)/scan.tsx`)

**Bug:** After a successful asset tag scan, `setState("resolving")` was never reset before `router.push()`. When the user navigated back, the scanner was permanently stuck in the `"resolving"` guard and refused every new scan.

**Fix:** Call `setState("scanning")` immediately before `router.push(...)` so the scanner is ready on return.

### 11B — Capture tab inherits previous entity after save (`app/(tabs)/capture.tsx`)

**Bug:** `onSuccess` reset body, title, entryType, flags, and photoUri — but not `entity`. The next capture silently attached to the previously selected entity. The same gap existed in the offline `onError` branch.

**Fix:** Added `setEntity(null)` in both `onSuccess` and the offline-enqueue `onError` branch.

### 11C — Asset/Idea mutations had no `onError` (`app/assets/[id]/index.tsx`, `app/ideas/[id]/index.tsx`)

**Bug:** The `save` mutation in asset detail and both `updateMutation`/`stageMutation` in idea detail had no `onError`. Any API failure silently closed the loading spinner with zero user feedback.

**Fix:** Added `onError: (err) => Alert.alert(...)` to all three mutations. Added `Alert` to the react-native import in both files.

### 11D — Infinite skeleton when query fails (`app/hobbies/[id]/index.tsx`, `app/ideas/[id]/index.tsx`)

**Bug:** Both screens rendered the skeleton when `isLoading || !data`. When the query errored, `isLoading` became `false` but `data` stayed `undefined`, so the skeleton rendered forever.

**Fix:** Destructured `error` from `useQuery`, added `EmptyState` import, and changed the condition to: `isLoading ? <Skeleton/> : error || !hobby ? <EmptyState .../> : <Content/>`.

### 11E — Home tab schedule completion missed asset-detail cache (`app/(tabs)/index.tsx`)

**Bug:** The `complete` mutation invalidated `dueWork` and `activity` but not `["asset-detail", item.assetId]`. Opening the asset after completing a schedule showed stale overdue/due counts until a manual refresh.

**Fix:** Added `queryClient.invalidateQueries({ queryKey: ["asset-detail", item.assetId] })` in `onSuccess`, using `item` from the mutation variables argument: `onSuccess: (_, item) => { ... }`.

### 11F — Notifications `markRead` side-effect in wrong lifecycle (`app/notifications/index.tsx`)

**Bug:** `setMarkingId(notificationId)` was called inside `mutationFn`. With retries, this could mismatch the loading indicator and fire multiple times. `onError` was absent, so mark-read failures were fully silent.

**Fix:** Moved `setMarkingId` to `onMutate`, added `onError: () => Alert.alert(...)`, and simplified `mutationFn` to a single `return markNotificationRead(notificationId)`.

### 11G — Idea detail notes card read from Zod-stripped field (`app/ideas/[id]/index.tsx`)

**Bug:** The Notes card rendered `idea.notes.map((note: any) => note.content ?? note.body)`. `ideaSchema` has no `notes` array — Zod strips it — so the card was always invisible. The `any` cast masked the type error.

**Fix:** Removed the `idea.notes` block entirely. Added a `useQuery` for `getEntries(householdId, { entityType: "idea", entityId: id, limit: 5 })` stored in `recentNotes`. The card now renders from that typed result, matching the pattern used by all other notes screens.

### 11H — CommentThread hard-delete had no confirmation (`components/CommentThread.tsx`)

**Bug:** Tapping Delete immediately called `destroy()` with no confirmation. Comments are permanently deleted.

**Fix:** Replaced the direct `onPress={() => destroy()}` with `Alert.alert("Delete comment?", ..., [{ text: "Delete", style: "destructive", onPress: () => destroy() }, { text: "Cancel" }])`.

### 11I — Asset detail hid purchaseDate when price absent; location never shown (`app/assets/[id]/index.tsx`)

**Bug:** The purchase row rendered only inside `asset.purchaseDetails?.price` — if an asset had a date but no price, the date was invisible. `locationDetails` (room, building, property) was never rendered.

**Fix:** Split into two independent rows: one for price guarded by `purchaseDetails?.price`, one for date guarded by `purchaseDate`. Added a Location row that renders `room / building / propertyName` from `asset.locationDetails` when any are present.

### Phase 11 Verification

- [ ] Scan an asset QR → navigate to asset detail → tap Back → scanner immediately accepts new scans
- [ ] Capture a note linked to an asset → save → entity selector resets to "unlinked"
- [ ] Edit an asset name with no network → Alert shown with error message
- [ ] Edit an idea title with no network → Alert shown with error message
- [ ] Change idea stage chip with no network → Alert shown with error message
- [ ] Open a hobby/idea detail with API returning 500 → EmptyState shown (not infinite skeleton)
- [ ] Mark a schedule done from Home tab → open that asset → overdue/due counts updated immediately
- [ ] Mark a notification read → UI updates; failure shows Alert
- [ ] Idea detail Recent Notes card shows actual notes (via separate entries query)
- [ ] Tap Delete on a comment → confirmation alert appears; Cancel keeps it; Delete removes it
- [ ] Asset with purchase date but no price → purchase date row visible in Details card
- [ ] Asset with location details → room/building/property shown in Details card

---

## Phase 12 — Bug Fixes: Error Feedback, Pull-to-Refresh, TypeScript Hygiene ✅ Completed

### Problem Statement

Phase 11 left several silent failure modes, false affordances, and loose TypeScript casts that degraded reliability and user experience without being visible in normal testing.

### Changes Made

**`apps/mobile/app/assets/[id]/schedules.tsx`**
- Added `Alert` to react-native imports.
- Added `getMe` query and `householdId` to enable cache invalidation of the activity feed.
- Added `onSuccess` invalidation for `["activity", householdId]` when a schedule is completed.
- Added `onError` with `Alert.alert` so failures surface to the user.

**`apps/mobile/components/CommentThread.tsx`**
- Replaced silent `console.error` with `Alert.alert` in all three mutation `onError` handlers (`save`, `destroy`, `reply`). Users now see a message when comment edits, deletes, or replies fail.

**`apps/mobile/app/(tabs)/index.tsx`**
- Added `RefreshControl` to react-native import.
- Wired `refetch`/`isRefetching` from both `dueWork` and `activity` queries.
- Added `<RefreshControl>` to the home `ScrollView` so users can pull to refresh both sections simultaneously.

**`apps/mobile/app/assets/[id]/comments.tsx`**
- Added `RefreshControl` to react-native import and `EmptyState` component import.
- Added `error`, `refetch`, `isRefetching` to the comments `useQuery` destructure.
- Added an error state branch rendering `EmptyState` when the query fails.
- Added `<RefreshControl>` to the `ScrollView`.

**`apps/mobile/app/assets/[id]/index.tsx`**
- Added `refetch` to the asset detail `useQuery` destructure.
- Changed the error state from a false "Pull down to retry." message to a real `<Button onPress={() => void refetch()}>Retry</Button>` below the `EmptyState`.

**`apps/mobile/app/hobbies/[id]/index.tsx`**
- Added `RefreshControl` to react-native import.
- Added `refetch`, `isRefetching` to the hobby detail `useQuery` destructure.
- Changed the error state body from the false "Pull down to retry." to "Something went wrong."
- Added `<RefreshControl>` to the success-branch `ScrollView`.

**`apps/mobile/app/ideas/[id]/index.tsx`**
- Replaced `as never` on `router.push` in sections navigation with `as Parameters<typeof router.push>[0]`.
- Removed erroneous `any` cast on `idea.links.map((link: any, …)` — TypeScript now correctly infers the element type from the `Idea` type.

**`apps/mobile/app/assets/[id]/canvas.tsx`**, **`apps/mobile/app/ideas/[id]/canvas.tsx`**, **`apps/mobile/app/hobbies/[id]/canvas.tsx`**, **`apps/mobile/app/projects/[id]/canvas.tsx`**
- Replaced `as never` on all `router.push(\`/canvas/${item.id}\`)` calls with `as Parameters<typeof router.push>[0]`.

**`apps/mobile/app/hobbies/[id]/inventory.tsx`**
- Replaced `as never` on `router.push(\`/inventory/${item.inventoryItemId}\`)` with `as Parameters<typeof router.push>[0]`.

**`apps/mobile/app/(tabs)/capture.tsx`**
- Replaced silent `console.warn("Photo upload failed:", uploadErr)` with a user-facing `Alert.alert` that explains the note was saved but the photo attachment failed.

### Phase 12 Verification

- [ ] Mark a schedule done on the asset schedules screen with no network → Alert shown
- [ ] Mark a schedule done successfully → activity feed on home tab updates immediately (pull to refresh or navigate away and back)
- [ ] Edit or delete a comment with no network → Alert shown (not silent)
- [ ] On home tab, pull down → both Due & Overdue and Recent Activity sections refresh
- [ ] Open asset comments with API error → EmptyState shown; pull down → retries
- [ ] Open asset detail with API error → EmptyState + Retry button shown; tap Retry → reloads
- [ ] Open hobby detail with API error → EmptyState shown; pull down → retries
- [ ] Capture a note with a photo attached when photo upload fails → "Note saved" Alert shown
- [ ] No TypeScript errors: `npx tsc --noEmit` passes in `apps/mobile`

---

## Phase 13 — Entry Detail Editing, Feed Refresh, Mutation Error Handling ✅ Completed

**Goal:** Close the last set of correctness gaps identified by auditing the state after Phase 12: the global entry detail screen had no edit capability, several list screens were missing pull-to-refresh and error states, and three mutation calls silently swallowed errors.

### 13A — `entries/[id].tsx`: Inline edit + error state + entity navigation

**Bugs:**
- No edit capability — the detail screen was permanently read-only despite `updateEntry` existing in `lib/api.ts`.
- `isLoading || !entry` check causes infinite spinner when the query errors (same class of bug fixed in Phase 11 for hobby and idea detail).
- No pull-to-refresh (no `RefreshControl`) — stale data is not recoverable without leaving the screen.
- The `entry.resolvedEntity.label` was display-only with no way to navigate to the linked entity.

**Fix:**
- Added `editing: boolean`, `draftBody: string`, `draftTitle: string` state.
- Added `save` mutation calling `updateEntry(householdId, id, { body: draftBody.trim(), title: draftTitle.trim() || undefined })`.
- Pencil `IconButton` in the header row toggles `editing`. When editing: body becomes a `TextInput`, title becomes a `TextInput`, and Save + Cancel buttons replace the type/date label row.
- Added `error` to the `useQuery` destructure; changed loading guard to `isLoading ? <Skeleton/> : error || !entry ? <EmptyState + Retry/> : <Content/>`.
- Added `refetch`, `isRefetching` from `useQuery`; added `<RefreshControl>` to the `ScrollView`.
- Wrapped `entry.resolvedEntity.label` in a `<Pressable>` that navigates to the entity's root route when `resolvedEntity.entityType` is a supported type (`asset`, `project`, `hobby`, `idea`).

### 13B — `entries/index.tsx`: Pull-to-refresh + error state

**Bugs:**
- `FlatList` had no `RefreshControl` — stale data could not be refreshed without leaving the screen.
- Query failure left the spinner up indefinitely.

**Fix:**
- Added `refetch`, `isRefetching`, `error` to `useQuery` destructure.
- Added `<RefreshControl refreshing={isRefetching} onRefresh={refetch} />` to the `FlatList`.
- Changed loading branch to: `isLoading ? <Spinner/> : error ? <EmptyState title="Could not load entries" body="Pull down to retry." /> : <FlatList .../>`.

### 13C — `inventory/[id].tsx`: `onError` + remove `any` cast

**Bugs:**
- `mutation.mutate()` (record transaction) had no `onError` — silent failure on network error or 4xx.
- Transaction history used `(tx: any, idx: number)` cast — masked TypeScript type errors.

**Fix:**
- Added `import type { InventoryTransaction }` to the import from `../../lib/api`.
- Added `onError: (err: Error) => Alert.alert("Error", err.message ?? "Could not record transaction.")` to the mutation.
- Changed `item.transactions.slice(0, 20).map((tx: any, ...)` to `item.transactions.slice(0, 20).map((tx: InventoryTransaction, ...)`.

### 13D — `hobbies/[id]/sessions.tsx` + `projects/[id]/tasks.tsx`: `onError` handlers + error state

**Bugs:**
- `mutation.mutate()` in sessions screen (log session) had no `onError` — silent failure.
- `toggleTask` mutation in tasks screen had no `onError` — silent failure.
- Tasks screen `isLoading` guard spun forever on query error (same class as Phase 11 bugs).

**Fix (`sessions.tsx`):**
- Added `Alert` to react-native imports.
- Added `onError: (err: Error) => Alert.alert("Error", err.message ?? "Could not log session.")` to the create session mutation.

**Fix (`tasks.tsx`):**
- Added `Alert` to react-native imports.
- Added `error` to `useQuery` destructure; changed the loading guard from `if (isLoading) return <Spinner/>` to a ternary with an `error` branch showing `<EmptyState title="Could not load tasks" body="Go back and try again." />`.
- Added `onError: (err: Error) => Alert.alert("Could not update task", err.message ?? "Please try again.")` to the `toggleTask` mutation.

### Phase 13 Verification

- [ ] Open global entry detail → pencil button appears in header; tapping it switches body + title to editable `TextInput`s
- [ ] Edit body + title → tap Save → entry updates in place; Save/Cancel buttons disappear
- [ ] Tap Cancel during edit → original content restored, no API call made
- [ ] `entry.resolvedEntity.label` is tappable for supported entity types → navigates to that entity
- [ ] Open entry detail with API error → EmptyState shown with Retry button (not infinite spinner)
- [ ] Pull down on entry detail → refreshes entry data
- [ ] On Notes & Entries list, pull down → list refreshes
- [ ] Open Notes & Entries list with API error → EmptyState shown (not infinite spinner)
- [ ] Record a transaction (Consume/Restock/Adjust) with no network → Alert shown
- [ ] Log a hobby session with no network → Alert shown
- [ ] Toggle a task with no network → Alert shown
- [ ] Open project tasks with API error → EmptyState shown (not infinite spinner)
- [ ] No new TypeScript errors introduced

---

## Phase 14 — Space Detail Fixes, Share Link Errors, Comment Pull-to-Refresh ✅ Completed

**Goal:** Close the remaining quality gaps found in the Phase 13 audit — silent mutation failures on share and household screens, infinite-skeleton bugs on the space detail screen, `any` casts in space items, and comment screens that showed empty threads (instead of an error state) on query failure with no refresh path.

### 14A — `inventory/spaces/[id].tsx`: Error state + `RefreshControl` + remove `any` casts

**Bugs:**
- `isLoading || !contents` check causes infinite skeleton when the query errors (same class as Phase 11/12 bugs).
- No `RefreshControl` — stale space contents can't be refreshed without navigating away.
- Inventory items rendered as `(item: any)` and general items rendered as `(item: any)` — TypeScript types lost, masking potential errors.

**Fix:**
- Added `error`, `refetch`, `isRefetching` to `useQuery` destructure.
- Changed loading/error guard to three branches: loading → `<SkeletonCard/>`, error → `<EmptyState icon="⚠️" title="Could not load space" body="Pull down to try again."/>` + `<RefreshControl>`, success → content.
- Added `<RefreshControl refreshing={isRefetching} onRefresh={refetch} />` to the `ScrollView`.
- Changed `(item: any)` inventory map to `(item: SpaceContentsResponse["inventoryItems"][number])` and general items map to `(item: SpaceContentsResponse["generalItems"][number])`, importing `SpaceContentsResponse` from `../../../lib/api`.
- Removed orphaned `(name: string, idx: number)` cast in child spaces names map.

### 14B — `assets/[id]/share.tsx`: `onError` for `create` and `revoke`

**Bugs:**
- `create` mutation (create new share link) had no `onError` — failed API call was completely silent.
- `revoke` mutation (revoke share link) had no `onError` — failed API call was completely silent.

**Fix:**
- Added `onError: (err: Error) => Alert.alert("Error", err.message ?? "Could not create share link.")` to the `create` mutation.
- Added `onError: (err: Error) => Alert.alert("Error", err.message ?? "Could not revoke link.")` to the `revoke` mutation.

### 14C — `household/index.tsx`: `onError` for `revoke`

**Bug:** The `revoke` mutation (revoke household invitation) had no `onError`. The invitation list would appear unchanged after a silent network failure.

**Fix:** Added `onError: (err: Error) => Alert.alert("Error", err.message ?? "Could not revoke invitation.")` to the `revoke` mutation.

### 14D — Comments screens (`projects/[id]/comments.tsx`, `hobbies/[id]/comments.tsx`, `ideas/[id]/comments.tsx`): Error state + pull-to-refresh

**Bugs (identical in all three files):**
- `isLoading ? <ActivityIndicator/> : <CommentThread comments={comments ?? []}/>` — when the query errors, `isLoading = false` and `comments = undefined`, so `comments ?? []` renders an empty thread with no indication that data failed to load.
- No `RefreshControl` — the `ScrollView` wrapping `CommentThread` has no way to refresh stale or failed data.

**Fix (applied to all three files):**
- Added `error`, `refetch`, `isRefetching` to each `useQuery` destructure.
- Added `EmptyState` import.
- Added `RefreshControl` to react-native imports.
- Changed the render branch: `isLoading ? <ActivityIndicator/> : error ? <EmptyState icon="💬" title="Could not load comments" body="Pull down to try again." /> : <CommentThread .../>`.
- Wrapped the `ScrollView` `refreshControl` prop: `<ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>`.

### 14E — `settings/index.tsx`: Push toggle error feedback

**Bug:** The `handlePushToggle` function wrapped everything in a `try/catch` with an empty catch block — any failure during push registration or deregistration was completely silent. The toggle could appear to succeed (or flicker) without the user knowing anything went wrong.

**Fix:** Changed the empty `catch` block to `catch (err) { Alert.alert("Error", err instanceof Error ? err.message : "Could not update notification settings."); }`. Added `Alert` to react-native imports.

### Phase 14 Verification

- [x] Open a space detail screen with API error → EmptyState shown (not infinite skeleton); pull down → retries
- [x] Space detail shows typed inventory item names/quantities without TypeScript errors
- [x] Create share link with no network → Alert shown
- [x] Revoke share link with no network → Alert shown
- [x] Revoke household invitation with no network → Alert shown
- [x] Open project/hobby/idea comments with API error → EmptyState shown (not empty thread)
- [x] Pull down on any comments screen → refreshes the comment list
- [x] Toggle push notifications OFF when API fails → Alert shown, switch state reverts
- [x] `npx tsc --noEmit` passes with no new errors

---

---

## Phase 15 — Offline Queue Propagation ✅ Completed

**Goal:** Route all significant write operations through the offline mutation queue so they work when the device has no connectivity, matching the behaviour already implemented for entry capture.

**Pattern (same as `capture.tsx`):** In each mutation's `onError` handler, check `!isOnline`. If offline, call `enqueueMutation()` with a serialised representation of the request and reset/navigate the UI as if the operation succeeded locally. If online but the server returned an error, show an `Alert` as before.

### 15A: Hobby Session Logging (`hobbies/[id]/sessions.tsx`)

**Bug:** `createHobbySession` has no offline path — logging a session while away from Wi-Fi silently fails with an Alert.

**Fix:** Import `useOfflineSync` and `enqueueMutation`. Add `onError` offline branch: enqueue `POST /v1/households/{householdId}/hobbies/{hobbyId}/sessions` and dismiss the form as if saved. Show an Alert when online but the request fails.

### 15B: Project Task Toggling (`projects/[id]/tasks.tsx`)

**Bug:** `updateProjectTask` has no offline path — toggling a task checkbox while offline shows an error Alert and reverts.

**Fix:** Import `useOfflineSync` and `enqueueMutation`. Add offline branch in `onError`: enqueue `PATCH /v1/households/{householdId}/projects/{projectId}/tasks/{taskId}` with the toggled payload.

### 15C: Maintenance Schedule Completion (`assets/[id]/schedules.tsx`)

**Bug:** `completeSchedule` has no offline path — marking a schedule done offline shows an error.

**Fix:** Import `useOfflineSync` and `enqueueMutation`. Add offline branch in `onError`: enqueue `POST /v1/assets/{assetId}/schedules/{scheduleId}/complete`.

### 15D: Inventory Transactions (`inventory/[id].tsx`)

**Bug:** `createInventoryTransaction` has no offline path — consuming or adjusting stock while offline shows an error.

**Fix:** Import `useOfflineSync` and `enqueueMutation`. Add offline branch in `onError`: enqueue `POST /v1/households/{householdId}/inventory/{itemId}/transactions`.

### 15E: Entity Creation Forms (`hobbies/new.tsx`, `projects/new.tsx`, `ideas/new.tsx`, `inventory/new.tsx`)

**Bug:** All four creation forms navigate to the new entity detail screen on success. When offline, this navigation is impossible (no entity ID). The `onError` handler just sets an inline error string, which is confusing.

**Fix (same pattern for all four):** Add `useOfflineSync` import. In `onError`, check `!isOnline`:
- Enqueue the creation mutation
- Reset the form
- Navigate to the list (`/hobbies`, `/projects`, `/ideas`, `/inventory`) instead of the detail
- The OfflineBanner will surface the pending operation to the user

`assets/new.tsx` is excluded — the multi-step preset flow makes offline creation complex and higher-risk; it is deferred.

### Phase 15 Verification

- [x] Log hobby session with airplane mode → banner shows 1 pending → reconnect → session appears in list
- [x] Toggle task checkbox offline → banner increments → reconnect → task state matches
- [x] Mark schedule done offline → banner increments → reconnect → schedule status updates
- [x] Consume inventory item offline → banner increments → reconnect → quantity decrements
- [x] Create hobby offline → navigate to hobbies list → banner shows pending → reconnect → hobby appears
- [x] Create project offline → navigate to projects list → syncs on reconnect
- [x] Create idea offline → navigate to ideas list → syncs on reconnect
- [x] Create inventory item offline → navigate to list → syncs on reconnect
- [x] `npx tsc --noEmit` passes with no new errors

---

## Phase 16 — Notes Screen Mutation Error Handling ✅ Completed

**Goal:** Close the last class of silent mutations — all four entity notes screens (`assets`, `projects`, `hobbies`, `ideas`) had three `useMutation` calls each (create, update, delete) with no `onError` handler. A failed save, edit, or delete left the user with no feedback.

**Fix (identical for all 4 screens):**
- Added `Alert` to the `react-native` import
- Added `onError: (err: Error) => Alert.alert("Error", err.message ?? "fallback")` to each of the three mutations (`addNote`/create, `saveEdit`, `remove`)

**Files changed:**
- `apps/mobile/app/assets/[id]/notes.tsx`
- `apps/mobile/app/projects/[id]/notes.tsx`
- `apps/mobile/app/hobbies/[id]/notes.tsx`
- `apps/mobile/app/ideas/[id]/notes.tsx`

### Phase 16 Verification

- [x] All 33 mobile screen files audited — zero infinite-skeleton bugs remaining
- [x] All mutations across all screens have `onError` handlers
- [x] `npx tsc --noEmit` passes with zero errors

---

## Phase 17 — Analytics Charts & PDF Export ✅ Completed

### 17A: Analytics Charts
Added visual charts to `apps/mobile/app/analytics/index.tsx` using `react-native-gifted-charts` + `react-native-svg`:

- **Schedule Compliance card**: donut gauge showing on-time rate % (PieChart), plus area line chart of monthly on-time rate trend over 12 months (LineChart)
- **Cost Overview card**: bar chart of top-5 spend categories (BarChart), plus bar chart of monthly spend over 12 months (BarChart)
- **Spend Forecast card**: bar chart comparing 3-month, 6-month, and 12-month forecast values (BarChart)
- All charts use `theme.colors.primary` / `theme.colors.secondary` so they respect dark/light mode

### 17B: PDF Export
New screen `apps/mobile/app/export/index.tsx` using `expo-print` + `expo-sharing`:

- Fetches up to 200 household assets via existing `getHouseholdAssets()` API
- Builds a clean HTML table report (name, type, manufacturer, model, condition score, location)
- Calls `Print.printToFileAsync({ html })` to generate PDF on-device
- Calls `Sharing.shareAsync(uri)` to push PDF to the OS share sheet
- Handles: no assets, sharing unavailable, generation errors

### 17C: Navigation wiring
Added "Export" entry to the **Insights** section of `apps/mobile/app/(tabs)/more.tsx` (`icon: "export-variant"`, `route: "/export"`).

### Dependencies added
- `react-native-svg@15.8.0` (Expo SDK 52 managed)
- `expo-print@~14.0.3` (Expo SDK 52 managed)
- `expo-sharing@~13.0.1` (Expo SDK 52 managed)
- `react-native-gifted-charts@^1.4.76`

### Phase 17 Verification

- [x] Analytics screen shows donut gauge, compliance trend line, category bars, monthly spend bars, forecast bars
- [x] Export screen fetches assets and generates/shares a PDF via OS share sheet
- [x] Export entry visible under More → Insights
- [x] `npx tsc --noEmit` passes with zero errors

---

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
