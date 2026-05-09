import { db, auth, serverTimestamp } from './firebase';
import firestore from '@react-native-firebase/firestore';

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
  gender?: 'Male' | 'Female' | '';
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
      const userRef = firestore().collection('users').doc(user.uid);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );

      // Use a short-lived check for existence with timeout
      const userSnap = await Promise.race([
        userRef.get(),
        timeoutPromise
      ]) as any;

      if (!userSnap.exists) {
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
        await userRef.set(userData);
        return userData;
      } else {
        // Update presence even on existing user
        await userRef.update({ isOnline: true });
        return userSnap.data() as PartnerProfile;
      }
    } catch (err) {
      console.warn('[UserService] Sync failed:', err);
      return null;
    }
  },

  getUserData: async (uid: string): Promise<PartnerProfile | null> => {
    try {
      const userSnap = await firestore().collection('users').doc(uid).get();
      const data = userSnap.data();
      return data ? (data as PartnerProfile) : null;
    } catch (err) {
      console.warn('[UserService] Get data failed:', err);
      return null;
    }
  },

  updateUserPresence: async (uid: string, isOnline: boolean) => {
    try {
      const userRef = firestore().collection('users').doc(uid);
      await userRef.set({ 
        isOnline,
        lastActive: serverTimestamp() 
      }, { merge: true });
    } catch (err) {
      // Silent fail for presence
    }
  },

  updateUserProfile: async (uid: string, data: Partial<PartnerProfile>) => {
    try {
      const userRef = firestore().collection('users').doc(uid);
      await userRef.set(data, { merge: true });
    } catch (err) {
      console.warn('[UserService] Profile update failed:', err);
      throw err;
    }
  },

  updatePartnerNickname: async (uid: string, nickname: string) => {
    try {
      const userRef = firestore().collection('users').doc(uid);
      await userRef.set({ partnerNickname: nickname }, { merge: true });
    } catch (err) {
      console.warn('[UserService] Nickname update failed:', err);
      throw err;
    }
  },

  updateCoupleData: async (coupleId: string, data: CoupleUpdateData) => {
    try {
      const coupleRef = firestore().collection('couples').doc(coupleId);
      await coupleRef.set(data as any, { merge: true });
    } catch (err) {
      console.warn('[UserService] Couple update failed:', err);
      throw err;
    }
  },

  /**
   * Permanently deletes the user's account and all associated data.
   * Requirement for App Store / Play Store.
   */
  deleteUserAccount: async (uid: string, partnerId: string | null) => {
    try {
      const userRef = firestore().collection('users').doc(uid);
      
      // 1. If paired, remove the partner's reference to this user
      if (partnerId) {
        const partnerRef = firestore().collection('users').doc(partnerId);
        await partnerRef.set({
          partnerId: null,
          coupleId: null,
          partnerNickname: null,
        }, { merge: true });
      }

      // 2. Delete the user document from Firestore
      await userRef.delete();

      // 3. Delete the user from Firebase Auth
      const currentUser = auth().currentUser;
      if (currentUser) {
        await currentUser.delete();
      }
      
      return true;
    } catch (err) {
      console.error('[UserService] Account deletion failed:', err);
      throw err;
    }
  }
};
