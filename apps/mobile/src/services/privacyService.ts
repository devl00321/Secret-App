import { db, auth } from './firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useLocationStore } from '../store/useLocationStore';

export const privacyService = {
  /**
   * Syncs online status to Firestore
   */
  updateOnlineStatus: async (isOnline: boolean) => {
    const userId = auth().currentUser?.uid;
    if (!userId) return;
    try {
      await db.collection('users').doc(userId).update({ isOnline });
    } catch (err) {
      console.error('[PrivacyService] Failed to update online status:', err);
    }
  },

  /**
   * Syncs location privacy settings to Firestore
   */
  updateLocationPrivacy: async (isSharing: boolean, duration: string) => {
    const userId = auth().currentUser?.uid;
    if (!userId) return;
    try {
      await db.collection('users').doc(userId).update({
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
      const messagesRef = db.collection('couples').doc(coupleId).collection('messages');
      const snapshot = await messagesRef.get();
      
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
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
    const user = auth().currentUser;
    const { coupleId } = useAuthStore.getState();
    
    if (!user) return false;

    try {
      const userId = user.uid;

      // 1. Remove from Couple
      if (coupleId) {
        const coupleRef = db.collection('couples').doc(coupleId);
        const coupleDoc = await coupleRef.get();
        if (coupleDoc.exists) {
          const data = coupleDoc.data();
          const remainingUsers = data?.users?.filter((id: string) => id !== userId) || [];
          
          if (remainingUsers.length === 0) {
            // Delete entire couple if no one left
            await coupleRef.delete();
          } else {
            // Update couple to remove this user
            await coupleRef.update({ users: remainingUsers });
          }
        }
      }

      // 2. Delete User Profile
      await db.collection('users').doc(userId).delete();

      // 3. Delete Auth User
      await user.delete();

      return true;
    } catch (err) {
      console.error('[PrivacyService] Failed to delete account:', err);
      return false;
    }
  }
};
