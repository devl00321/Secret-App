import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '../src/store/useAuthStore';
import { auth, db } from '../src/services/firebase';
import { userService } from '../src/services/userService';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const router = useRouter();
  
  const { user, loading, setUser, setPartner, setCoupleId, setLoading, coupleId } = useAuthStore();

  // 1. Auth & Data Listener
  useEffect(() => {
    let userUnsubscribe: () => void = () => {};

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Sync user base record
          await userService.createUserIfNotExists(firebaseUser);
          setUser(firebaseUser);

          // 2. Real-time User Document Listener
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
            setLoading(false); // Only stop loading after first snapshot
          }, (err) => {
            console.error('Snapshot error:', err);
            setLoading(false);
          });
        } else {
          setUser(null);
          setPartner(null);
          setCoupleId(null);
          userUnsubscribe();
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      userUnsubscribe();
    };
  }, [setCoupleId, setLoading, setPartner, setUser]);

  // 3. Protected Routing Logic
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onPairingPage = segments.some((segment) => segment === 'pairing');
    const paired = !!coupleId;

    if (!user) {
      // Not logged in -> Auth flow
      if (!inAuthGroup) router.replace('/(auth)');
    } else {
      // Logged in
      if (!paired) {
        // Not paired yet -> Pairing screen
        if (!onPairingPage) router.replace('/(auth)/pairing');
      } else {
        // Paired -> Main app
        if (inAuthGroup || onPairingPage) router.replace('/(app)/(tabs)');
      }
    }
  }, [coupleId, loading, router, segments, user]);

  // Presence Tracking
  useEffect(() => {
    if (!user?.uid) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const isOnline = nextAppState === 'active';
      void userService.updateUserPresence(user.uid, isOnline);
    });

    return () => {
      subscription.remove();
      void userService.updateUserPresence(user.uid, false);
    };
  }, [user?.uid]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#121212' : '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
