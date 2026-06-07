import { db, authInstance, doc, updateDoc, collection, getDocs, getDoc, deleteDoc, writeBatch } from './firebase';
import { deleteUser } from '@react-native-firebase/auth';
import { useAuthStore } from '../store/useAuthStore';
import { useLocationStore } from '../store/useLocationStore';

export const privacyService = {
  /**
   * Syncs online status to Firestore
   */
  updateOnlineStatus: async (isOnline: boolean) => {
    const userId = authInstance.currentUser?.uid;
    if (!userId) return;
    try {
      await updateDoc(doc(db, 'users', userId), { isOnline });
    } catch (err) {
      console.error('[PrivacyService] Failed to update online status:', err);
    }
  },

  /**
   * Syncs location privacy settings to Firestore
   */
  updateLocationPrivacy: async (isSharing: boolean, duration: string) => {
    const userId = authInstance.currentUser?.uid;
    if (!userId) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        isSharingLocation: isSharing,
        sharingDuration: duration
      });
    } catch (err) {
      console.error('[PrivacyService] Failed to update location privacy:', err);
    }
  },

  /**
   * Deletes all messages in the couple's chat
   */
  clearChatHistory: async (coupleId: string) => {
    try {
      const messagesRef = collection(db, 'couples', coupleId, 'messages');
      const snapshot = await getDocs(messagesRef);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((msgDoc) => {
        batch.delete(msgDoc.ref);
      });
      
      await batch.commit();
      return true;
    } catch (err) {
      console.error('[PrivacyService] Failed to clear chat history:', err);
      return false;
    }
  },

  /**
   * Permanently deletes the user account and cleanup relations
   */
  deleteAccount: async () => {
    const user = authInstance.currentUser;
    const { coupleId } = useAuthStore.getState();
    
    if (!user) return false;

    try {
      const userId = user.uid;

      // 1. Remove from Couple
      if (coupleId) {
        const coupleRef = doc(db, 'couples', coupleId);
        const coupleDoc = await getDoc(coupleRef);
        if (coupleDoc.exists()) {
          const data = coupleDoc.data();
          const remainingUsers = data?.users?.filter((id: string) => id !== userId) || [];
          
          if (remainingUsers.length === 0) {
            // Delete entire couple if no one left
            await deleteDoc(coupleRef);
          } else {
            // Update couple to remove this user
            await updateDoc(coupleRef, { users: remainingUsers });
          }
        }
      }

      // 2. Delete User Profile
      await deleteDoc(doc(db, 'users', userId));

      // 3. Delete Auth User
      await deleteUser(user);

      return true;
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login' || err?.message?.includes('requires-recent-login')) {
        console.warn('[PrivacyService] Deletion requires recent login.');
      } else {
        console.error('[PrivacyService] Failed to delete account:', err);
      }
      throw err;
    }
  }
};
