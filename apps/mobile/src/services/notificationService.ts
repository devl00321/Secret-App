import { Platform } from 'react-native';
import Constants from 'expo-constants';
import messaging, { getMessaging, onTokenRefresh } from '@react-native-firebase/messaging';
import { db, authInstance, doc, updateDoc } from './firebase';

// Helper to safely get the Notifications module
const getNotifications = () => {
  // Only attempt to load expo-notifications in native environments
  if (Platform.OS === 'web' || Constants.appOwnership === 'expo') return null;

  try {
    // Check if the native module exists in NativeModules first
    const { NativeModules } = require('react-native');
    if (!NativeModules.ExpoPushTokenManager) {
      return null;
    }

    const Notifications = require('expo-notifications');
    return Notifications;
  } catch (e) {
    return null;
  }
};

export const notificationService = {
  init: async () => {
    // 1. Initialize Local Notifications (Expo)
    const Notifications = getNotifications();
    if (Notifications) {
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
      } catch (e) {
        console.warn('[NotificationService] Initialization failed:', e);
      }
    }

    // 2. Initialize Push Notifications (FCM) ONLY FOR ANDROID per user request
    if (Platform.OS === 'android') {
      try {
        const messagingInstance = getMessaging();
        
        // Request permission (mostly for Android 13+)
        const authStatus = await messagingInstance.requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          // VUL-9 FIX: Only log auth status in dev — not a secret, but good hygiene
          if (__DEV__) console.log('[NotificationService] FCM Authorization status:', authStatus);
          
          // Get the token
          const fcmToken = await messagingInstance.getToken();
          if (fcmToken) {
            // VUL-9 FIX: FCM tokens are sensitive — never log in production
            if (__DEV__) console.log('[NotificationService] FCM Token obtained (dev only)');
            await notificationService.saveTokenToFirestore(fcmToken);
          }

          // Listen to whether the token changes
          onTokenRefresh(messagingInstance, async (token) => {
            if (__DEV__) console.log('[NotificationService] FCM Token refreshed (dev only)');
            await notificationService.saveTokenToFirestore(token);
          });

          // Listen for foreground messages
          messagingInstance.onMessage(async (remoteMessage) => {
            if (remoteMessage.data?.type === 'geofence') {
              try {
                const { event, placeNameEnc, partnerName } = remoteMessage.data;
                const { useAuthStore } = require('../../store/useAuthStore');
                const { encryptionService } = require('../encryptionService');
                
                const store = useAuthStore.getState();
                let secret = store.sharedSecret;
                if (!secret && store.coupleId) secret = encryptionService.getLegacySecret(store.coupleId);
                if (!secret) secret = encryptionService.LEGACY_NO_COUPLE_SENTINEL;

                let placeName = "a saved place";
                if (placeNameEnc) {
                  placeName = await encryptionService.decryptObject(placeNameEnc, secret) || "a saved place";
                }

                const actionText = event === 'arrival' ? 'arrived at' : 'left';
                const title = event === 'arrival' ? '🏡 Safely Arrived!' : '🚗 On the Move!';
                const msg = `Your ${partnerName || 'partner'} has ${actionText} ${placeName}.`;
                
                const { alertService } = require('../alertService');
                alertService.triggerAlert('info', title, msg);
                
                await notificationService.sendLocalNotification(title, msg);
              } catch (e) {
                console.warn('[Foreground FCM] Failed to handle geofence message:', e);
              }
            }
          });
        }
      } catch (e) {
        console.warn('[NotificationService] FCM setup failed:', e);
      }
    } else {
      console.log('[NotificationService] Push notifications currently disabled for iOS.');
    }
  },

  saveTokenToFirestore: async (token: string) => {
    const user = authInstance.currentUser;
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          fcmToken: token,
          fcmTokenUpdatedAt: Date.now()
        });
      } catch (e) {
        console.warn('[NotificationService] Failed to save FCM token:', e);
      }
    }
  },

  sendLocalNotification: async (title: string, body: string) => {
    const Notifications = getNotifications();
    if (!Notifications) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: null,
      });
    } catch (e) {
      console.warn('[NotificationService] Failed to send notification:', e);
    }
  }
};
