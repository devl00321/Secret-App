import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Helper to safely get the Notifications module
const getNotifications = () => {
  if (Platform.OS !== 'web' && Constants.appOwnership !== 'expo') {
    try {
      return require('expo-notifications');
    } catch (e) {
      console.warn('[NotificationService] Could not require expo-notifications:', e);
      return null;
    }
  }
  return null;
};

export const notificationService = {
  init: () => {
    const Notifications = getNotifications();
    if (!Notifications) return;

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
