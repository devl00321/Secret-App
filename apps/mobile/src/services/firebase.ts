import 'react-native-get-random-values';
import { initializeApp } from 'firebase/app';
// @ts-expect-error: getReactNativePersistence is available in the React Native SDK but not in the web types
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyCsRH4VA-5hVqer3PBdYKaxpfnEmQg_MkI',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'couple-app-60de2.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'couple-app-60de2',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'couple-app-60de2.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '941648671576',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '1:941648671576:web:d1314750ac5361fe23eb2d',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? 'G-WMGKNKJ06G',
};

const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence - wrap in try-catch to handle multiple initializations during hot-reload
const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (e) {
    return getAuth(app);
  }
})();

export { auth };

// Force Long Polling for maximum network compatibility
const getSafeDb = () => {
  try {
    // Try to get the existing instance
    return getFirestore(app);
  } catch (e) {
    // If it doesn't exist, initialize it with custom settings
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  }
};

export const db = getSafeDb();
