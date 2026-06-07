import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  Dimensions, 
  ScrollView, 
  Platform, 
  ActivityIndicator,
  PanResponder,
  Modal,
  Linking,
  Alert
} from 'react-native';
import { Image } from 'expo-image';
import { 
  Navigation2, 
  MapPin, 
  X, 
  Heart, 
  Clock, 
  Send, 
  Battery, 
  RefreshCcw, 
  ChevronRight,
  MessageCircle,
  Phone,
  Wifi,
  WifiOff,
  Bell,
  Cake
} from 'lucide-react-native';
import { Svg, Circle as PingCircle } from 'react-native-svg';
import { useTheme } from '../../theme';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Snap points
const SNAP_TOP = SCREEN_HEIGHT * 0.1;
const SNAP_HALF = SCREEN_HEIGHT * 0.45;
const SNAP_BOTTOM = SCREEN_HEIGHT;

interface PartnerInfoSheetProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: () => void;
  onChat: () => void;
  onLocate: () => void;
  onPing: () => void;
  onRefresh: () => void;
  onRing: () => void;
  partner: any;
  partnerName: string;
  partnerLocation: any;
  distance: number | null;
  savedPlaces: any[];
  onFocusPlace: (place: any) => void;
  isRefreshing?: boolean;
  partnerTrip?: {
    isActive: boolean;
    destination: { latitude: number; longitude: number; name?: string } | null;
  } | null;
}

export const PartnerInfoSheet = ({
  visible,
  onClose,
  onNavigate,
  onChat,
  onLocate,
  onPing,
  onRefresh,
  onRing,
  partner,
  partnerName,
  partnerLocation,
  distance,
  savedPlaces,
  onFocusPlace,
  isRefreshing = false,
  partnerTrip
}: PartnerInfoSheetProps) => {
  const theme = useTheme();
  const panY = useRef(new Animated.Value(SNAP_BOTTOM)).current;
  const lastPanY = useRef(SNAP_BOTTOM);
  const [pingCooldown, setPingCooldown] = useState(0);
  const [ringCooldown, setRingCooldown] = useState(0);
  const [snapState, setSnapState] = useState<'bottom' | 'half' | 'top'>('bottom');

  // Keep lastPanY.current updated safely without using private _value
  useEffect(() => {
    const listenerId = panY.addListener(({ value }) => {
      lastPanY.current = value;
    });
    return () => {
      panY.removeListener(listenerId);
    };
  }, [panY]);

  const snapTo = (toValue: number) => {
    let state: 'bottom' | 'half' | 'top' = 'bottom';
    if (toValue === SNAP_TOP) state = 'top';
    else if (toValue === SNAP_HALF) state = 'half';
    
    setSnapState(state);
    lastPanY.current = toValue;
    
    Animated.spring(panY, {
      toValue,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
    
    if (toValue === SNAP_BOTTOM) {
      onClose();
    }
  };

  useEffect(() => {
    if (visible) {
      snapTo(SNAP_HALF);
      // Auto-refresh when opened to get latest battery/location
      onRefresh();
    } else {
      snapTo(SNAP_BOTTOM);
    }
  }, [visible]);

  useEffect(() => {
    let timer: any;
    if (pingCooldown > 0) {
      timer = setInterval(() => {
        setPingCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [pingCooldown]);

  useEffect(() => {
    let timer: any;
    if (ringCooldown > 0) {
      timer = setInterval(() => {
        setRingCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [ringCooldown]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 20,
      onPanResponderMove: (_, gesture) => {
        const nextY = lastPanY.current + gesture.dy;
        if (nextY >= SNAP_TOP) {
          panY.setValue(nextY);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const releasedY = lastPanY.current + gesture.dy;
        const velocity = gesture.vy;

        // Snapping logic based on velocity and position
        if (velocity < -0.5) {
          snapTo(SNAP_TOP);
        } else if (velocity > 0.5) {
          if (releasedY < SNAP_HALF) snapTo(SNAP_HALF);
          else snapTo(SNAP_BOTTOM);
        } else {
          // No significant velocity, snap to nearest
          const distToTop = Math.abs(releasedY - SNAP_TOP);
          const distToHalf = Math.abs(releasedY - SNAP_HALF);
          const distToBottom = Math.abs(releasedY - SNAP_BOTTOM);

          const min = Math.min(distToTop, distToHalf, distToBottom);
          if (min === distToTop) snapTo(SNAP_TOP);
          else if (min === distToHalf) snapTo(SNAP_HALF);
          else snapTo(SNAP_BOTTOM);
        }
      },
      onPanResponderGrant: () => {
        // lastPanY.current is kept in sync via addListener
      }
    })
  ).current;

  const handlePing = () => {
    if (pingCooldown > 0) return;
    
    // Trigger local feedback
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    // Call the parent handler to send the cloud signal
    onPing();
    
    setPingCooldown(30);
  };

  const circumference = 2 * Math.PI * 11;
  const strokeDashoffset = circumference - (pingCooldown / 30) * circumference;

  const getBatteryIcon = (level: number = 100) => {
    const color = level < 20 ? '#FF4747' : level < 50 ? '#FFB020' : '#22C55E';
    return <Battery size={14} color={color} />;
  };

  const lastSeen = React.useMemo(() => {
    if (!partnerLocation?.timestamp) return 'Just now';
    
    let timeMs: number | null = null;
    const ts = partnerLocation.timestamp;
    
    if (typeof ts === 'number') {
      timeMs = ts;
    } else if (typeof ts === 'object' && ts !== null) {
      if (typeof (ts as any).toMillis === 'function') {
        timeMs = (ts as any).toMillis();
      } else if (typeof (ts as any).seconds === 'number') {
        timeMs = (ts as any).seconds * 1000;
      } else if (ts instanceof Date) {
        timeMs = ts.getTime();
      }
    } else if (typeof ts === 'string') {
      const parsed = Date.parse(ts);
      if (!isNaN(parsed)) {
        timeMs = parsed;
      }
    }

    if (timeMs === null || isNaN(timeMs)) {
      return 'Just now';
    }

    try {
      const date = new Date(timeMs);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      console.warn('[PartnerInfoSheet] Failed to format lastSeen time:', e);
      return 'Just now';
    }
  }, [partnerLocation?.timestamp]);

  const daysToBirthday = React.useMemo(() => {
    if (!partner?.dob) return null;
    const dobParts = partner.dob.split('/');
    if (dobParts.length !== 3) return null;
    
    const [dayStr, monthStr, ] = dobParts;
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);
    
    if (isNaN(month) || isNaN(day)) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextBirthday = new Date(today.getFullYear(), month, day);
    
    if (today.getTime() > nextBirthday.getTime()) {
      nextBirthday.setFullYear(today.getFullYear() + 1);
    } else if (today.getTime() === nextBirthday.getTime()) {
      return 0;
    }

    const diffTime = Math.abs(nextBirthday.getTime() - today.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  }, [partner?.dob]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => snapTo(SNAP_BOTTOM)}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={() => snapTo(SNAP_BOTTOM)} 
        />
        <Animated.View 
          style={[
            styles.sheet, 
            { backgroundColor: theme.bgPrimary, transform: [{ translateY: panY }] }
          ]}
        >
          <View style={styles.headerContainer} {...panResponder.panHandlers}>
            <View style={styles.handle} />
            <View style={styles.headerMain}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.partnerName, { color: theme.textPrimary }]}>{partnerName}</Text>
                <Text style={[styles.locationSnippet, { color: theme.textSecondary }]} numberOfLines={1}>
                  {partnerLocation?.address || 'Locating...'}
                </Text>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusText, { color: theme.textSecondary }]}>
                    {distance ? `${distance.toFixed(1)} km away` : 'Searching...'}
                  </Text>
                  <Text style={styles.dotSeparator}>•</Text>
                  <View style={styles.batteryInfo}>
                    {getBatteryIcon(partnerLocation?.batteryLevel)}
                    <Text style={[styles.statusText, { color: theme.textSecondary, marginLeft: 4 }]}>
                      {partnerLocation?.batteryLevel || 100}%
                    </Text>
                  </View>
                  <View style={[styles.batteryInfo, { marginLeft: 8 }]}>
                    {partnerLocation?.isOnline !== false ? (
                      <Wifi size={14} color={theme.textSecondary} />
                    ) : (
                      <WifiOff size={14} color="#FF4747" />
                    )}
                    <Text style={[styles.statusText, { color: partnerLocation?.isOnline !== false ? theme.textSecondary : "#FF4747", marginLeft: 4 }]}>
                      {partnerLocation?.isOnline !== false ? 'Online' : 'Offline'}
                    </Text>
                  </View>
                  <Text style={styles.dotSeparator}>•</Text>
                  <Text style={[styles.statusText, { color: theme.textSecondary }]}>{lastSeen}</Text>
                </View>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity 
                  onPress={onRefresh} 
                  style={[styles.refreshBtn, { backgroundColor: theme.bgSurface }]}
                  disabled={isRefreshing}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  {isRefreshing ? (
                    <ActivityIndicator size="small" color={theme.accentRose} />
                  ) : (
                    <RefreshCcw size={18} color={theme.accentRose} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => snapTo(SNAP_BOTTOM)} 
                  style={[styles.closeBtn, { backgroundColor: theme.bgSurface }]}
                  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                  <X color={theme.textPrimary} size={20} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
          >
            {/* Active Trip Banner */}
            {partnerTrip?.isActive && (
              <View style={[styles.tripBanner, { backgroundColor: theme.accentRose + '10', borderColor: theme.accentRose + '30' }]}>
                <View style={[styles.tripIcon, { backgroundColor: theme.accentRose }]}>
                  <Navigation2 size={20} color="white" />
                </View>
                <View style={styles.tripInfo}>
                  <Text style={[styles.tripTitle, { color: theme.textPrimary }]}>
                    Heading to {partnerTrip.destination?.name || partnerName || 'Destination'}
                  </Text>
                  <Text style={[styles.tripStatus, { color: theme.accentRose }]}>
                    Live tracking active • Safe 🏃‍♂️
                  </Text>
                </View>
              </View>
            )}

            {/* Action Cards Section */}
            <View style={styles.actionGrid}>
              <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: theme.bgSurface }]}
                onPress={onLocate}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#F1F5F9' }]}>
                  <MapPin color={theme.accentRose} size={24} fill={theme.accentRose + '20'} />
                </View>
                <Text style={[styles.actionTitle, { color: theme.textPrimary }]}>Locate</Text>
                <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Center Map</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: theme.bgSurface }]}
                onPress={onChat}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#DCFCE7' }]}>
                  <MessageCircle color="#22C55E" size={24} fill="#22C55E" />
                </View>
                <Text style={[styles.actionTitle, { color: theme.textPrimary }]}>Chat</Text>
                <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Private Msg</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionGrid}>
              <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: theme.bgSurface }]}
                onPress={handlePing}
                disabled={pingCooldown > 0}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#FCE7F3' }]}>
                  {pingCooldown > 0 ? (
                    <View style={styles.pingTimerWrapper}>
                      <Svg height="26" width="26" viewBox="0 0 26 26">
                        <PingCircle
                          cx="13"
                          cy="13"
                          r="11"
                          stroke={theme.accentRose}
                          strokeWidth="2.5"
                          fill="transparent"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          transform="rotate(-90 13 13)"
                        />
                      </Svg>
                      <Text style={[styles.pingCountText, { color: theme.accentRose }]}>{pingCooldown}</Text>
                    </View>
                  ) : (
                    <Heart color={theme.accentRose} size={24} fill={theme.accentRose} />
                  )}
                </View>
                <Text style={[styles.actionTitle, { color: theme.textPrimary }]}>
                  {pingCooldown > 0 ? 'Recharging' : 'Send Ping'}
                </Text>
                <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>
                  {pingCooldown > 0 ? `${pingCooldown}s left` : 'Get Attention'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: theme.bgSurface }]}
                onPress={() => {
                  if (partner?.phoneNumber) {
                    Linking.openURL(`tel:${partner.phoneNumber}`);
                  } else {
                    Alert.alert('No Phone Number', 'Your partner has not set a phone number in their profile.');
                  }
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <Phone color="#0EA5E9" size={24} fill="#0EA5E9" />
                </View>
                <Text style={[styles.actionTitle, { color: theme.textPrimary }]}>Call</Text>
                <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Voice Call</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionGrid}>
              <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: theme.bgSurface, opacity: ringCooldown > 0 ? 0.7 : 1 }]}
                disabled={ringCooldown > 0}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  onRing();
                  setRingCooldown(30);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#EDE9FE' }]}>
                  {ringCooldown > 0 ? (
                    <View style={styles.pingCooldownContainer}>
                      <Svg width="26" height="26" viewBox="0 0 26 26">
                        <PingCircle
                          cx="13"
                          cy="13"
                          r="11"
                          stroke={theme.accentRose + '20'}
                          strokeWidth="2"
                          fill="transparent"
                        />
                        <PingCircle
                          cx="13"
                          cy="13"
                          r="11"
                          stroke={theme.accentRose}
                          strokeWidth="2"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 11}
                          strokeDashoffset={2 * Math.PI * 11 * (1 - ringCooldown / 30)}
                          strokeLinecap="round"
                          transform="rotate(-90 13 13)"
                        />
                      </Svg>
                      <Text style={[styles.pingCountText, { color: theme.accentRose, fontSize: 10 }]}>{ringCooldown}</Text>
                    </View>
                  ) : (
                    <Bell color="#8B5CF6" size={24} fill="#8B5CF6" />
                  )}
                </View>
                <Text style={[styles.actionTitle, { color: theme.textPrimary }]}>
                  {ringCooldown > 0 ? 'Recharging' : 'Ring Phone'}
                </Text>
                <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>
                  {ringCooldown > 0 ? `${ringCooldown}s left` : 'Play Loud Alarm'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: theme.bgSurface }]}
                onPress={onNavigate}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Navigation2 color="#D97706" size={24} fill="#D97706" />
                </View>
                <Text style={[styles.actionTitle, { color: theme.textPrimary }]}>Directions</Text>
                <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Open Maps</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Important Dates</Text>
            </View>

            <View style={[styles.datesCard, { backgroundColor: theme.bgSurface }]}>
               <View style={styles.dateRow}>
                 <View style={[styles.dateIcon, { backgroundColor: theme.accentRoseSoft }]}>
                   <Cake size={18} color={theme.accentRose} />
                 </View>
                 <View style={styles.dateInfo}>
                   <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>Birthday</Text>
                   <Text style={[styles.dateValue, { color: theme.textPrimary }]}>
                     {partner?.dob || 'Not set'}
                   </Text>
                 </View>
                 {daysToBirthday !== null && (
                   <View style={[styles.countdownBadge, { backgroundColor: daysToBirthday === 0 ? theme.accentRose : theme.bgPrimary }]}>
                     <Text style={[styles.countdownText, { color: daysToBirthday === 0 ? 'white' : theme.accentRose }]}>
                       {daysToBirthday === 0 ? 'Today!' : `${daysToBirthday}d left`}
                     </Text>
                   </View>
                 )}
               </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Saved Places</Text>
            </View>

            {(Array.isArray(savedPlaces) && savedPlaces.length > 0) ? (
              savedPlaces.map((place: any, index: number) => (
                <TouchableOpacity 
                  key={index}
                  style={[styles.placeRow, { backgroundColor: theme.bgSurface }]}
                  onPress={() => onFocusPlace(place)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.placeIcon, { backgroundColor: theme.bgPrimary }]}>
                    <MapPin color={theme.accentRose} size={18} />
                  </View>
                  <View style={styles.placeDetails}>
                    <Text style={[styles.placeName, { color: theme.textPrimary }]}>{place.name}</Text>
                    <Text style={[styles.placeAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                      {place.type || 'Custom Location'}
                    </Text>
                  </View>
                  <ChevronRight color={theme.textSecondary} size={20} />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyPlaces}>
                <Text style={[{ color: theme.textSecondary, fontStyle: 'italic' }]}>No shared places yet.</Text>
              </View>
            )}
            <View style={{ height: 120 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  sheet: {
    width: '100%',
    height: SCREEN_HEIGHT,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -15 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 20,
    position: 'absolute',
  },
  headerContainer: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 20,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  partnerName: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  locationSnippet: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pingCooldownContainer: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pingCountText: {
    fontSize: 10,
    fontWeight: '800',
    position: 'absolute',
    textAlign: 'center',
    width: '100%',
    lineHeight: 26, // Center vertically
  },
  dotSeparator: {
    marginHorizontal: 8,
    color: '#CBD5E1',
    fontWeight: 'bold',
  },
  batteryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    padding: 16,
    borderRadius: 24,
    alignItems: 'flex-start',
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 13,
    fontWeight: '500',
  },
  pingTimerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    marginTop: 32,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  placeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeDetails: {
    flex: 1,
    marginLeft: 16,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  placeAddress: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyPlaces: {
    padding: 20,
    alignItems: 'center',
  },
  tripBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  tripIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  tripInfo: {
    flex: 1,
  },
  tripTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  tripStatus: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.8,
  },
  datesCard: {
    padding: 16,
    borderRadius: 24,
    marginHorizontal: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dateInfo: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  countdownBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
