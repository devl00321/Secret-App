import { db, serverTimestamp, collection, doc, addDoc, onSnapshot, query, orderBy, limit, deleteDoc, updateDoc } from './firebase';
import { useAuthStore } from '../store/useAuthStore';
import { encryptionService } from './encryptionService';

export type ActivityType = 'travel' | 'sos' | 'anniversary' | 'memory' | 'ping' | 'location_saved';

export interface Activity {
  id: string;
  type: ActivityType;
  content: string;      // Decrypted content
  timestamp: number;
  userId: string;
  userName: string;
  imageUrl?: string;
  theme?: string;
  metadata?: any;
}

export const activityService = {
  logActivity: async (type: ActivityType, content: string, metadata?: any, explicitCoupleId?: string) => {
    const { coupleId: storeCoupleId, user, currentUserProfile, sharedSecret } = useAuthStore.getState();
    const coupleId = explicitCoupleId || storeCoupleId;
    
    if (!coupleId || !user) return;

    try {
      const activeSecret = sharedSecret || encryptionService.getLegacySecret(coupleId);

      // ── SANITIZE METADATA ──
      const sanitizedMetadata = metadata
        ? JSON.parse(JSON.stringify(metadata, (_, v) => (v === undefined ? null : v)))
        : null;

      // ── ENCRYPT sensitive fields ──
      // content is the activity text (e.g. "Triggered SOS", "Arrived safely at Home")
      const encryptedContent = await encryptionService.encryptField(content, activeSecret);

      // Encrypt metadata object (may contain location, notes, etc.)
      let encryptedMetadata: string | null = null;
      if (sanitizedMetadata) {
        encryptedMetadata = await encryptionService.encryptObject(sanitizedMetadata, activeSecret);
      }

      const activitiesRef = collection(db, 'couples', coupleId, 'activities');
      await addDoc(activitiesRef, {
        type,           // Plaintext — needed for icon rendering, not PII
        content: encryptedContent,
        timestamp: serverTimestamp(),
        userId: user.uid,  // Plaintext — needed for ordering/attribution
        userName: currentUserProfile?.displayName || 'Partner', // Display name (not PII)
        imageUrl: sanitizedMetadata?.imageUrl || null, // URLs are not PII
        theme: sanitizedMetadata?.theme || null,       // Theme is not PII
        metadata: encryptedMetadata,
      });
    } catch (err) {
      console.error('[ActivityService] Failed to log activity:', err);
    }
  },

  subscribeToActivities: (coupleId: string, callback: (activities: Activity[]) => void) => {
    const activitiesRef = collection(db, 'couples', coupleId, 'activities');
    const q = query(activitiesRef, orderBy('timestamp', 'desc'), limit(50));

    return onSnapshot(q, async (snapshot) => {
      if (!snapshot) return;

      const { sharedSecret } = useAuthStore.getState();
      const activeSecret = sharedSecret || encryptionService.getLegacySecret(coupleId);

      // Decrypt all activity content in parallel
      const activities = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();

          const ciphertext = data.content || '';
          let decryptedContent = await encryptionService.decryptField(ciphertext, activeSecret);

          // If primary decryption failed (returned ciphertext), try legacy fallback
          if (decryptedContent === ciphertext && ciphertext.length > 20) {
            const legacySecret = encryptionService.getLegacySecret(coupleId);
            if (activeSecret !== legacySecret) {
              const secondTry = await encryptionService.decryptField(ciphertext, legacySecret);
              if (secondTry !== ciphertext) {
                decryptedContent = secondTry;
              }
            }
          }

          let decryptedMetadata: any = null;
          if (data.metadata && typeof data.metadata === 'string') {
            decryptedMetadata = await encryptionService.decryptObject(data.metadata, activeSecret);
            if (!decryptedMetadata) {
               const legacySecret = encryptionService.getLegacySecret(coupleId);
               decryptedMetadata = await encryptionService.decryptObject(data.metadata, legacySecret);
            }
          } else {
            decryptedMetadata = data.metadata;
          }

          return {
            id: docSnap.id,
            ...data,
            content: decryptedContent,
            metadata: decryptedMetadata,
            timestamp: data.timestamp?.toMillis() || Date.now(),
          } as Activity;
        })
      );

      callback(activities);
    });
  },

  decryptActivities: async (activities: Activity[], secret: string, coupleId?: string): Promise<Activity[]> => {
    return await Promise.all(
      activities.map(async (activity) => {
        const ciphertext = activity.content || '';
        let decryptedContent = ciphertext;
        
        try {
          decryptedContent = await encryptionService.decryptField(ciphertext, secret);
        } catch (e) {
          if (coupleId) {
            const legacySecret = encryptionService.getLegacySecret(coupleId);
            try {
              decryptedContent = await encryptionService.decryptField(ciphertext, legacySecret);
            } catch (e2) {}
          }
        }

        let decryptedMetadata = activity.metadata;
        if (typeof activity.metadata === 'string') {
          try {
            decryptedMetadata = await encryptionService.decryptObject(activity.metadata, secret);
          } catch (e) {
            if (coupleId) {
              const legacySecret = encryptionService.getLegacySecret(coupleId);
              try {
                decryptedMetadata = await encryptionService.decryptObject(activity.metadata, legacySecret);
              } catch (e2) {}
            }
          }
        }

        return {
          ...activity,
          content: decryptedContent,
          metadata: decryptedMetadata,
        };
      })
    );
  },

  deleteActivity: async (coupleId: string, activityId: string) => {
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'activities', activityId));
    } catch (err) {
      console.error('[ActivityService] Failed to delete activity:', err);
      throw err;
    }
  },

  updateActivity: async (coupleId: string, activityId: string, content: string, theme?: string) => {
    try {
      const { sharedSecret } = useAuthStore.getState();
      const activeSecret = sharedSecret || encryptionService.getLegacySecret(coupleId);

      const encryptedContent = await encryptionService.encryptField(content, activeSecret);

      const activityRef = doc(db, 'couples', coupleId, 'activities', activityId);
      await updateDoc(activityRef, {
        content: encryptedContent,
        theme: theme || null,
        isEdited: true,
        editedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[ActivityService] Failed to update activity:', err);
      throw err;
    }
  },
};
