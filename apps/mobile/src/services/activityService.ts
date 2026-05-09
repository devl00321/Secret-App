import firestore from '@react-native-firebase/firestore';
import { db, serverTimestamp } from './firebase';
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

      const activitiesRef = firestore().collection('couples').doc(coupleId).collection('activities');
      await activitiesRef.add({
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
    const activitiesRef = firestore().collection('couples').doc(coupleId).collection('activities');
    const q = activitiesRef.orderBy('timestamp', 'desc').limit(50);

    return q.onSnapshot((snapshot) => {
      if (!snapshot) return;
      const activities = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toMillis() || Date.now(),
        } as Activity;
      });
      callback(activities);
    });
  }
};
