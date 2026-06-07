export interface SafetyContext {
  batteryLevel?: number;
  partnerName: string;
  isSos?: boolean;
  isSilent?: boolean;
}

export const safetyService = {
  /**
   * Generates a high-priority emergency insight for SOS situations.
   */
  getEmergencyInsight(context: SafetyContext) {
    const { partnerName, batteryLevel, isSos, isSilent } = context;
    const hour = new Date().getHours();
    const isLateNight = hour >= 21 || hour < 6;
    const displayBattery = batteryLevel !== undefined ? Math.max(0, Math.round(batteryLevel)) : null;
    const isLowBattery = displayBattery !== null && displayBattery <= 25;

    let message = '';
    let suggestion = '';
    let status: 'safe' | 'warning' | 'alert' = 'alert';

    if (isSos) {
      status = 'alert';
      const sosType = isSilent ? 'SILENT SOS' : 'SOS EMERGENCY';
      message = `🚨 ${partnerName} has triggered a ${sosType}! They need immediate attention.`;
      
      if (isLowBattery) {
        message += ` Their battery is critically low (${displayBattery}%).`;
        suggestion = `1. Attempt to call immediately.\n2. If no response, check their last known location on the map.\n3. Contact emergency services if you cannot reach them.`;
      } else {
        suggestion = `Try calling ${partnerName} right away. They may be in danger or need urgent help. Stay calm and head to their location if safe.`;
      }
    } else if (isLateNight && isLowBattery) {
      status = 'alert';
      message = `It's late and ${partnerName}'s battery is critical (${displayBattery}%). They haven't reached home yet.`;
      suggestion = `Check in with them now to ensure they have a safe way back before their phone dies.`;
    } else if (isLateNight) {
      status = 'warning';
      message = `${partnerName} is still out late at night.`;
      suggestion = `A quick message or call to check their status is recommended for peace of mind.`;
    } else if (isLowBattery) {
      status = 'warning';
      message = `${partnerName}'s phone is at ${displayBattery}% battery.`;
      suggestion = `Remind them to charge up soon so you can stay connected.`;
    } else {
      status = 'warning';
      message = `${partnerName} needs your attention.`;
      suggestion = `Reach out to see how they're doing.`;
    }

    return { message, status, suggestion };
  },

  /**
   * Checks if we should suggest Reach Safely mode for late night movement.
   */
  getMapIntelligence(isTripActive: boolean, isWalkSafeActive: boolean) {
    const hour = new Date().getHours();
    const isLateNight = hour >= 21 || hour < 6;
    
    if (isLateNight && !isTripActive && !isWalkSafeActive) {
      return {
        shouldAlert: true,
        reason: "It's getting late",
      };
    }
    return null;
  }
};
