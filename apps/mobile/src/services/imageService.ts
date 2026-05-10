import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { storageInstance } from './firebase';
import { useAuthStore } from '../store/useAuthStore';

export const imageService = {
  /**
   * Picks an image from the gallery, compresses it, and returns the URI
   */
  pickAndCompressImage: async () => {
    try {
      // 1. Request Permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('We need gallery permissions to upload photos! 📸');
        return null;
      }

      // 2. Launch Picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square crop for a premium, consistent timeline look
        quality: 0.8, // High quality for the picker
      });

      if (result.canceled || !result.assets[0]) return null;

      // 3. Compress & Resize using Manipulator
      const manipResult = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1080 } }], // High-def width but optimized for storage
        { 
          compress: 0.8, // 80% compression (much higher quality)
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );

      return manipResult.uri;
    } catch (err) {
      console.error('[ImageService] Failed to pick/compress:', err);
      return null;
    }
  },

  /**
   * Uploads a file URI to Firebase Storage and returns the download URL
   */
  uploadImage: async (uri: string, customPath?: string) => {
    try {
      const { coupleId, user } = useAuthStore.getState();
      if (!user) throw new Error('User not authenticated');

      // Use provided path or default to timeline
      const storagePath = customPath || `timeline/${coupleId || 'unpaired'}/${user.uid}/${Date.now()}.jpg`;
      const storageRef = storageInstance.ref(storagePath);

      // Pass the URI directly to Native putFile (Firebase handles file:// internally)
      await storageRef.putFile(uri);

      // Get URL
      const downloadURL = await storageRef.getDownloadURL();
      return downloadURL;
    } catch (err) {
      console.error('[ImageService] Upload failed:', err);
      return null;
    }
  }
};
