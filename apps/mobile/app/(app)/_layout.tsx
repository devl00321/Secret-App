import React, { useState, useEffect, useRef } from 'react';
import { AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { biometricService } from '../../src/services/biometricService';
import { LockOverlay } from '../../src/components/LockOverlay';

export default function AppLayout() {
  const { biometricLockEnabled } = useSettingsStore();
  const [isLocked, setIsLocked] = useState(biometricLockEnabled);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const isAuthInProgress = useRef(false);
  const hasInitialCheckRun = useRef(false);
  const lastUnlockTime = useRef(Date.now());
  const backgroundTimestamp = useRef<number | null>(null);
  const appState = useRef(AppState.currentState);

  const handleUnlock = async () => {
    // Don't run if already authenticating, if lock is disabled, or if already unlocked
    if (!biometricLockEnabled || isAuthInProgress.current || !isLocked) {
      return;
    }

    isAuthInProgress.current = true;
    setIsAuthenticating(true);
    
    try {
      const success = await biometricService.authenticate('Unlock Love App');
      if (success) {
        setIsLocked(false);
        lastUnlockTime.current = Date.now();
      } else {
        // If they cancel/fail, we stay locked but don't immediately prompt again
        // they can tap the "Unlock" button on the overlay
      }
    } catch (err) {
      console.error('[AppLock] Auth error:', err);
    } finally {
      setIsAuthenticating(false);
      // Cooldown period after any auth attempt to prevent loops
      setTimeout(() => {
        isAuthInProgress.current = false;
      }, 2000);
    }
  };

  useEffect(() => {
    if (biometricLockEnabled && !hasInitialCheckRun.current) {
      hasInitialCheckRun.current = true;
      handleUnlock();
    } else if (!biometricLockEnabled) {
      setIsLocked(false);
    }
  }, [biometricLockEnabled]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasActive = appState.current === 'active';
      const isNowActive = nextAppState === 'active';
      const isNowBackground = nextAppState.match(/inactive|background/);

      if (isNowBackground && wasActive) {
        backgroundTimestamp.current = Date.now();
      }

      if (isNowActive && backgroundTimestamp.current) {
        const timeInBackground = Date.now() - backgroundTimestamp.current;
        const timeSinceLastUnlock = Date.now() - lastUnlockTime.current;

        // CRITICAL GUARD:
        // Only re-lock if the app was in the background for more than 10 seconds.
        // Biometric prompts usually make the app 'inactive' for 1-3 seconds.
        // Also ensure we don't trigger if an auth is already being processed.
        if (
          biometricLockEnabled && 
          timeInBackground > 10000 && 
          timeSinceLastUnlock > 5000 &&
          !isAuthInProgress.current
        ) {
          setIsLocked(true);
          // Small delay before prompting to ensure UI has settled
          setTimeout(handleUnlock, 500);
        }
        
        backgroundTimestamp.current = null;
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [biometricLockEnabled, isLocked]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[chatId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile" />
      </Stack>
      
      {isLocked && biometricLockEnabled && (
        <LockOverlay 
          onUnlock={handleUnlock} 
          isAuthenticating={isAuthenticating} 
        />
      )}
    </View>
  );
}
