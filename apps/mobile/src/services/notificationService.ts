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
          console.log('[NotificationService] FCM Authorization status:', authStatus);
          
          // Get the token
          const fcmToken = await messagingInstance.getToken();
          if (fcmToken) {
            console.log('[NotificationService] FCM Token:', fcmToken);
            await notificationService.saveTokenToFirestore(fcmToken);
          }

          // Listen to whether the token changes
          onTokenRefresh(messagingInstance, async (token) => {
            console.log('[NotificationService] FCM Token refreshed:', token);
            await notificationService.saveTokenToFirestore(token);
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
