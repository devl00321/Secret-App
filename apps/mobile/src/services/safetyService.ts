export interface SafetyContext {
  batteryLevel?: number;
  partnerName: string;
}

export const safetyService = {
  /**
   * Generates a calming, humanized safety insight based on time and battery.
   */
  getEmergencyInsight(context: SafetyContext) {
    const hour = new Date().getHours();
    // User requested: hour >= 21 || hour < 20 (assuming they meant morning, like 6 AM, so hour < 6)
    const isLateNight = hour >= 21 || hour < 6;
    const isLowBattery = context.batteryLevel !== undefined && context.batteryLevel <= 40;

    let message = '';
    let suggestion = '';
    let status: 'safe' | 'warning' | 'alert' = 'warning';

    if (isLateNight && isLowBattery) {
      status = 'alert';
      message = `It's getting late and ${context.partnerName}'s phone battery is running a bit low (${context.batteryLevel}%). They might just be on their way back.`;
      suggestion = `Give them a quick call to check in, ensure they're okay, and take care of them.`;
    } else if (isLateNight) {
      status = 'warning';
      message = `It's night time and ${context.partnerName} is still outside or not at home yet.`;
      suggestion = `Call them once just to check in and see if they need anything. Take care of them!`;
    } else if (isLowBattery) {
      status = 'warning';
      message = `${context.partnerName}'s phone battery is getting low (${context.batteryLevel}%).`;
      suggestion = `You might want to reach out before their phone dies, just to check on them.`;
    } else {
      status = 'warning';
      message = `${context.partnerName} has triggered an alert.`;
      suggestion = `Give them a quick call to see what's up and let them know you're there for them.`;
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
