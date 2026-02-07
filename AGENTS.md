# AGENT DEFINITION: PROJET FLIKK (v2.2 - High-Performance & Scalable)

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

## 3. ARCHITECTURE RULES

- `app/` : Routing & Layouts only. No business logic inside screens.
- `src/services/` : Singleton Classes (initialized) for GCP, Auth, and API calls.
- `src/hooks/` : Custom hooks wrapping TanStack Query for all server-side logic.
- `src/components/ui/` : Atomic UI components (shadcn-like) via NativeWind.
- `src/components/features/` : Domain-specific modules (VideoFeed, LiveStream, Checkout).
- `src/constants/` : Design Tokens (Colors), and API Endpoints.
- `src/i18n/` : Bilingual config and JSON translations (fr.json, en.json).
- `src/utils/` : Pure functions (Currency formatters, Video compression, Date helpers).

## 4. PERFORMANCE & CODING STANDARDS

- **List Performance:** Always use `FlashList` with a defined `estimatedItemSize`.
- **Video Management:** Use `useVideoPlayer` (expo-video). Handle play/pause via `viewabilityConfig` to optimize battery.
- **Synchronous i18n:** Initialize language using `MMKV.getString('user-language')` to avoid UI flickers on load.
- **Server State:** No `useEffect` for data fetching. Use `useQuery` or `useMutation`.
- **UI Consistency:** Use Tailwind classes only. Respect Flikk design tokens.

## 5. DESIGN TOKENS (FLIKK BRAND)

- **Primary (Action):** `flikk-lime` (`#CCFF00`) - Prices, Buttons, Success.
- **Secondary (Brand):** `flikk-purple` (`#A87FF3`) - Brand identity, Profils.
- **Background:** `flikk-dark` (`#121212`) - Main App background.
- **Surface:** `flikk-card` (`#1E1E1E`) - Overlays, Cards, Bottom Sheets.

## 6. MEDIA & LIVE SPECIFICS

- **Library Picker:** Use `expo-image-picker` with `mediaTypes: 'video'`.
- **Live Stream:** Handle lifecycle (connection/buffering/latency) via `LiveService.ts`.
- **Optimization:** Prefer HLS (.m3u8) for adaptive bitrate streaming in low-bandwidth areas.
