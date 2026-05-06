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
import { locationService } from '../src/services/locationService';

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
    currentUserProfile,
    setCurrentUserProfile,
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
            
            // CRITICAL: Preserve the anniversaryDate if it's already in the store (from couple doc)
            const currentStoreProfile = useAuthStore.getState().currentUserProfile;
            const mergedProfile = {
              ...data,
              anniversaryDate: currentStoreProfile?.anniversaryDate || data.anniversaryDate
            } as import('../src/services/userService').PartnerProfile;

            setCurrentUserProfile(mergedProfile);
            setCoupleId(data.coupleId || null);
            
            // Sync saved places from Firestore to LocationStore
            if (data.savedPlaces) {
              import('../src/store/useLocationStore').then(({ useLocationStore }) => {
                useLocationStore.getState().setSavedPlaces(data.savedPlaces);
              });
            }

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
          console.warn('Snapshot error:', err);
          setLoading(false);
          setIsReady(true);
        });
      } catch (error) {
        console.warn('Initial sync error:', error);
        setLoading(false);
        setIsReady(true);
      }
    });

    return () => {
      authUnsubscribe();
      userUnsubscribe();
    };
  }, [setCoupleId, setLoading, setPartner, setUser]);

  // 1.1 Global Emergency & Location Listeners
  useEffect(() => {
    if (!coupleId || !user) return;

    // Use a small delay to ensure everything is initialized
    const timer = setTimeout(() => {
      console.log('[RootLayout] Initializing Safety Listeners...');
    }, 500);

    const sosUnsubscribe = locationService.subscribeToCoupleSos(coupleId, user.uid);
    const pingUnsubscribe = locationService.subscribeToIncomingPings(coupleId, (ping) => {
      // Global ping handling
      import('../src/services/alertService').then(({ alertService }) => {
        alertService.triggerHeartbeatHaptics();
      });
      import('../src/store/useLocationStore').then(({ useLocationStore }) => {
        useLocationStore.getState().setIncomingPing(ping);
        // Clear the visual ping after 15 seconds to match haptics
        setTimeout(() => {
          useLocationStore.getState().setIncomingPing(null);
        }, 15000);
      });
    });

    // PRESENCE HEARTBEAT (Update every 20s while active)
    const updatePresence = async () => {
      if (!user?.uid) return;
      try {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        const { db } = await import('../src/services/firebase');
        await updateDoc(doc(db, 'users', user.uid), {
          isOnline: true,
          lastActive: serverTimestamp()
        });
      } catch (e) {}
    };
    updatePresence();
    const presenceInterval = setInterval(updatePresence, 20000);

    let partnerUnsubscribe = () => {};
    if (currentUserProfile?.partnerId) {
      partnerUnsubscribe = locationService.subscribeToPartner(currentUserProfile.partnerId);
    }

    return () => {
      clearTimeout(timer);
      sosUnsubscribe();
      pingUnsubscribe();
      partnerUnsubscribe();
      clearInterval(presenceInterval);
      // Ensure siren stops if app is totally unmounted (rare)
      import('../src/services/alertService').then(({ alertService }) => alertService.stopSiren());
    };
  }, [coupleId, user?.uid, currentUserProfile?.partnerId]);

  // 1.2 Couple Data Listener (Source of truth for shared info like anniversary)
  useEffect(() => {
    if (!coupleId) return;

    const unsubscribe = onSnapshot(doc(db, 'couples', coupleId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.anniversaryDate) {
          // Sync to store immediately so components can use it
          useAuthStore.setState(state => ({
            currentUserProfile: state.currentUserProfile 
              ? { ...state.currentUserProfile, anniversaryDate: data.anniversaryDate }
              : null
          }));
        }
      }
    });

    return () => unsubscribe();
  }, [coupleId]);

  // 2. Navigation Control
  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onPairingPage = segments.some(s => s === 'pairing');
    const onSetupPage = segments.some(s => s === 'setup-profile');
    
    const paired = !!coupleId;
    const profileComplete = currentUserProfile?.profileSetupComplete;

    if (!user) {
      // If not logged in, ensure we are in the auth group
      if (!inAuthGroup) {
        router.replace('/(auth)');
      }
    } else if (!profileComplete) {
      // Logged in but profile setup not complete -> Go to setup
      if (!onSetupPage) {
        router.replace('/(auth)/setup-profile');
      }
    } else if (!paired) {
      // Logged in, profile complete, but not paired -> Go to pairing
      if (!onPairingPage) {
        router.replace('/(auth)/pairing');
      }
    } else {
      // Logged in and paired -> Go to app
      if (inAuthGroup || onPairingPage || onSetupPage) {
        router.replace('/(app)/(tabs)');
      }
    }
  }, [user, coupleId, currentUserProfile?.profileSetupComplete, isReady, segments, router]);

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
