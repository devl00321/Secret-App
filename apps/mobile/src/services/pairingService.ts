import { 
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import { db } from './firebase';

const INVITE_CODE_LENGTH = 6;
const INVITE_EXPIRY_MINUTES = 10;

const generateSecureInviteCode = () => {
  const bytes = Crypto.getRandomBytes(INVITE_CODE_LENGTH);

  return Array.from(bytes, (value) => (value % 10).toString()).join('');
};

export const pairingService = {
  /**
   * Generates a 6-digit random code and stores it in inviteCodes
   */
  createInviteCode: async (userId: string) => {
    const batch = writeBatch(db);
    const q = query(collection(db, 'inviteCodes'), where('createdBy', '==', userId));
    const existingCodes = await getDocs(q);

    for (const d of existingCodes.docs) {
      batch.delete(d.ref);
    }

    await batch.commit();

    let code = generateSecureInviteCode();
    let existingCodeDoc = await getDoc(doc(db, 'inviteCodes', code));

    while (existingCodeDoc.exists()) {
      code = generateSecureInviteCode();
      existingCodeDoc = await getDoc(doc(db, 'inviteCodes', code));
    }

    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + INVITE_EXPIRY_MINUTES);

    const codeRef = doc(db, 'inviteCodes', code);
    await setDoc(codeRef, {
      code,
      createdBy: userId,
      createdAt: serverTimestamp(),
      expiresAt: expiryDate,
      isUsed: false
    });

    return { code, expiresAt: expiryDate };
  },

  /**
   * Joins a couple using an invite code
   */
  joinWithCode: async (code: string, currentUserId: string) => {
    const normalizedCode = code.replace(/\D/g, '').slice(0, INVITE_CODE_LENGTH);

    if (normalizedCode.length !== INVITE_CODE_LENGTH) {
      throw new Error('Please enter a valid 6-digit code.');
    }

    return await runTransaction(db, async (transaction) => {
      const codeRef = doc(db, 'inviteCodes', normalizedCode);
      const codeSnap = await transaction.get(codeRef);

      if (!codeSnap.exists()) {
        throw new Error('Invalid code. Please check and try again.');
      }

      const data = codeSnap.data() as {
        createdBy: string;
        expiresAt: Timestamp;
        isUsed: boolean;
      };

      const now = new Date();

      if (data.isUsed) {
        throw new Error('This code has already been used.');
      }

      if (data.expiresAt.toDate() < now) {
        throw new Error('This code has expired.');
      }

      if (data.createdBy === currentUserId) {
        throw new Error('You cannot join your own code.');
      }

      const currentUserRef = doc(db, 'users', currentUserId);
      const creatorUserRef = doc(db, 'users', data.createdBy);
      const currentUserSnap = await transaction.get(currentUserRef);
      const creatorUserSnap = await transaction.get(creatorUserRef);

      if (!currentUserSnap.exists() || !creatorUserSnap.exists()) {
        throw new Error('We could not find both user profiles. Please try again.');
      }

      if (currentUserSnap.data().coupleId || creatorUserSnap.data().coupleId) {
        throw new Error('One of these accounts is already paired.');
      }

      const coupleId = [data.createdBy, currentUserId].sort().join('_');
      const coupleRef = doc(db, 'couples', coupleId);

      transaction.set(coupleRef, {
        id: coupleId,
        users: [data.createdBy, currentUserId],
        createdAt: serverTimestamp(),
      });

      transaction.set(
        currentUserRef,
        {
          partnerId: data.createdBy,
          coupleId,
        },
        { merge: true }
      );

      transaction.set(
        creatorUserRef,
        {
          partnerId: currentUserId,
          coupleId,
        },
        { merge: true }
      );

      transaction.set(
        codeRef,
        {
          isUsed: true,
          usedBy: currentUserId,
          usedAt: serverTimestamp(),
        },
        { merge: true }
      );

      return { coupleId, partnerId: data.createdBy };
    });
  }
};
