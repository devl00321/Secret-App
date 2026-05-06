import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
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
        aspect: [4, 3],
        quality: 0.2, // Initial picker quality
      });

      if (result.canceled || !result.assets[0]) return null;

      // 3. Compress & Resize using Manipulator
      const manipResult = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1080 } }], // Resize to modern web standard width
        { 
          compress: 0.5, // 50% compression
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
  uploadImage: async (uri: string, path: string) => {
    try {
      const { coupleId } = useAuthStore.getState();
      if (!coupleId) throw new Error('No coupleId found');

      // Convert URI to Blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Create storage reference
      const storagePath = `couples/${coupleId}/${path}/${Date.now()}.jpg`;
      const storageRef = ref(storage, storagePath);

      // Upload
      await uploadBytes(storageRef, blob);

      // Get URL
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (err) {
      console.error('[ImageService] Upload failed:', err);
      return null;
    }
  }
};
