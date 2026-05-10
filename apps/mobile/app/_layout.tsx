import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback } from 'react';
import { AppState, LogBox, useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SplashTransition } from '../src/components/SplashTransition';

// Ignore specific warnings from third-party libraries
LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'No native ExpoFirebaseCore module found',
  'Failed to initialize reCAPTCHA',
  'This method is deprecated (as well as all React Native Firebase namespaced API)',
]);
import 'react-native-reanimated';
import { authInstance, serverTimestamp, db, collection, doc, onSnapshot } from '../src/services/firebase';
import { onAuthStateChanged } from '@react-native-firebase/auth';
import appCheck from '@react-native-firebase/app-check';
import { useLocationStore } from '../src/store/useLocationStore';
import { alertService } from '../src/services/alertService';
import { notificationService } from '../src/services/notificationService';
import { Vibration, Platform } from 'react-native';
import { useAuthStore } from '../src/store/useAuthStore';
import { userService } from '../src/services/userService';
import { locationService } from '../src/services/locationService';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might cause this to error, so we catch it */
});

// Initialize Firebase App Check for production security
try {
  const rnfbProvider = appCheck().newReactNativeFirebaseAppCheckProvider();
  rnfbProvider.configure({
    android: {
      provider: __DEV__ ? 'debug' : 'playIntegrity',
      // Get this token from Firebase Console → App Check → Manage debug tokens
      debugToken: process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN || undefined,
    },
    apple: {
      provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
    },
    web: {
      provider: 'reCaptchaV3',
      siteKey: 'unknown'
    }
  });
  appCheck().initializeAppCheck({ provider: rnfbProvider, isTokenAutoRefreshEnabled: true });
} catch (e) {
  console.warn('App Check initialization failed:', e);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const router = useRouter();
  
  // Local state to track if we've completed the initial auth & data load
  const [isReady, setIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  
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

  useEffect(() => {
    notificationService.init();
  }, []);

  // 1. Auth & Data Listener Setup
  useEffect(() => {
    let userUnsubscribe: () => void = () => {};

    const authUnsubscribe = onAuthStateChanged(authInstance, async (firebaseUser) => {
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
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        userUnsubscribe = onSnapshot(userDocRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            
            // CRITICAL: Preserve the anniversaryDate if it's already in the store (from couple doc)
            const currentStoreProfile = useAuthStore.getState().currentUserProfile;
            const mergedProfile = {
              ...data,
              anniversaryDate: currentStoreProfile?.anniversaryDate || data?.anniversaryDate
            } as import('../src/services/userService').PartnerProfile;

            setCurrentUserProfile(mergedProfile);
            setCoupleId(data?.coupleId || null);
            
            // Sync saved places from Firestore to LocationStore
            if (data?.savedPlaces) {
              import('../src/store/useLocationStore').then(({ useLocationStore }) => {
                useLocationStore.getState().setSavedPlaces(data.savedPlaces);
              });
            }

            if (data?.partnerId) {
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
    const pingUnsubscribe = locationService.subscribeToIncomingPings(user.uid, (ping) => {
      console.log('💓 PING RECEIVED!');
      
      // Fire the full 20-second heartbeat haptic sequence
      alertService.triggerHeartbeatHaptics();

      const partnerName = useAuthStore.getState().currentUserProfile?.partnerNickname || 
                         useAuthStore.getState().partner?.displayName || 
                         'Your love';

      notificationService.sendLocalNotification(
        "Thinking of you ❤️",
        `${partnerName} is thinking about you.`
      );

      useLocationStore.getState().setIncomingPing(ping);
      // Clear the visual ping after 20 seconds to match haptics
      setTimeout(() => {
        useLocationStore.getState().setIncomingPing(null);
      }, 20000);
    });

    // PRESENCE HEARTBEAT (Update every 20s while active to keep session alive)
    const presenceInterval = setInterval(() => {
      if (user?.uid) {
        userService.updateUserPresence(user.uid, true);
      }
    }, 20000);

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

    const coupleDocRef = doc(db, 'couples', coupleId);
    const unsubscribe = onSnapshot(coupleDocRef,
      (snapshot) => {
        if (snapshot && snapshot.exists()) {
          const data = snapshot.data();
          if (data && data.anniversaryDate) {
            // Sync to store immediately so components can use it
            useAuthStore.setState(state => ({
              currentUserProfile: state.currentUserProfile 
                ? { ...state.currentUserProfile, anniversaryDate: data.anniversaryDate }
                : null
            }));
          }
        }
      },
      (error) => {
        console.error('Couple data listener error:', error);
      }
    );

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

  // 3. Presence Tracking (Immediate Signal)
  useEffect(() => {
    if (!user?.uid) return;

    // Set online IMMEDIATELY on mount
    void userService.updateUserPresence(user.uid, true);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // Set online/offline based on AppState
      void userService.updateUserPresence(user.uid, nextAppState === 'active');
    });

    return () => {
      subscription.remove();
      // Set offline on cleanup/unmount
      void userService.updateUserPresence(user.uid, false);
    };
  }, [user?.uid]);

  // 4. Hide native splash screen when ready, then let our animated splash take over
  useEffect(() => {
    if (isReady) {
      // Hide the static native splash immediately
      // Our SplashTransition component takes over with the animation
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
      {/* YouTube-style splash: renders on top of everything, animates out once ready */}
      {showSplash && (
        <SplashTransition onAnimationComplete={() => setShowSplash(false)} />
      )}
    </ThemeProvider>
  );
}
