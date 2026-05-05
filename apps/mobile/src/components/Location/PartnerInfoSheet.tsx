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
  Modal
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
  Wifi,
  WifiOff
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
  partner: any;
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
  partner,
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
  const [snapState, setSnapState] = useState<'bottom' | 'half' | 'top'>('bottom');

  const snapTo = (toValue: number) => {
    let state: 'bottom' | 'half' | 'top' = 'bottom';
    if (toValue === SNAP_TOP) state = 'top';
    else if (toValue === SNAP_HALF) state = 'half';
    
    setSnapState(state);
    
    Animated.spring(panY, {
      toValue,
      useNativeDriver: true,
      tension: 50,
      friction: 12,
    }).start();
    
    if (toValue === SNAP_BOTTOM) {
      onClose();
    }
  };

  useEffect(() => {
    if (visible) {
      snapTo(SNAP_HALF);
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 10,
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
        lastPanY.current = (panY as any)._value;
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

  const lastSeen = partnerLocation?.timestamp ? 
    new Date(partnerLocation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
    'Just now';

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
            { backgroundColor: theme.background, transform: [{ translateY: panY }] }
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.headerContainer}>
            <View style={styles.handle} />
            <View style={styles.headerMain}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.partnerName, { color: theme.text }]}>{partner?.displayName || 'Partner'}</Text>
                <Text style={[styles.locationSnippet, { color: theme.textLight }]} numberOfLines={1}>
                  {partnerLocation?.address || 'Locating...'}
                </Text>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusText, { color: theme.textLight }]}>
                    {distance ? `${distance.toFixed(1)} km away` : 'Searching...'}
                  </Text>
                  <Text style={styles.dotSeparator}>•</Text>
                  <View style={styles.batteryInfo}>
                    {getBatteryIcon(partnerLocation?.batteryLevel)}
                    <Text style={[styles.statusText, { color: theme.textLight, marginLeft: 4 }]}>
                      {partnerLocation?.batteryLevel || 100}%
                    </Text>
                  </View>
                  <View style={[styles.batteryInfo, { marginLeft: 8 }]}>
                    {partnerLocation?.isOnline !== false ? (
                      <Wifi size={14} color={theme.textLight} />
                    ) : (
                      <WifiOff size={14} color="#FF4747" />
                    )}
                    <Text style={[styles.statusText, { color: partnerLocation?.isOnline !== false ? theme.textLight : "#FF4747", marginLeft: 4 }]}>
                      {partnerLocation?.isOnline !== false ? 'Online' : 'Offline'}
                    </Text>
                  </View>
                  <Text style={styles.dotSeparator}>•</Text>
                  <Text style={[styles.statusText, { color: theme.textLight }]}>{lastSeen}</Text>
                </View>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity 
                  onPress={onRefresh} 
                  style={[styles.refreshBtn, { backgroundColor: theme.surface }]}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <RefreshCcw size={18} color={theme.primary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => snapTo(SNAP_BOTTOM)} style={[styles.closeBtn, { backgroundColor: theme.surface }]}>
                  <X color={theme.text} size={20} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            scrollEnabled={snapState === 'top'}
          >
            {/* Active Trip Banner */}
            {partnerTrip?.isActive && (
              <View style={[styles.tripBanner, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
                <View style={[styles.tripIcon, { backgroundColor: theme.primary }]}>
                  <Navigation2 size={20} color="white" />
                </View>
                <View style={styles.tripInfo}>
                  <Text style={[styles.tripTitle, { color: theme.text }]}>
                    Heading to {partnerTrip.destination?.name || 'Destination'}
                  </Text>
                  <Text style={[styles.tripStatus, { color: theme.primary }]}>
                    Live tracking active • Safe 🏃‍♂️
                  </Text>
                </View>
              </View>
            )}

            {/* Action Cards Section */}
            <View style={styles.actionGrid}>
              <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: theme.surface }]}
                onPress={onLocate}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#F1F5F9' }]}>
                  <MapPin color={theme.primary} size={24} fill={theme.primary + '20'} />
                </View>
                <Text style={[styles.actionTitle, { color: theme.text }]}>Locate</Text>
                <Text style={[styles.actionDesc, { color: theme.textLight }]}>Center Map</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: theme.surface }]}
                onPress={onChat}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#DCFCE7' }]}>
                  <MessageCircle color="#22C55E" size={24} fill="#22C55E" />
                </View>
                <Text style={[styles.actionTitle, { color: theme.text }]}>Chat</Text>
                <Text style={[styles.actionDesc, { color: theme.textLight }]}>Private Msg</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionGrid}>
              <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: theme.surface }]}
                onPress={handlePing}
                disabled={pingCooldown > 0}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#FCE7F3' }]}>
                  {pingCooldown > 0 ? (
                    <View style={styles.pingTimerWrapper}>
                      <Svg height="26" width="26" viewBox="0 0 26 26">
                        <PingCircle
                          cx="13"
                          cy="13"
                          r="11"
                          stroke={theme.primary}
                          strokeWidth="2.5"
                          fill="transparent"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          transform="rotate(-90 13 13)"
                        />
                      </Svg>
                      <Text style={[styles.pingCountText, { color: theme.primary }]}>{pingCooldown}</Text>
                    </View>
                  ) : (
                    <Heart color={theme.primary} size={24} fill={theme.primary} />
                  )}
                </View>
                <Text style={[styles.actionTitle, { color: theme.text }]}>
                  {pingCooldown > 0 ? 'Recharging' : 'Send Ping'}
                </Text>
                <Text style={[styles.actionDesc, { color: theme.textLight }]}>
                  {pingCooldown > 0 ? `${pingCooldown}s left` : 'Get Attention'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: theme.surface }]}
                onPress={onNavigate}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <Navigation2 color="#0EA5E9" size={24} fill="#0EA5E9" />
                </View>
                <Text style={[styles.actionTitle, { color: theme.text }]}>Directions</Text>
                <Text style={[styles.actionDesc, { color: theme.textLight }]}>Open Maps</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Saved Places</Text>
            </View>

            {savedPlaces && savedPlaces.length > 0 ? (
              savedPlaces.map((place: any, index: number) => (
                <TouchableOpacity 
                  key={index}
                  style={[styles.placeRow, { backgroundColor: theme.surface }]}
                  onPress={() => onFocusPlace(place)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.placeIcon, { backgroundColor: theme.background }]}>
                    <MapPin color={theme.primary} size={18} />
                  </View>
                  <View style={styles.placeDetails}>
                    <Text style={[styles.placeName, { color: theme.text }]}>{place.name}</Text>
                    <Text style={[styles.placeAddress, { color: theme.textLight }]} numberOfLines={1}>
                      {place.type || 'Custom Location'}
                    </Text>
                  </View>
                  <ChevronRight color={theme.textLight} size={20} />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyPlaces}>
                <Text style={[{ color: theme.textLight, fontStyle: 'italic' }]}>No shared places yet.</Text>
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
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
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
  pingCountText: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '900',
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
  }
});
