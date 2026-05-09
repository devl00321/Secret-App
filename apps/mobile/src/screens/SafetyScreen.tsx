import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Switch, ScrollView, Animated, Platform, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Shield, AlertTriangle, Phone, Radio, BellOff } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme';
import { biometricService } from '../services/biometricService';
import { locationService } from '../services/locationService';
import { useLocationStore } from '../store/useLocationStore';
import { useAuthStore } from '../store/useAuthStore';
import { auth } from '../services/firebase';
import { SOSButton } from '../components/SOSButton';
import { EmergencyContactModal } from '../components/Safety/EmergencyContactModal';
import { ReachSafelyMode } from '../components/Location/ReachSafelyMode';
import { EmergencyCapture } from '../components/Safety/EmergencyCapture';
import { User, Phone as PhoneIcon, ChevronRight, Users, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export const SafetyScreen = () => {
  const theme = useTheme();
  const [isSilentMode, setIsSilentMode] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showWalkSafe, setShowWalkSafe] = useState(false);
  const hasPrompted = useRef(false);
  const { activeSos, walkSafe } = useLocationStore();
  const { currentUserProfile } = useAuthStore();
  const router = useRouter();
  
  // This value is shared with the SOSButton to sync the background color with the hold progress
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Check for emergency contact on mount
  useEffect(() => {
    if (currentUserProfile && !currentUserProfile.emergencyContact && !hasPrompted.current) {
      hasPrompted.current = true;
      setTimeout(() => setShowContactModal(true), 1000);
    }
  }, [currentUserProfile]);

  // Track the SOS Active state to force the background to red if it was triggered elsewhere
  useEffect(() => {
    if (activeSos?.isActive) {
      const userId = auth.currentUser?.uid;
      const isVictim = activeSos.triggeredBy === userId;
      
      // If I'm the victim and it's silent, don't show the red background
      if (isVictim && activeSos.isSilent) {
        Animated.timing(progressAnim, {
          toValue: 0.1, // Very subtle tint
          duration: 800,
          useNativeDriver: false,
        }).start();
      } else {
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }).start();
      }
    } else if (!activeSos?.isActive) {
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: false,
      }).start();
    }
  }, [activeSos?.isActive]);

  const handleSOS = async () => {
    await locationService.triggerSos(isSilentMode);
  };

  const handleCancelSOS = async () => {
    const success = await biometricService.authenticate('Confirm to deactivate SOS');
    if (success) {
      await locationService.clearSos();
      // Reset background manually after successful deactivation
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: false,
      }).start();
    }
  };

  // --- Immersive Interpolations ---
  const backgroundColor = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.background, '#2d0606'],
  });

  const textColor = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.text, '#FFFFFF'],
  });

  const textLightColor = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.textLight, 'rgba(255,255,255,0.6)'],
  });

  const cardBgColor = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.surface, 'rgba(255,255,255,0.08)'],
  });

  const cardBorderColor = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.border, 'rgba(255,255,255,0.15)'],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor }]}>
      <StatusBar style={activeSos?.isActive ? 'light' : 'auto'} animated />
      <SafeAreaView style={styles.safeArea}>
        <EmergencyCapture 
          isActive={!!activeSos?.isActive && activeSos.triggeredBy === auth.currentUser?.uid} 
          isSilent={activeSos?.isSilent}
        />
        <Header 
          title="Safety Center" 
          showBack 
          transparent 
          textColor={activeSos?.isActive ? 'white' : undefined} 
        />
        
        <ScrollView 
          style={styles.flex} 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sosContainer}>
            <SOSButton 
              isActive={!!activeSos?.isActive} 
              isSilent={activeSos?.isSilent}
              onTrigger={handleSOS} 
              onCancel={handleCancelSOS}
              progressAnim={progressAnim}
            />
            <Animated.Text style={[styles.sosHint, { color: textLightColor }]}>
              {activeSos?.isActive 
                ? (activeSos.isSilent ? "SILENT MODE ACTIVATED" : "EMERGENCY SIGNALS ACTIVE") 
                : "Hold for 3 seconds to alert partner"}
            </Animated.Text>
          </View>

          <Animated.View style={[styles.cardWrapper, { backgroundColor: cardBgColor, borderColor: cardBorderColor }]}>
            <View style={styles.silentToggle}>
              <View style={[styles.iconBox, { backgroundColor: isSilentMode ? '#FF3B3020' : 'rgba(0,0,0,0.05)' }]}>
                <BellOff size={20} color={isSilentMode ? '#FF3B30' : (activeSos?.isActive ? 'white' : '#6B7280')} />
              </View>
              <View style={styles.toggleText}>
                <Animated.Text style={[styles.cardTitle, { color: textColor }]}>Silent Emergency</Animated.Text>
                <Animated.Text style={[styles.cardDesc, { color: textLightColor }]}>Hide SOS status on this phone</Animated.Text>
              </View>
              <Switch 
                value={isSilentMode} 
                onValueChange={setIsSilentMode}
                trackColor={{ false: '#3f3f46', true: '#FF3B30' }}
              />
            </View>
          </Animated.View>

          <Animated.View style={[styles.cardWrapper, { backgroundColor: cardBgColor, borderColor: cardBorderColor }]}>
            <View style={styles.row}>
              <View style={styles.modeInfo}>
                <Animated.Text style={[styles.modeTitle, { color: textColor }]}>Walk Safe Mode</Animated.Text>
                <Animated.Text style={[styles.modeDesc, { color: textLightColor }]}>
                  {walkSafe?.isActive 
                    ? `Active — heading to ${walkSafe.destination?.name || 'destination'}` 
                    : "Alerts partner if you don't reach home"}
                </Animated.Text>
              </View>
              <Switch 
                value={!!walkSafe?.isActive} 
                onValueChange={(val) => {
                  if (val) {
                    setShowWalkSafe(true);
                  } else if (walkSafe?.isActive) {
                    // Cancel active trip
                    locationService.stopWalkSafeMonitor();
                    useLocationStore.getState().endWalkSafe('cancelled');
                    locationService.syncWalkSafe();
                    locationService.syncTripStatus();
                  }
                }} 
                trackColor={{ false: '#3f3f46', true: theme.primary }}
              />
            </View>
          </Animated.View>

          {/* GUARDIAN NETWORK SECTION */}
          <View style={styles.sectionHeader}>
            <Animated.Text style={[styles.sectionTitle, { color: textColor }]}>Guardian Network</Animated.Text>
            <TouchableOpacity onPress={() => router.push('/(app)/emergency-contacts')}>
              <Animated.Text style={[styles.editLink, { color: theme.primary }]}>Add / Manage</Animated.Text>
            </TouchableOpacity>
          </View>
          
          <Animated.View style={[styles.cardWrapper, { backgroundColor: cardBgColor, borderColor: cardBorderColor, padding: 18 }]}>
            {currentUserProfile?.emergencyContacts && currentUserProfile.emergencyContacts.length > 0 ? (
              <View>
                <TouchableOpacity 
                  style={styles.contactRow}
                  onPress={() => router.push('/(app)/emergency-contacts')}
                >
                  <View style={[styles.contactIcon, { backgroundColor: theme.primary + '15' }]}>
                    <Users size={20} color={theme.primary} />
                  </View>
                  <View style={styles.contactInfo}>
                    <Animated.Text style={[styles.contactName, { color: textColor }]}>
                      {currentUserProfile.emergencyContacts[0].name}
                    </Animated.Text>
                    <Animated.Text style={[styles.contactRole, { color: textLightColor }]}>
                      Primary • {currentUserProfile.emergencyContacts.length} of 10 guardians
                    </Animated.Text>
                  </View>
                  <ChevronRight size={20} color={theme.textLight} />
                </TouchableOpacity>
                
                {currentUserProfile.emergencyContacts.length < 10 && (
                  <TouchableOpacity 
                    style={[styles.miniAddBtn, { marginTop: 15, borderColor: theme.primary + '30' }]}
                    onPress={() => router.push('/(app)/emergency-contacts')}
                  >
                    <Plus size={16} color={theme.primary} />
                    <Text style={[styles.miniAddText, { color: theme.primary }]}>Add Another Guardian</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : currentUserProfile?.emergencyContact ? (
               <View>
                <TouchableOpacity 
                  style={styles.contactRow}
                  onPress={() => router.push('/(app)/emergency-contacts')}
                >
                  <View style={[styles.contactIcon, { backgroundColor: theme.primary + '15' }]}>
                    <User size={20} color={theme.primary} />
                  </View>
                  <View style={styles.contactInfo}>
                    <Animated.Text style={[styles.contactName, { color: textColor }]}>
                      {currentUserProfile.emergencyContact.name}
                    </Animated.Text>
                    <Animated.Text style={[styles.contactRole, { color: textLightColor }]}>
                      Primary • 1 of 10 guardians
                    </Animated.Text>
                  </View>
                  <ChevronRight size={20} color={theme.textLight} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.miniAddBtn, { marginTop: 15, borderColor: theme.primary + '30' }]}
                  onPress={() => router.push('/(app)/emergency-contacts')}
                >
                  <Plus size={16} color={theme.primary} />
                  <Text style={[styles.miniAddText, { color: theme.primary }]}>Add Backup Guardians</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addContactRow} onPress={() => setShowContactModal(true)}>
                <View style={[styles.contactIcon, { backgroundColor: theme.background }]}>
                  <PhoneIcon size={20} color={theme.textLight} />
                </View>
                <View style={styles.contactInfo}>
                  <Animated.Text style={[styles.contactName, { color: theme.textLight }]}>
                    No contact added
                  </Animated.Text>
                  <Animated.Text style={[styles.contactRole, { color: theme.textLight }]}>
                    Tap to setup your guardian network
                  </Animated.Text>
                </View>
                <ChevronRight size={20} color={theme.textLight} />
              </TouchableOpacity>
            )}
          </Animated.View>

          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Radio size={20} color={activeSos?.isActive ? '#FF3B30' : (walkSafe?.isActive ? theme.primary : theme.textLight)} />
              <Animated.Text style={[styles.statusLabel, { color: textLightColor }]}>
                {activeSos?.isActive ? "SOS BROADCASTING" : (walkSafe?.isActive ? "Tracking Active" : "Standby")}
              </Animated.Text>
            </View>
            <View style={styles.statusItem}>
              <Shield size={20} color={activeSos?.isActive ? '#4CAF50' : "#4CAF50"} />
              <Animated.Text style={[styles.statusLabel, { color: textLightColor }]}>
                {activeSos?.isActive ? "Partner Alerted" : "System Secure"}
              </Animated.Text>
            </View>
          </View>

          <View style={styles.emergencyContacts}>
            <Animated.Text style={[styles.sectionTitle, { color: textColor, marginBottom: 20 }]}>Quick Actions</Animated.Text>
            
            <TouchableOpacity 
              style={[styles.actionItem, { backgroundColor: activeSos?.isActive ? 'rgba(255,255,255,0.08)' : theme.surface }]}
              onPress={() => {
                const partner = useAuthStore.getState().partner;
                if (partner?.phoneNumber) {
                  Linking.openURL(`tel:${partner.phoneNumber}`);
                } else {
                  Alert.alert('No Phone Number', 'Your partner has not set a phone number in their profile.');
                }
              }}
            >
              <Phone size={22} color={activeSos?.isActive ? 'white' : theme.text} />
              <Animated.Text style={[styles.actionText, { color: textColor }]}>Call Partner</Animated.Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionItem, { backgroundColor: activeSos?.isActive ? 'rgba(255,255,255,0.08)' : theme.surface }]}
              onPress={() => {
                if (activeSos?.isActive) {
                  handleCancelSOS();
                } else {
                  handleSOS();
                }
              }}
            >
              <AlertTriangle size={22} color={activeSos?.isActive ? '#FF3B30' : theme.primary} />
              <Animated.Text style={[styles.actionText, { color: activeSos?.isActive ? '#FF3B30' : theme.primary }]}>
                {activeSos?.isActive ? "Stop SOS Alert" : "Test Emergency Signal"}
              </Animated.Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      <EmergencyContactModal 
        visible={showContactModal} 
        onClose={() => setShowContactModal(false)} 
      />

      <ReachSafelyMode 
        visible={showWalkSafe} 
        onClose={() => setShowWalkSafe(false)} 
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 25,
    paddingBottom: 150,
  },
  sosContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  sosHint: {
    marginTop: 20,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardWrapper: {
    padding: 22,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  silentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleText: {
    marginLeft: 16,
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeInfo: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modeDesc: {
    fontSize: 12,
    marginTop: 3,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '700',
  },
  emergencyContacts: {
    marginTop: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 12,
    paddingHorizontal: 5,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 15,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
  },
  contactRole: {
    fontSize: 12,
    marginTop: 2,
  },
  editLink: {
    fontSize: 14,
    fontWeight: '700',
    padding: 8,
  },
  miniAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  miniAddText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    marginBottom: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 15,
  },
});
