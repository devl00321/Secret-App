import * as SMS from 'expo-sms';
import { Linking, Platform } from 'react-native';
import { db, auth, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, arrayUnion, serverTimestamp, collection, addDoc } from 'firebase/firestore';

export const emergencyService = {
  /**
   * Notify emergency contacts via SMS with a live location link
   */
  notifyContacts: async (contacts: any[], location: { latitude: number, longitude: number }) => {
    if (contacts.length === 0) return;

    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      console.warn('[EmergencyService] SMS is not available');
      return;
    }

    const phoneNumbers = contacts.map(c => c.phone);
    const locationUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    const message = `🆘 EMERGENCY: I have triggered an SOS alert. My live location is: ${locationUrl}. Please check on me!`;

    try {
      await SMS.sendSMSAsync(phoneNumbers, message);
    } catch (err) {
      console.error('[EmergencyService] Failed to send SMS:', err);
    }
  },

  /**
   * Notify emergency contacts via WhatsApp
   */
  notifyWhatsApp: async (location: { latitude: number, longitude: number }, phoneNumber?: string, evidenceUrl?: string) => {
    const locationUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    let message = `🆘 EMERGENCY: I have triggered an SOS alert! My live location is: ${locationUrl}. Please help!`;
    
    if (evidenceUrl) {
      message += `\n\n📸 VIEW PHOTO EVIDENCE: ${evidenceUrl}`;
    }

    const encodedMessage = encodeURIComponent(message);
    
    const cleanPhone = phoneNumber ? phoneNumber.replace(/\D/g, '') : null;
    const url = cleanPhone 
      ? `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`
      : `whatsapp://send?text=${encodedMessage}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        const webUrl = cleanPhone 
          ? `https://wa.me/${cleanPhone}?text=${encodedMessage}`
          : `https://wa.me/?text=${encodedMessage}`;
        await Linking.openURL(webUrl);
      }
    } catch (err) {
      console.error('[EmergencyService] WhatsApp sharing failed:', err);
    }
  },

  /**
   * Upload an emergency photo to Firebase Storage and update the SOS record
   */
  uploadEmergencyPhoto: async (uri: string, cameraType: 'front' | 'back', coupleId: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return null;

    try {
      console.log(`[EmergencyService] Uploading ${cameraType} photo: ${uri}`);
      
      // 1. Fetch the image and convert to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // 2. Upload to storage
      const filename = `emergency/${coupleId}/${userId}/${Date.now()}_${cameraType}.jpg`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);

      // 3. Get URL
      const downloadUrl = await getDownloadURL(storageRef);

      // 4. Update the SOS record in Firestore
      const coupleRef = doc(db, 'couples', coupleId);
      await updateDoc(coupleRef, {
        'activeSos.photos': arrayUnion({
          url: downloadUrl,
          timestamp: Date.now(),
          type: cameraType
        }),
        'activeSos.lastPhotoAt': serverTimestamp()
      });

      // 5. Post to Chat automatically
      await addDoc(collection(db, 'messages'), {
        text: `📸 Emergency ${cameraType} photo captured.`,
        imageUrl: downloadUrl,
        senderId: userId,
        coupleId: coupleId,
        createdAt: serverTimestamp(),
        isRead: false,
        isEmergency: true // Label for special styling if needed
      });

      return downloadUrl;
    } catch (err) {
      console.error('[EmergencyService] Photo upload failed:', err);
      return null;
    }
  }
};
