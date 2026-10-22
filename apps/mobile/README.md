# 📱 LUVV Mobile Client

The native iOS and Android client for **LUVV**, built with **React Native 0.81**, **Expo SDK 54**, and **Expo Router v6**. Designed with a Zero-Knowledge End-to-End Encryption architecture, real-time location services, and Google Gemini 1.5 Flash contextual safety.

---

## 🚀 Key Modules & Capabilities

- **🔐 End-to-End Cryptography Engine**:
  - ECDH (NIST P-256) key exchange via `react-native-quick-crypto` (native OpenSSL C++ bindings)
  - AES-256-GCM authenticated encryption with PBKDF2 (100k iterations)
  - Hardware-backed private key protection in `expo-secure-store`
  - Encrypted state persistence with device hardware key (`encryptedStorage`)
- **🚨 Luvv Guard Emergency System**:
  - Dual-mode SOS: Loud Critical Siren (AudioSession silent mode override) & Stealth / Silent SOS (Victim Silence software brake)
  - Dual-camera evidence capture (`EmergencyCapture.tsx`): 10-shot bursts front & back
  - Biometric authentication gate (FaceID / Fingerprint) to disarm SOS
  - Drag-and-drop prioritized emergency guardians (`react-native-draggable-flatlist`)
- **📍 Real-Time Location & Geofencing**:
  - Background tracking task with Android foreground service
  - WalkSafe ("Reach Safely") mode with live path rendering (`pathEnc`), ETA tracking, and auto-SOS escalation
  - Smart Geofenced places with data-only silent push notification decryption
  - Turn-by-turn navigation with dynamic camera pitch/heading and voice guidance (`expo-speech`)
- **💖 Intimate Interaction Suite**:
  - Heartbeat touch with physiological ~67 BPM "lub-dub" double-pulse haptics
  - Relationship Pulse live ticker down to the second
  - Real-time Haversine physical distance calculation
  - Acoustic remote ringing on demand
  - Connection streak tracking and shared timeline memory journal
  - End-to-end encrypted real-time chat with auto media caching

---

## 🛠️ Scripts & Local Development

```bash
# Install dependencies from root
npm install

# Start development server
npm run start --workspace mobile

# Run on iOS simulator (Native Prebuild)
npm run ios --workspace mobile

# Run on Android emulator
npm run android --workspace mobile

# Run linter
npm run lint --workspace mobile

# Run TypeScript typechecks
npm run typecheck --workspace mobile
```

---

## 📂 Architecture

- `app/`: Typed file-based routing with Expo Router (`(auth)`, `(app)/(tabs)`, `chat`, dynamic segments)
- `src/components/`: Modular design system components (`Location/`, `Safety/`, `ui/`)
- `src/services/`: Core logic:
  - `encryption/`: AES-256-GCM, ECDH key derivation, byte encoding
  - `location/`: Background tracking, WalkSafe monitor, SOS service, pings
  - `aiService.ts`: Contextual Gemini safety analysis
  - `alertService.ts`: Priority-based audio session and haptic escalation
  - `backupService.ts`: Encrypted `.luvvbackup` export/import
  - `biometricService.ts`: Local FaceID / Fingerprint hardware check
- `src/store/`: Zustand state management (`useAuthStore`, `useLocationStore`, `chat`, `useSettingsStore`)
- `src/theme/`: Custom dark luxury palette, typography, and dark/silver map styles
- `hooks/`: Native Expo config plugins (`withPodfileFix.js`, `withNoPushEntitlement.js`)
