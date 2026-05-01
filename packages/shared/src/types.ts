export interface User {
  uid: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  coupleId?: string;
  fcmToken?: string;
  status?: {
    currentMood?: string;
    lastActive: number;
  };
}

export interface Couple {
  id: string;
  participants: string[]; // Array of 2 UIDs
  createdAt: number;
  settings: {
    mode: 'chill' | 'safety' | 'ldr';
    aiEnabled: boolean;
  };
  inviteCode?: {
    code: string;
    expiresAt: number;
  };
}

export type MessageType = 'text' | 'snap' | 'voice';

export interface Message {
  id: string;
  senderId: string;
  content: string;
  type: MessageType;
  metadata?: {
    expiresAt?: number;
    seen: boolean;
  };
  timestamp: number;
}

export interface SafetyEvent {
  id: string;
  coupleId: string;
  triggeredBy: string;
  type: 'sos' | 'location_request';
  active: boolean;
  location?: {
    lat: number;
    lng: number;
  };
  recordingUrl?: string;
}
