import 'expo-router/entry';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from './src/services/notificationService';

messaging().setBackgroundMessageHandler(async remoteMessage => {
  if (remoteMessage.data?.type === 'geofence') {
    try {
      const { event, placeNameEnc, partnerName } = remoteMessage.data;
      const { encryptionService } = require('./src/services/encryptionService');
      
      const authStorage = await AsyncStorage.getItem('auth-storage');
      let secret = encryptionService.LEGACY_NO_COUPLE_SENTINEL;
      
      if (authStorage) {
        try {
          const authData = JSON.parse(authStorage);
          if (authData.state?.sharedSecret) {
            secret = authData.state.sharedSecret;
          } else if (authData.state?.coupleId) {
            secret = encryptionService.getLegacySecret(authData.state.coupleId);
          }
        } catch (e) {
          console.warn('[Background FCM] Error parsing auth storage', e);
        }
      }

      let placeName = "a saved place";
      if (placeNameEnc) {
        try {
          placeName = await encryptionService.decryptObject(placeNameEnc, secret) || "a saved place";
        } catch (e) {
          console.warn('[Background FCM] Decryption failed:', e);
        }
      }

      const actionText = event === 'arrival' ? 'arrived at' : 'left';
      const title = event === 'arrival' ? '🏡 Safely Arrived!' : '🚗 On the Move!';
      const msg = `Your ${partnerName || 'partner'} has ${actionText} ${placeName}.`;
      
      await notificationService.sendLocalNotification(title, msg);
    } catch (e) {
      console.error('[Background FCM] Error handling message:', e);
    }
  }
});
