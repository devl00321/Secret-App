import { db, authInstance, serverTimestamp, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch, getDocs } from './firebase';

export interface PartnerProfile {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string;
  photoURL: string;
  createdAt?: unknown;
  partnerId: string | null;
  coupleId: string | null;
  isOnline: boolean;
  lastMessage?: string;
  gender?: 'Male' | 'Female' | 'Non-binary' | 'Prefer not to say' | '';
  dob?: string; // DD/MM/YYYY
  profileSetupComplete?: boolean;
  partnerNickname?: string;
  anniversaryDate?: string; // DD/MM/YYYY
  emergencyContact?: {
    name: string;
    phone: string;
    updatedAt: string;
  };
  emergencyContacts?: {
    id: string;
    name: string;
    phone: string;
    priority: number;
    updatedAt: string;
  }[];
}

// Strict type for allowed couple-level updates (prevents overwriting protected fields)
export interface CoupleUpdateData {
  anniversaryDate?: string;
  savedPlaces?: any[];
  sosActive?: boolean;
  sosLocation?: { latitude: number; longitude: number } | null;
  sosCancelledBy?: string | null;
}

export const userService = {
  /**
   * Syncs user data with Firestore. 
   * Does NOT throw errors to prevent blocking the app initialization.
   */
  createUserIfNotExists: async (user: any) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );

      // Use a short-lived check for existence with timeout
      const userSnap = await Promise.race([
        getDoc(userRef),
        timeoutPromise
      ]) as any;

      if (!userSnap.exists()) {
        const userData = {
          id: user.uid,
          email: user.email || null,
          phoneNumber: user.phoneNumber || null,
          displayName: user.displayName || 'LUVV User',
          photoURL: user.photoURL || '',
          createdAt: serverTimestamp(),
          partnerId: null,
          coupleId: null,
          isOnline: true,
          profileSetupComplete: false,
        };
        await setDoc(userRef, userData);
        return userData;
      } else {
        // Update presence even on existing user
        await updateDoc(userRef, { isOnline: true });
        return userSnap.data() as PartnerProfile;
      }
    } catch (err) {
      console.warn('[UserService] Sync failed:', err);
      return null;
    }
  },

  getUserData: async (uid: string): Promise<PartnerProfile | null> => {
    try {
      const userSnap = await getDoc(doc(db, 'users', uid));
      const data = userSnap.data();
      return data ? (data as PartnerProfile) : null;
    } catch (err) {
      console.warn('[UserService] Get data failed:', err);
      return null;
    }
  },

  updateUserPresence: async (uid: string, isOnline: boolean) => {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, { 
        isOnline,
        lastActive: serverTimestamp() 
      }, { merge: true });
    } catch (err) {
      // Silent fail for presence
    }
  },

  updateUserProfile: async (uid: string, data: Partial<PartnerProfile>) => {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, data, { merge: true });
    } catch (err) {
      console.warn('[UserService] Profile update failed:', err);
      throw err;
    }
  },

  updatePartnerNickname: async (uid: string, nickname: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, { partnerNickname: nickname }, { merge: true });
    } catch (err) {
      console.warn('[UserService] Nickname update failed:', err);
      throw err;
    }
  },

  updateCoupleData: async (coupleId: string, data: CoupleUpdateData) => {
    try {
      const coupleRef = doc(db, 'couples', coupleId);
      await setDoc(coupleRef, data as any, { merge: true });
    } catch (err) {
      console.warn('[UserService] Couple update failed:', err);
      throw err;
    }
  },

  /**
   * Permanently deletes the user's account and all associated data.
   * Requirement for App Store / Play Store.
   */
  deleteUserAccount: async (uid: string, partnerId: string | null, coupleId: string | null) => {
    try {
      // 1. Try to delete the user from Firebase Auth FIRST
      const currentUser = authInstance.currentUser;
      if (currentUser) {
        await currentUser.delete();
      } else {
        throw new Error('No current user found');
      }

      // 2. If Auth deletion succeeds, clean up SHARED DATA (Chat & Timeline)
      if (coupleId) {
        const coupleRef = doc(db, 'couples', coupleId);
        
        // Delete messages sub-collection
        const messages = await getDocs(collection(db, 'couples', coupleId, 'messages'));
        if (!messages.empty) {
          const msgBatch = writeBatch(db);
          messages.docs.forEach(docSnap => msgBatch.delete(docSnap.ref));
          await msgBatch.commit();
        }

        // Delete activities sub-collection
        const activities = await getDocs(collection(db, 'couples', coupleId, 'activities'));
        if (!activities.empty) {
          const actBatch = writeBatch(db);
          activities.docs.forEach(docSnap => actBatch.delete(docSnap.ref));
          await actBatch.commit();
        }

        // Delete the main couple document
        await deleteDoc(coupleRef);
      }

      // 3. Clean up USER profile and Partner references
      const userRef = doc(db, 'users', uid);
      
      if (partnerId) {
        const partnerRef = doc(db, 'users', partnerId);
        await setDoc(partnerRef, {
          partnerId: null,
          coupleId: null,
          partnerNickname: null,
        }, { merge: true });
      }

      await deleteDoc(userRef);
      
      return true;
    } catch (err) {
      console.error('[UserService] Full data purge failed:', err);
      throw err;
    }
  }
};
