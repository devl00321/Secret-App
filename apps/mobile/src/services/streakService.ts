import { db, doc, runTransaction } from './firebase';
import { useAuthStore } from '../store/useAuthStore';

export interface StreakInfo {
  streakCount: number;
  lastInteractionDate: string; // YYYY-MM-DD in local timezone
  lastInteractionTimestamp: number;
  messageCount: number;
  pingCount: number;
  imageCount: number;
  timelineCount: number;
}

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isYesterday = (dateStr: string) => {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const checkDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  checkDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - checkDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 1;
};

export const streakService = {
  /**
   * Records a user interaction (message, ping, image, timeline memory) and updates the connection streak.
   */
  recordInteraction: async (type: 'message' | 'ping' | 'image' | 'timeline') => {
    const { coupleId } = useAuthStore.getState();
    if (!coupleId) return;

    const coupleRef = doc(db, 'couples', coupleId);

    try {
      await runTransaction(db, async (transaction) => {
        const coupleSnap = await transaction.get(coupleRef);
        if (!coupleSnap.exists) return;

        const data = coupleSnap.data() || {};
        const currentStreakInfo: StreakInfo = data.streakInfo || {
          streakCount: 0,
          lastInteractionDate: '',
          lastInteractionTimestamp: 0,
          messageCount: 0,
          pingCount: 0,
          imageCount: 0,
          timelineCount: 0
        };

        const todayStr = getLocalDateString();
        let newStreakCount = currentStreakInfo.streakCount || 0;

        if (!currentStreakInfo.lastInteractionDate) {
          // First interaction ever
          newStreakCount = 1;
        } else if (currentStreakInfo.lastInteractionDate === todayStr) {
          // Already interacted today, keep streak as is
        } else if (isYesterday(currentStreakInfo.lastInteractionDate)) {
          // Last interaction was yesterday, increment streak
          newStreakCount = (currentStreakInfo.streakCount || 0) + 1;
        } else {
          // Missed a day or more, reset streak to 1
          newStreakCount = 1;
        }

        const updatedStreakInfo: StreakInfo = {
          streakCount: newStreakCount,
          lastInteractionDate: todayStr,
          lastInteractionTimestamp: Date.now(),
          messageCount: (currentStreakInfo.messageCount || 0) + (type === 'message' ? 1 : 0),
          pingCount: (currentStreakInfo.pingCount || 0) + (type === 'ping' ? 1 : 0),
          imageCount: (currentStreakInfo.imageCount || 0) + (type === 'image' ? 1 : 0),
          timelineCount: (currentStreakInfo.timelineCount || 0) + (type === 'timeline' ? 1 : 0),
        };

        transaction.set(coupleRef, { streakInfo: updatedStreakInfo }, { merge: true });
      });
      console.log(`[StreakService] Recorded interaction of type: ${type}`);
    } catch (err) {
      console.error('[StreakService] Failed to record interaction:', err);
    }
  }
};
