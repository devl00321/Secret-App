import { onDocumentUpdated, Change, FirestoreEvent } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * Helper to get the most affectionate name available.
 */
async function getPartnerName(targetUserDoc: admin.firestore.DocumentSnapshot, senderUserDoc: admin.firestore.DocumentSnapshot) {
  const targetData = targetUserDoc.data();
  const senderData = senderUserDoc.data();
  
  return targetData?.partnerNickname || senderData?.displayName || "Your partner";
}

/**
 * Send a batch of notifications
 */
async function sendMessages(messages: admin.messaging.Message[]) {
  if (messages.length === 0) return null;
  
  const promises = messages.map(msg => admin.messaging().send(msg).catch(e => console.error("FCM Error:", e)));
  await Promise.all(promises);
  return null;
}

// ============================================================================
// 1. SOS NOTIFICATIONS (Gen 2)
// ============================================================================
export const onsostriggered = onDocumentUpdated("couples/{coupleId}", async (event: FirestoreEvent<Change<admin.firestore.DocumentSnapshot> | undefined>) => {
  if (!event.data) return null;
  
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  if (!beforeData || !afterData) return null;

  const wasSosActive = beforeData.activeSos?.isActive === true;
  const isSosActive = afterData.activeSos?.isActive === true;

  if (!wasSosActive && isSosActive) {
    const triggeredBy = afterData.activeSos.triggeredBy;
    const users = afterData.users as string[];
    
    if (!users || users.length < 2) return null;
    
    const targetUserId = users.find(id => id !== triggeredBy);
    if (!targetUserId) return null;

    const targetUserDoc = await db.collection("users").doc(targetUserId).get();
    const fcmToken = targetUserDoc.data()?.fcmToken;

    if (fcmToken) {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: "🚨 SOS EMERGENCY",
          body: "Your partner needs help immediately!",
        },
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "emergency_alerts"
          }
        }
      });
    }
  }
  return null;
});

// ============================================================================
// 2. USER ACTIVITY NOTIFICATIONS (Pings, Walk Safe, Battery) (Gen 2)
// ============================================================================
export const onuserupdated = onDocumentUpdated("users/{userId}", async (event: FirestoreEvent<Change<admin.firestore.DocumentSnapshot> | undefined>) => {
  if (!event.data) return null;

  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();
  
  if (!beforeData || !afterData) return null;
  
  const messages: admin.messaging.Message[] = [];

  // ------------------------------------------------------------------------
  // A. HEARTBEAT PINGS
  // ------------------------------------------------------------------------
  const wasPingTime = beforeData.incomingPing?.timestamp || 0;
  const isPingTime = afterData.incomingPing?.timestamp || 0;

  if (isPingTime > wasPingTime && afterData.incomingPing?.from) {
    const senderId = afterData.incomingPing.from;
    const targetFcm = afterData.fcmToken;
    
    if (targetFcm) {
      const senderDoc = await db.collection("users").doc(senderId).get();
      const partnerName = await getPartnerName(event.data.after, senderDoc);
      
      messages.push({
        token: targetFcm,
        notification: {
          title: "Thinking of you 🫀",
          body: `Your ${partnerName} is thinking of you.`,
        },
        android: { priority: "high" }
      });
    }
  }

  // ------------------------------------------------------------------------
  // Setup for Partner-targeted notifications
  // ------------------------------------------------------------------------
  const partnerId = afterData.partnerId;
  if (!partnerId) return sendMessages(messages);

  const partnerDoc = await db.collection("users").doc(partnerId).get();
  const targetFcm = partnerDoc.data()?.fcmToken;
  
  if (!targetFcm) return sendMessages(messages);
  
  const partnerName = await getPartnerName(partnerDoc, event.data.after);

  // ------------------------------------------------------------------------
  // B. WALK SAFE / TRIPS
  // ------------------------------------------------------------------------
  const beforeWalkSafe = beforeData.walkSafe;
  const afterWalkSafe = afterData.walkSafe;

  // 1. Trip Started
  if (!beforeWalkSafe?.isActive && afterWalkSafe?.isActive) {
    // VUL-10 FIX: destinationName is always null (stored as E2EE destinationNameEnc).
    // Cloud Functions don't have the private key — use a generic label intentionally.
    messages.push({
      token: targetFcm,
      notification: {
        title: "Walk Safe Started 🚶‍♂️",
        body: `Your ${partnerName} started a Walk Safe trip ❤️🌸`,
      },
    });
  }

  // 2. Trip Arrived
  if (afterWalkSafe?.isActive && afterWalkSafe.status === 'arrived' && beforeWalkSafe?.status !== 'arrived') {
     messages.push({
      token: targetFcm,
      notification: {
        title: "Arrived Safely ✅",
        body: `Your ${partnerName} has arrived at their destination safely ❤️🌸`,
      },
    });
  }

  // 3. Trip Overdue/Warning
  if (afterWalkSafe?.isActive && afterWalkSafe.status !== beforeWalkSafe?.status) {
    if (afterWalkSafe.status === 'overdue') {
      messages.push({
        token: targetFcm,
        notification: {
          title: "⚠️ Trip Overdue",
          body: `Your ${partnerName} hasn't reached their destination yet. Please check in on them!`,
        },
        android: { priority: "high" }
      });
    }
  }

  // ------------------------------------------------------------------------
  // C. LOW BATTERY WARNING
  // ------------------------------------------------------------------------
  const beforeBattery = beforeData.status?.batteryLevel;
  const afterBattery = afterData.status?.batteryLevel;
  const isCharging = afterData.status?.isCharging;

  if (beforeBattery > 15 && afterBattery <= 15 && !isCharging) {
    messages.push({
      token: targetFcm,
      notification: {
        title: "Low Battery Warning 🔋",
        body: `Your ${partnerName}'s phone is at ${afterBattery}%. You might want to reach out before it dies!`,
      },
    });
  }

  if (beforeBattery > 5 && afterBattery <= 5 && !isCharging) {
    messages.push({
      token: targetFcm,
      notification: {
        title: "CRITICAL BATTERY 🪫",
        body: `Your ${partnerName}'s phone is about to die (${afterBattery}%). Last known location saved.`,
      },
      android: { priority: "high" }
    });
  }

  // ------------------------------------------------------------------------
  // D. GEOFENCE EVENTS (Data-Only Push for E2EE)
  // ------------------------------------------------------------------------
  const beforeGeofence = beforeData.geofenceEvent;
  const afterGeofence = afterData.geofenceEvent;

  if (afterGeofence && afterGeofence.timestamp !== beforeGeofence?.timestamp) {
    // We send a data-only message so the partner's device can wake up,
    // decrypt the placeNameEnc, and trigger a local notification.
    messages.push({
      token: targetFcm,
      data: {
        type: 'geofence',
        event: afterGeofence.type,
        placeNameEnc: afterGeofence.placeNameEnc,
        partnerName: partnerName,
      },
      android: { priority: "high" },
      apns: {
        payload: {
          aps: {
            "content-available": 1
          }
        }
      }
    });
  }

  return sendMessages(messages);
});
export * from "./aiService";
