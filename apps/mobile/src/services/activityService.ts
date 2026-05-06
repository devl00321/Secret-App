import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
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
  metadata?: any;
}

export const activityService = {
  logActivity: async (type: ActivityType, content: string, metadata?: any) => {
    const { coupleId, user, currentUserProfile } = useAuthStore.getState();
    if (!coupleId || !user) return;

    try {
      const activitiesRef = collection(db, 'couples', coupleId, 'activities');
      await addDoc(activitiesRef, {
        type,
        content,
        timestamp: serverTimestamp(),
        userId: user.uid,
        userName: currentUserProfile?.displayName || 'Partner',
        imageUrl: metadata?.imageUrl || null,
        metadata: metadata || null,
      });
    } catch (err) {
      console.error('[ActivityService] Failed to log activity:', err);
    }
  },

  subscribeToActivities: (coupleId: string, callback: (activities: Activity[]) => void) => {
    const activitiesRef = collection(db, 'couples', coupleId, 'activities');
    const q = query(activitiesRef, orderBy('timestamp', 'desc'));

    return onSnapshot(q, (snapshot) => {
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
