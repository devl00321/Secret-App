import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback } from 'react';
import { AppState, LogBox } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Ignore specific warnings from third-party libraries
LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'No native ExpoFirebaseCore module found',
  'Failed to initialize reCAPTCHA',
]);
import 'react-native-reanimated';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '../src/store/useAuthStore';
import { auth, db } from '../src/services/firebase';
import { userService } from '../src/services/userService';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might cause this to error, so we catch it */
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const router = useRouter();
  
  // Local state to track if we've completed the initial auth & data load
  const [isReady, setIsReady] = useState(false);
  
  const { 
    user, 
    setUser, 
    setPartner, 
    setCoupleId, 
    setLoading, 
    coupleId 
  } = useAuthStore();

  // 1. Auth & Data Listener Setup
  useEffect(() => {
    let userUnsubscribe: () => void = () => {};

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Always set the user state immediately to reflect current auth status
      setUser(firebaseUser);
      
      if (!firebaseUser) {
        // User logged out
        setPartner(null);
        setCoupleId(null);
        userUnsubscribe();
        setLoading(false);
        setIsReady(true);
        return;
      }

      // User logged in, sync record and setup listener
      try {
        await userService.createUserIfNotExists(firebaseUser);
        
        // Listen for real-time user document changes
        userUnsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setCoupleId(data.coupleId || null);
            
            if (data.partnerId) {
              const partnerData = await userService.getUserData(data.partnerId);
              setPartner(partnerData);
            } else {
              setPartner(null);
            }
          }
          setLoading(false);
          setIsReady(true);
        }, (err) => {
          console.error('Snapshot error:', err);
          setLoading(false);
          setIsReady(true);
        });
      } catch (error) {
        console.error('Initial sync error:', error);
        setLoading(false);
        setIsReady(true);
      }
    });

    return () => {
      authUnsubscribe();
      userUnsubscribe();
    };
  }, [setCoupleId, setLoading, setPartner, setUser]);

  // 2. Navigation Control
  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onPairingPage = segments.some(s => s === 'pairing');
    const paired = !!coupleId;

    if (!user) {
      // If not logged in, ensure we are in the auth group
      if (!inAuthGroup) {
        router.replace('/(auth)');
      }
    } else if (!paired) {
      // Logged in but not paired -> Go to pairing
      if (!onPairingPage) {
        router.replace('/(auth)/pairing');
      }
    } else {
      // Logged in and paired -> Go to app
      if (inAuthGroup || onPairingPage) {
        router.replace('/(app)/(tabs)');
      }
    }
  }, [user, coupleId, isReady, segments, router]);

  // 3. Presence Tracking
  useEffect(() => {
    if (!user?.uid) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      void userService.updateUserPresence(user.uid, nextAppState === 'active');
    });

    return () => {
      subscription.remove();
      void userService.updateUserPresence(user.uid, false);
    };
  }, [user?.uid]);

  // 4. Hide Splash Screen when ready
  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady]);

  // Don't render anything while we are determining the initial route
  // The splash screen covers this phase
  if (!isReady) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
