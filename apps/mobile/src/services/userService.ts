import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { User } from 'firebase/auth';

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
  gender?: string;
  dob?: string; // ISO String
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

export const userService = {
  /**
   * Syncs user data with Firestore. 
   * Does NOT throw errors to prevent blocking the app initialization.
   */
  createUserIfNotExists: async (user: User) => {
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
      return userSnap.exists() ? (userSnap.data() as PartnerProfile) : null;
    } catch (err) {
      console.warn('[UserService] Get data failed:', err);
      return null;
    }
  },

  updateUserPresence: async (uid: string, isOnline: boolean) => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { 
        isOnline,
        lastActive: serverTimestamp() 
      });
    } catch (err) {
      // Silent fail for presence
    }
  },

  updateUserProfile: async (uid: string, data: Partial<PartnerProfile>) => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, data);
    } catch (err) {
      console.warn('[UserService] Profile update failed:', err);
      throw err;
    }
  },

  updatePartnerNickname: async (uid: string, nickname: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { partnerNickname: nickname });
    } catch (err) {
      console.warn('[UserService] Nickname update failed:', err);
      throw err;
    }
  },

  updateCoupleData: async (coupleId: string, data: any) => {
    try {
      const coupleRef = doc(db, 'couples', coupleId);
      await updateDoc(coupleRef, data);
    } catch (err) {
      console.warn('[UserService] Couple update failed:', err);
      throw err;
    }
  }
};
