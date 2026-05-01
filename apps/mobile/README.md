# LUVV Mobile

Expo Router mobile client for the LUVV couple app.

## Scripts

```bash
npm install
npm run start --workspace mobile
npm run lint --workspace mobile
npm run typecheck --workspace mobile
```

## Environment

Copy `apps/mobile/.env.example` to `.env` and set the values you need.

- `EXPO_PUBLIC_FIREBASE_*`: Firebase project configuration
- `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`: platform-specific Google auth client IDs

Google sign-in stays disabled on native builds until the relevant client ID is configured.

## App structure

- `app/`: Expo Router routes
- `src/screens/`: routed screen implementations
- `src/services/`: Firebase, auth, and pairing logic
- `src/store/`: Zustand state
- `src/theme/`: shared design tokens
