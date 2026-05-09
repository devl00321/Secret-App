import { Platform, Vibration } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useLocationStore } from '../store/useLocationStore';
import { useAuthStore } from '../store/useAuthStore';
import { auth } from './firebase';

/**
 * Priority-based Alert Escalation Service
 * 
 * Alert Levels:
 *   🔴 CRITICAL (SOS / Auto-SOS)    → Loud siren loop + intense haptics + full-screen alert
 *   🟡 WARNING  (Walk Safe overdue)  → Alert tone + medium haptics + banner
 *   🟢 INFO     (arrived safely)     → Gentle chime + light haptic + subtle notification
 */

export type AlertPriority = 'critical' | 'warning' | 'info';

let sirenSound: Audio.Sound | null = null;
let sirenInterval: ReturnType<typeof setInterval> | null = null;

// Local state to ensure absolute silence for the victim even if Firestore sync is slow
let victimSilenceOverride = false;

// Generate an aggressive siren tone using oscillating vibration patterns
const SIREN_VIBRATION_PATTERN = Platform.OS === 'android'
  ? [0, 600, 100, 600, 100, 600, 100, 600, 100, 1000] // Aggressive sharp pulses
  : []; 

export const alertService = {
  setVictimSilence: (silent: boolean) => {
    victimSilenceOverride = silent;
    if (silent) {
      alertService.stopSiren();
      Vibration.cancel();
    }
  },
  /**
   * Trigger an alert with the given priority level.
   * Higher priorities produce louder, more persistent alerts.
   */
  triggerAlert: async (priority: AlertPriority, title: string, body: string) => {
    const { activeSos } = useLocationStore.getState();
    const userId = useAuthStore.getState().user?.uid || auth().currentUser?.uid;
    
    console.log(`[AlertService] ATTEMPT: ${priority} | User: ${userId} | SOS TriggeredBy: ${activeSos?.triggeredBy} | Silent: ${activeSos?.isSilent}`);

    // FINAL SAFETY GATE: If this is a Silent SOS triggered by ME, absolute silence.
    if (victimSilenceOverride || (activeSos?.isActive && activeSos.isSilent && activeSos.triggeredBy === userId)) {
      console.log('[AlertService] SILENT SOS SUPPRESSION ACTIVATED - BLOCKING ALL SOUND/VIBRATION');
      return;
    }

    console.log(`[AlertService] EXECUTING: ${priority} alert: ${title}`);

    switch (priority) {
      case 'critical':
        await alertService._triggerCritical(title, body);
        break;
      case 'warning':
        await alertService._triggerWarning(title, body);
        break;
      case 'info':
        await alertService._triggerInfo(title, body);
        break;
    }
  },

  // ─── CRITICAL: Loud siren + intense haptics ────────────────────────

  _triggerCritical: async (_title: string, _body: string) => {
    if (Platform.OS === 'web') return;

    try {
      // Configure audio for maximum urgency
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true, // CRITICAL: plays even on silent mode
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });

      // Start siren haptic pattern — intense and fast
      alertService._startSirenHaptics();

      // Play system-level alert sound
      // We use a synthesized alert via rapid haptic bursts since
      // Expo Go can't load custom audio files reliably
      await alertService._playSirenTone();

    } catch (err) {
      console.error('[AlertService] Critical alert failed:', err);
      // Fallback: at least vibrate
      alertService._fallbackVibrate('critical');
    }
  },

  _startSirenHaptics: () => {
    const { activeSos } = useLocationStore.getState();
    const userId = useAuthStore.getState().user?.uid || auth().currentUser?.uid;
    
    if (victimSilenceOverride || (activeSos?.isActive && activeSos.isSilent && activeSos.triggeredBy === userId)) {
      console.log('[AlertService] EMERGENCY BRAKE: Haptics blocked during Silent SOS.');
      return;
    }

    // Stop any existing siren
    alertService.stopSiren();

    let cycle = 0;
    // Faster interval for more "panic" feel
    sirenInterval = setInterval(() => {
      if (Platform.OS === 'android') {
        Vibration.vibrate(SIREN_VIBRATION_PATTERN);
      } else {
        // iOS: High-frequency heavy pulses for extreme urgency
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 100);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 250);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 550);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 700);
      }
      cycle++;
    }, 1000); // Repeat every 1 second (faster panic rhythm)
  },

  _playSirenTone: async () => {
    const { activeSos } = useLocationStore.getState();
    const userId = useAuthStore.getState().user?.uid || auth().currentUser?.uid;
    
    if (victimSilenceOverride || (activeSos?.isActive && activeSos.isSilent && activeSos.triggeredBy === userId)) {
      console.log('[AlertService] EMERGENCY BRAKE: Siren blocked during Silent SOS.');
      return;
    }

    try {
      // Ensure any existing sound is cleaned up first
      if (sirenSound) {
        try {
          await sirenSound.stopAsync();
          await sirenSound.unloadAsync();
        } catch (e) {}
      }

      // Create a programmatic alarm using expo-av
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' },
        { 
          isLooping: true, 
          volume: 1.0,
          shouldPlay: true,
        }
      );
      sirenSound = sound;
    } catch (err) {
      console.warn('[AlertService] Could not play siren audio, using haptics only:', err);
    }
  },

  /** Stop the siren — called when the user acknowledges the alert */
  stopSiren: async () => {
    if (sirenInterval) {
      clearInterval(sirenInterval);
      sirenInterval = null;
    }
    if (sirenSound) {
      try {
        await sirenSound.stopAsync();
        await sirenSound.unloadAsync();
      } catch (e) {}
      sirenSound = null;
    }
    if (Platform.OS === 'android') {
      Vibration.cancel();
    }
    console.log('[AlertService] Siren stopped');
  },

  // ─── WARNING: Alert tone + medium haptics ──────────────────────────

  _triggerWarning: async (_title: string, _body: string) => {
    if (Platform.OS === 'web') return;

    const { activeSos } = useLocationStore.getState();
    const userId = useAuthStore.getState().user?.uid || auth().currentUser?.uid;
    if (victimSilenceOverride || (activeSos?.isActive && activeSos.isSilent && activeSos.triggeredBy === userId)) {
      return;
    }

    try {
      // Medium-intensity haptic burst (3 pulses)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, 400);
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }, 800);

      // Short vibration on Android
      if (Platform.OS === 'android') {
        Vibration.vibrate([0, 200, 100, 200, 100, 200]);
      }
    } catch (err) {
      console.error('[AlertService] Warning alert failed:', err);
      alertService._fallbackVibrate('warning');
    }
  },

  // ─── INFO: Gentle chime + light haptic ─────────────────────────────

  _triggerInfo: async (_title: string, _body: string) => {
    if (Platform.OS === 'web') return;

    const { activeSos } = useLocationStore.getState();
    const userId = useAuthStore.getState().user?.uid || auth().currentUser?.uid;
    if (victimSilenceOverride || (activeSos?.isActive && activeSos.isSilent && activeSos.triggeredBy === userId)) {
      return;
    }

    try {
      // Single gentle haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[AlertService] Info alert failed:', err);
    }
  },

  // ─── HEARTBEAT: Gentle double-pulse for 15 seconds ──────────────────
  
  triggerHeartbeatHaptics: async () => {
    if (Platform.OS === 'web') return;

    const duration = 15000; // 15 seconds
    const interval = 1500;  // Every 1.5 seconds
    let startTime = Date.now();

    const pulse = async () => {
      try {
        // High-fidelity double-thump heartbeat
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setTimeout(async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }, 120);
      } catch (e) {
        console.warn('Heartbeat haptic failed:', e);
      }
    };

    // Initial pulse
    pulse();

    const heartbeatInterval = setInterval(() => {
      if (Date.now() - startTime >= duration) {
        clearInterval(heartbeatInterval);
        return;
      }
      pulse();
    }, interval);
  },

  // ─── Fallback vibration ────────────────────────────────────────────

  _fallbackVibrate: (priority: AlertPriority) => {
    if (Platform.OS === 'web') return;

    const { activeSos } = useLocationStore.getState();
    const userId = useAuthStore.getState().user?.uid || auth().currentUser?.uid;
    if (victimSilenceOverride || (activeSos?.isActive && activeSos.isSilent && activeSos.triggeredBy === userId)) {
      return;
    }

    switch (priority) {
      case 'critical':
        Vibration.vibrate([0, 500, 200, 500, 200, 500, 200, 500, 200, 500]);
        break;
      case 'warning':
        Vibration.vibrate([0, 200, 100, 200, 100, 200]);
        break;
      case 'info':
        Vibration.vibrate(100);
        break;
    }
  },
};
