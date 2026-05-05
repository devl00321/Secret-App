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
  const lastUnlockTime = useRef(0);
  const appState = useRef(AppState.currentState);

  const handleUnlock = async () => {
    // Don't run if already authenticating or if lock is disabled
    if (!biometricLockEnabled || isAuthInProgress.current) {
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
        biometricService.showSecurityAlert();
      }
    } catch (err) {
      console.error('[AppLock] Auth error:', err);
    } finally {
      setIsAuthenticating(false);
      // Delay before allowing next auth
      setTimeout(() => {
        isAuthInProgress.current = false;
      }, 1000);
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
      const wasBackgrounded = appState.current.match(/inactive|background/);
      const isNowActive = nextAppState === 'active';
      const timeSinceUnlock = Date.now() - lastUnlockTime.current;

      // Only trigger lock if we are coming BACK to the app 
      // AND it's been more than 3 seconds since the last unlock (prevents flickering loops)
      if (
        wasBackgrounded && 
        isNowActive && 
        biometricLockEnabled && 
        !isAuthInProgress.current &&
        timeSinceUnlock > 3000
      ) {
        setIsLocked(true);
        handleUnlock();
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [biometricLockEnabled]);

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
