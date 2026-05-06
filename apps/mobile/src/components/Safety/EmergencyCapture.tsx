import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { emergencyService } from '../../services/emergencyService';
import { useAuthStore } from '../../store/useAuthStore';
import { useLocationStore } from '../../store/useLocationStore';

interface EmergencyCaptureProps {
  isActive: boolean;
  isSilent?: boolean;
}

export const EmergencyCapture: React.FC<EmergencyCaptureProps> = ({ isActive, isSilent }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isCapturing, setIsCapturing] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const activeRef = useRef(isActive);
  const { coupleId } = useAuthStore();
  const targetPerCamera = 10;

  // Request permissions on mount
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  // Sync activeRef with isActive prop
  useEffect(() => {
    activeRef.current = isActive;
  }, [isActive]);

  // Monitor SOS activity
  useEffect(() => {
    if (isActive && permission?.granted && !isCapturing) {
      startCaptureSequence();
    }
  }, [isActive, permission?.granted]);

  const startCaptureSequence = async () => {
    if (!coupleId || isCapturing) return;
    setIsCapturing(true);
    setEvidenceUrl(null);

    console.log('[EmergencyCapture] Starting photo sequence...');

    let firstPhotoUrl: string | null = null;

    // 1. Back Camera Sequence (10 photos)
    setFacing('back');
    setIsCameraReady(false); // Reset ready state for new camera facing
    await new Promise(resolve => setTimeout(resolve, 2000)); // Longer wait for init
    
    for (let i = 0; i < targetPerCamera; i++) {
      if (!activeRef.current) break;
      if (cameraRef.current) {
        try {
          const photo = await cameraRef.current.takePictureAsync({ 
            quality: 0.5,
            skipProcessing: true // Faster capture, less memory
          });
          if (photo) {
            console.log(`[EmergencyCapture] Back photo ${i+1} taken`);
            const url = await emergencyService.uploadEmergencyPhoto(photo.uri, 'back', coupleId);
            if (!firstPhotoUrl && url) {
              firstPhotoUrl = url;
              setEvidenceUrl(url);
              
              // AUTO-TRIGGER WHATSAPP WITH THE VERY FIRST PHOTO
              const { currentUserProfile } = useAuthStore.getState();
              const contacts = currentUserProfile?.emergencyContacts || (currentUserProfile?.emergencyContact ? [currentUserProfile.emergencyContact] : []);
              if (contacts.length > 0) {
                const { userLocation } = useLocationStore.getState();
                emergencyService.notifyWhatsApp(
                  { latitude: userLocation?.coords.latitude || 0, longitude: userLocation?.coords.longitude || 0 },
                  contacts[0].phone,
                  url
                );
                setCurrentContactIndex(1);
              }
            }
          }
        } catch (e) {
          console.error('[EmergencyCapture] Back capture error:', e);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // More time between shots
    }

    // 2. Front Camera Sequence (10 photos)
    if (!activeRef.current) {
      setIsCapturing(false);
      return;
    }

    setFacing('front');
    setIsCameraReady(false);
    await new Promise(resolve => setTimeout(resolve, 2500)); // Even longer for front cam switch
    
    for (let i = 0; i < targetPerCamera; i++) {
      if (!activeRef.current) break;
      if (cameraRef.current) {
        try {
          const photo = await cameraRef.current.takePictureAsync({ 
            quality: 0.5,
            skipProcessing: true 
          });
          if (photo) {
            console.log(`[EmergencyCapture] Front photo ${i+1} taken`);
            const url = await emergencyService.uploadEmergencyPhoto(photo.uri, 'front', coupleId);
            if (!firstPhotoUrl && url) {
              firstPhotoUrl = url;
              setEvidenceUrl(url);
            }
          }
        } catch (e) {
          console.error('[EmergencyCapture] Front capture error:', e);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsCapturing(false);
    console.log('[EmergencyCapture] Sequence complete');

    // Contacts after the first one can be triggered manually via the UI

  };

  const [currentContactIndex, setCurrentContactIndex] = useState(0);

  if (!isActive || !permission?.granted) return null;

  const { currentUserProfile } = useAuthStore.getState();
  const contacts = currentUserProfile?.emergencyContacts || (currentUserProfile?.emergencyContact ? [currentUserProfile.emergencyContact] : []);
  const maxContacts = Math.min(contacts.length, 3);

  return (
    <View style={styles.container}>
      <CameraView 
        ref={cameraRef} 
        style={styles.hiddenCamera} 
        facing={facing}
        onCameraReady={() => setIsCameraReady(true)}
      />
      <View style={styles.overlay}>
        <View style={styles.statusBox}>
           <Text style={styles.text}>
            {isCapturing ? `Gathering Evidence...` : 'Evidence Captured'}
          </Text>
        </View>

        {!isCapturing && contacts.length > 0 && currentContactIndex < maxContacts && (
          <TouchableOpacity 
            style={styles.whatsappBtn}
            onPress={() => {
              const { userLocation } = useLocationStore.getState();
              emergencyService.notifyWhatsApp(
                { latitude: userLocation?.coords.latitude || 0, longitude: userLocation?.coords.longitude || 0 },
                contacts[currentContactIndex].phone,
                evidenceUrl || undefined
              );
              setCurrentContactIndex(prev => prev + 1);
            }}
          >
            <Text style={styles.whatsappText}>
              Alert {contacts[currentContactIndex].name} (WA)
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: '#FF3B30',
    zIndex: 9999,
    overflow: 'hidden',
    paddingTop: 45,
  },
  hiddenCamera: {
    width: 10,
    height: 10,
    opacity: 0.01,
    position: 'absolute',
    left: -100,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  statusBox: {
    flex: 1,
  },
  text: {
    color: 'white',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  whatsappText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
  }
});
