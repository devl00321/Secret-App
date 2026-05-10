import { db, serverTimestamp, collection, doc, addDoc, onSnapshot, query, orderBy, limit, deleteDoc, updateDoc } from './firebase';
import { useAuthStore } from '../store/useAuthStore';

export type ActivityType = 'travel' | 'sos' | 'anniversary' | 'memory' | 'ping' | 'location_saved';

export interface Activity {
  id: string;
  type: ActivityType;
  content: string;
  timestamp: number;
  userId: string;
  userName: string;
  imageUrl?: string;
  theme?: string; // Added for themed memories
  metadata?: any;
}

export const activityService = {
  logActivity: async (type: ActivityType, content: string, metadata?: any) => {
    const { coupleId, user, currentUserProfile } = useAuthStore.getState();
    if (!coupleId || !user) return;

    try {
      // ── SANITIZE METADATA ──
      // Remove undefined values which crash Firestore
      const sanitizedMetadata = metadata ? JSON.parse(JSON.stringify(metadata, (_, v) => v === undefined ? null : v)) : null;

      const activitiesRef = collection(db, 'couples', coupleId, 'activities');
      await addDoc(activitiesRef, {
        type,
        content,
        timestamp: serverTimestamp(),
        userId: user.uid,
        userName: currentUserProfile?.displayName || 'Partner',
        imageUrl: sanitizedMetadata?.imageUrl || null,
        theme: sanitizedMetadata?.theme || null,
        metadata: sanitizedMetadata,
      });
    } catch (err) {
      console.error('[ActivityService] Failed to log activity:', err);
    }
  },

  subscribeToActivities: (coupleId: string, callback: (activities: Activity[]) => void) => {
    const activitiesRef = collection(db, 'couples', coupleId, 'activities');
    const q = query(activitiesRef, orderBy('timestamp', 'desc'), limit(50));

    return onSnapshot(q, (snapshot) => {
      if (!snapshot) return;
      const activities = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          timestamp: data.timestamp?.toMillis() || Date.now(),
        } as Activity;
      });
      callback(activities);
    });
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
      const activityRef = doc(db, 'couples', coupleId, 'activities', activityId);
      await updateDoc(activityRef, {
        content,
        theme: theme || null,
        isEdited: true,
        editedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('[ActivityService] Failed to update activity:', err);
      throw err;
    }
  }
};
