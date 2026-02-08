# AGENT DEFINITION: PROJET FLIKK (v2.3)

## 1. IDENTITY & CONTEXT

- **Project Name:** FLIKK (The TikTok of Commerce in Africa).
- **Core Concept:** Mobile-first video commerce (Vertical feed, Live Shopping, Instant checkout).
- **Target Market:** Africa (Optimized for Mobile Money & local network constraints).
- **Default Theme:** Always **DARK MODE** (`#121212`).
- **Languages:** Bilingual support (French & English).

## 2. TECH STACK (STRICT)

- **Framework:** Expo SDK 55 (New Architecture / Fabric).
- **Language:** TypeScript (Strict Mode).
- **Styling:** NativeWind v4 (Tailwind CSS).
- **Navigation:** Expo Router (File-based).
- **Video:** `expo-video`. **NEVER use expo-av.**
- **Lists:** `@shopify/flash-list` (Mandatory for performance).
- **Data Fetching:** `@tanstack/react-query` v5+.
- **Storage:** `react-native-mmkv` (Synchronous storage). **NEVER use AsyncStorage.**
- **State Management:** `Zustand` (with MMKV persistence).
- **i18n:** `i18next` + `react-i18next` (Persisted via MMKV).
- **Backend:** Google Cloud Platform (GCP) & Firebase.

## 3. ARCHITECTURE & TYPE RULES

- **Global Types:** All shared interfaces, enums, and types **MUST** be defined in `src/types/index.ts`. No business types allowed in local files or components.
- **`app/`** : Routing & Layouts only. No business logic inside screens.
- **`src/services/`** : Singleton Classes for GCP, Auth, and API calls.
- **`src/hooks/`** : Custom hooks wrapping TanStack Query for all server-side logic.
- **`src/components/ui/`** : Atomic UI components (shadcn-like) via NativeWind.
- **`src/components/features/`** : Domain-specific modules (VideoFeed, LiveStream, Checkout).
- **`src/constants/`** : Design Tokens (Colors), and API Endpoints.
- **`src/utils/`** : Pure functions (Currency formatters, Video compression, Date helpers).

## 4. NAVIGATION STRATEGY (GUEST-FIRST)

- **Pattern:** Expo Router.
- **Groups:**
  - `(tabs)` : Main App (Home, Search, Orders, Profile). Accessible to everyone.
  - `(auth)` : Signup/Login flow. Triggered only when action requires account.
- **Logic:** Users can watch videos and browse products as guests. Authentication is requested ONLY for: **Posting, Liking, or Buying**.

## 5. PERFORMANCE & CODING STANDARDS

- **Lists:** Always use `FlashList` with `estimatedItemSize`.
- **Video:** Use `useVideoPlayer`. Handle lifecycle via `viewabilityConfig` to save battery.
- **i18n:** Initialize language using `MMKV.getString('user-language')` to avoid UI flickers.
- **Server State:** No `useEffect` for fetching. Use `useQuery` or `useMutation`.
- **Typing:** Strict TypeScript. Use `PascalCase` for Interfaces/Types and `camelCase` for properties.

## 6. DESIGN TOKENS (FLIKK BRAND)

- **Primary (Action):** `flikk-lime` (`#CCFF00`) - Main buttons (the "+"), prices, success.
- **Secondary (Brand):** `flikk-purple` (`#A87FF3`) - Active tabs, profile highlights.
- **Background:** `flikk-dark` (`#121212`) - Main App background.
- **Surface:** `flikk-card` (`#1E1E1E`) - Overlays, Cards, Bottom Sheets.
