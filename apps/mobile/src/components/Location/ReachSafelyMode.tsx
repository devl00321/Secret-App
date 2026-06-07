import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TouchableWithoutFeedback, Dimensions, Alert } from 'react-native';
import { 
  Shield, 
  MapPin, 
  Navigation, 
  CheckCircle2, 
  ChevronRight, 
  X,
  Home,
  Briefcase,
  School,
  GraduationCap,
  Building2,
  Dumbbell,
  BookOpen,
  Clock,
  AlertTriangle,
  Timer
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { useLocationStore, SavedPlace } from '../../store/useLocationStore';
import { locationService } from '../../services/locationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PLACE_ICONS: Record<string, any> = {
  home: Home,
  office: Briefcase,
  tuition: BookOpen,
  school: School,
  college: GraduationCap,
  hostel: Building2,
  gym: Dumbbell,
  other: MapPin,
};

const ITEM_HEIGHT = 44; // Height of each wheel item for snap calculation

interface ReachSafelyModeProps {
  visible?: boolean;
  onClose?: () => void;
}

type Phase = 'destination' | 'timer';

export const ReachSafelyMode = ({ visible, onClose }: ReachSafelyModeProps) => {
  const theme = useTheme();
  const { walkSafe, savedPlaces, userLocation } = useLocationStore();
  const [showSelector, setShowSelector] = useState(false);
  const [phase, setPhase] = useState<Phase>('destination');
  const [selectedPlace, setSelectedPlace] = useState<SavedPlace | null>(null);
  const [selectedHours, setSelectedHours] = useState(0);
  const [selectedMinutes, setSelectedMinutes] = useState(30);
  
  // Live countdown state
  const [timeLeft, setTimeLeft] = useState('');
  const [distanceLeft, setDistanceLeft] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isSelectionMode = visible !== undefined;

  useEffect(() => {
    if (visible) {
      setShowSelector(true);
      setPhase('destination');
      setSelectedPlace(null);
    }
  }, [visible]);

  // Live countdown when walk safe is active
  useEffect(() => {
    if (walkSafe?.isActive && walkSafe.deadline) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const remaining = (walkSafe.deadline || 0) - now;
        
        if (remaining <= 0) {
          setTimeLeft('OVERDUE');
        } else {
          const min = Math.floor(remaining / 60000);
          const sec = Math.floor((remaining % 60000) / 1000);
          setTimeLeft(`${min}:${sec.toString().padStart(2, '0')}`);
        }

        // Distance
        if (walkSafe.lastCheckDistance !== null) {
          const d = walkSafe.lastCheckDistance;
          setDistanceLeft(d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`);
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [walkSafe?.isActive, walkSafe?.deadline, walkSafe?.lastCheckDistance]);

  const handleClose = () => {
    setShowSelector(false);
    setPhase('destination');
    setSelectedPlace(null);
    if (onClose) onClose();
  };

  const handleSelectPlace = (place: SavedPlace) => {
    setSelectedPlace(place);
    setPhase('timer');
  };

  const handleStartWalkSafe = () => {
    if (!selectedPlace) return;
    const totalMinutes = selectedHours * 60 + selectedMinutes;
    if (totalMinutes <= 0) return;
    useLocationStore.getState().startWalkSafe(selectedPlace, totalMinutes);
    locationService.startWalkSafeMonitor();
    locationService.syncWalkSafe();
    locationService.syncTripStatus();
    handleClose();
  };

  const handleCancelWalkSafe = () => {
    Alert.alert(
      'Cancel Walk Safe?',
      'Your partner will be notified that you cancelled the trip.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Cancel Trip',
          style: 'destructive',
          onPress: () => {
            locationService.stopWalkSafeMonitor();
            useLocationStore.getState().endWalkSafe('cancelled');
            locationService.syncWalkSafe();
            locationService.syncTripStatus();
          },
        },
      ]
    );
  };

  const handleReachedSafely = () => {
    const destinationName = walkSafe?.destination?.name || 'destination';
    locationService.stopWalkSafeMonitor();
    useLocationStore.getState().endWalkSafe('arrived');
    locationService.syncWalkSafe();
    locationService.syncTripStatus();
    
    // Log to Timeline
    import('../../services/activityService').then(({ activityService }) => {
      activityService.logActivity('travel', `Reached ${destinationName} safely! 🏡`);
    });
  };

  const getStatusColor = () => {
    switch (walkSafe?.status) {
      case 'traveling': return '#00C853';
      case 'warning': return '#FFA000';
      case 'overdue': return '#FF3B30';
      case 'arrived': return '#00C853';
      default: return theme.accentRose;
    }
  };

  const getStatusLabel = () => {
    switch (walkSafe?.status) {
      case 'traveling': return '🟢 En Route';
      case 'warning': return '🟡 Running Late';
      case 'overdue': return '🔴 Overdue';
      case 'arrived': return '✅ Arrived!';
      default: return 'Safe';
    }
  };

  // ─── SELECTION MODAL ──────────────────────────────────────────────
  if (isSelectionMode) {
    return (
      <Modal
        visible={showSelector}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={handleClose}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <View style={[styles.content, { backgroundColor: theme.bgSurface }]}>
            {phase === 'destination' ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Where are you going? 📍</Text>
                  <TouchableOpacity 
                    onPress={handleClose}
                    hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
                  >
                    <X size={24} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.selectorList} showsVerticalScrollIndicator={false}>
                  {(!Array.isArray(savedPlaces) || savedPlaces.length === 0) ? (
                    <View style={styles.emptyState}>
                      <MapPin size={40} color={theme.textSecondary} style={{ opacity: 0.3, marginBottom: 10 }} />
                      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No saved places yet.</Text>
                      <Text style={[styles.emptySubText, { color: theme.textSecondary }]}>
                        Add your Home, Work or Tuition in Settings first!
                      </Text>
                    </View>
                  ) : (
                    savedPlaces.map((place: SavedPlace) => {
                      const Icon = PLACE_ICONS[place.type] || MapPin;
                      return (
                        <TouchableOpacity
                          key={place.id}
                          style={[styles.placeOption, { backgroundColor: theme.isDark ? '#222' : '#F8F8F8' }]}
                          onPress={() => handleSelectPlace(place)}
                        >
                          <View style={[styles.placeIconCircle, { backgroundColor: theme.accentRose + '15' }]}>
                            <Icon size={20} color={theme.accentRose} />
                          </View>
                          <Text style={[styles.placeOptionName, { color: theme.textPrimary }]}>{place.name}</Text>
                          <ChevronRight size={18} color={theme.textSecondary} />
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>

                {savedPlaces.length > 0 && (
                  <Text style={[styles.modalNote, { color: theme.textSecondary }]}>
                    Select your destination to start Walk Safe monitoring.
                  </Text>
                )}
              </>
            ) : (
              /* ─── TIMER PHASE (iOS-style wheel) ──────────────── */
              <>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setPhase('destination')}>
                    <Text style={[styles.backLink, { color: theme.accentRose }]}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={handleClose}
                    hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
                  >
                    <X size={24} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.timerHeader}>
                  <View style={[styles.timerIconBox, { backgroundColor: theme.accentRose + '15' }]}>
                    <Timer size={28} color={theme.accentRose} />
                  </View>
                  <Text style={[styles.timerTitle, { color: theme.textPrimary }]}>
                    How long to reach{'\n'}
                    <Text style={{ color: theme.accentRose }}>{selectedPlace?.name}</Text>?
                  </Text>
                </View>

                {/* iOS-style Scroll Wheel */}
                <View style={styles.wheelContainer}>
                  {/* Hours wheel */}
                  <View style={styles.wheelColumn}>
                    <Text style={[styles.wheelLabel, { color: theme.textSecondary }]}>hours</Text>
                    <View style={styles.wheelWrapper}>
                      <View style={[styles.wheelHighlight, { borderColor: theme.accentRose + '40', backgroundColor: theme.accentRose + '08' }]} />
                      <ScrollView
                        style={styles.wheel}
                        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
                        showsVerticalScrollIndicator={false}
                        snapToInterval={ITEM_HEIGHT}
                        decelerationRate="fast"
                        onMomentumScrollEnd={(e) => {
                          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                          setSelectedHours(Math.max(0, Math.min(idx, 24))); // Limit to 24 hours
                        }}
                      >
                        {Array.from({ length: 25 }).map((_, h) => (
                          <View key={h} style={styles.wheelItem}>
                            <Text style={[
                              styles.wheelItemText,
                              { color: selectedHours === h ? theme.textPrimary : theme.textSecondary + '60' },
                              selectedHours === h && styles.wheelItemActive,
                            ]}>
                              {h}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  </View>

                  {/* Separator */}
                  <Text style={[styles.wheelSeparator, { color: theme.textPrimary }]}>:</Text>

                  {/* Minutes wheel */}
                  <View style={styles.wheelColumn}>
                    <Text style={[styles.wheelLabel, { color: theme.textSecondary }]}>min</Text>
                    <View style={styles.wheelWrapper}>
                      <View style={[styles.wheelHighlight, { borderColor: theme.accentRose + '40', backgroundColor: theme.accentRose + '08' }]} />
                      <ScrollView
                        style={styles.wheel}
                        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
                        showsVerticalScrollIndicator={false}
                        snapToInterval={ITEM_HEIGHT}
                        decelerationRate="fast"
                        onMomentumScrollEnd={(e) => {
                          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                          const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
                          setSelectedMinutes(minutes[Math.max(0, Math.min(idx, minutes.length - 1))]);
                        }}
                      >
                        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                          <View key={m} style={styles.wheelItem}>
                            <Text style={[
                              styles.wheelItemText,
                              { color: selectedMinutes === m ? theme.textPrimary : theme.textSecondary + '60' },
                              selectedMinutes === m && styles.wheelItemActive,
                            ]}>
                              {m.toString().padStart(2, '0')}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </View>

                <Text style={[styles.timerDisplay, { color: theme.textPrimary }]}>
                  {selectedHours > 0 ? `${selectedHours} hr ` : ''}{selectedMinutes} min
                </Text>

                <TouchableOpacity
                  style={[
                    styles.startBtn, 
                    { backgroundColor: (selectedHours > 0 || selectedMinutes > 0) ? theme.accentRose : theme.borderDefault }
                  ]}
                  onPress={handleStartWalkSafe}
                  disabled={selectedHours === 0 && selectedMinutes === 0}
                >
                  <Shield size={20} color="white" />
                  <Text style={styles.startBtnText}>Start Walk Safe</Text>
                </TouchableOpacity>

                <Text style={[styles.timerNote, { color: theme.textSecondary }]}>
                  If you don&apos;t reach in time, we&apos;ll ask if you&apos;re safe.{'\n'}No response in 2 min = auto SOS.
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  // ─── ACTIVE DASHBOARD (rendered on Location screen) ──────────────
  if (walkSafe?.isActive) {
    const statusColor = getStatusColor();

    return (
      <View style={[styles.activeContainer, { backgroundColor: theme.bgSurface }]}>
        <View style={styles.header}>
          <LinearGradient 
            colors={[statusColor, statusColor + 'AA']} 
            style={styles.pulse}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Navigation size={22} color="white" />
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={[styles.status, { color: theme.textPrimary }]} numberOfLines={1}>
              Heading to {walkSafe.destination?.name || 'Destination'} 🏃‍♂️
            </Text>
            <Text style={[styles.eta, { color: theme.textSecondary }]} numberOfLines={1}>
              Walk Safe active • Partner notified 💙
            </Text>
          </View>
        </View>

        <View style={[styles.metrics, { backgroundColor: theme.isDark ? '#222' : '#F8F9FF' }]}>
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: statusColor }]}>
              {timeLeft || '--:--'}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>TIME LEFT</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.borderDefault }]} />
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: theme.accentRose }]}>
              {distanceLeft || '--'}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>DISTANCE</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.borderDefault }]} />
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: statusColor }]}>
              {getStatusLabel()}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>STATUS</Text>
          </View>
        </View>

        <View style={styles.dashActions}>
          <TouchableOpacity 
            style={[styles.reachedButton, { backgroundColor: theme.accentRose }]}
            onPress={handleReachedSafely}
            activeOpacity={0.8}
          >
            <CheckCircle2 size={18} color="white" />
            <Text style={styles.reachedButtonText}>I&apos;ve Reached Safely</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.cancelTripBtn, { borderColor: theme.borderDefault }]}
            onPress={handleCancelWalkSafe}
            activeOpacity={0.8}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <X size={16} color={theme.textSecondary} />
            <Text style={[styles.cancelTripText, { color: theme.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  activeContainer: {
    padding: 20,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 12,
    width: SCREEN_WIDTH * 0.88,
    alignSelf: 'center',
    marginBottom: 0,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  pulse: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  status: {
    fontSize: 15,
    fontWeight: '800',
  },
  eta: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.6,
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    opacity: 0.5,
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
    height: 24,
    opacity: 0.2,
  },
  dashActions: {
    flexDirection: 'row',
    gap: 10,
  },
  reachedButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reachedButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  cancelTripBtn: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  cancelTripText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    paddingBottom: 40,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -15 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  backLink: {
    fontSize: 16,
    fontWeight: '700',
  },
  selectorList: {
    marginBottom: 15,
  },
  placeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 18,
    marginBottom: 10,
  },
  placeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  placeOptionName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptySubText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
  },
  modalNote: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.6,
    fontStyle: 'italic',
  },
  // Timer phase
  timerHeader: {
    alignItems: 'center',
    marginBottom: 25,
  },
  timerIconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  timerTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 26,
  },
  // iOS Scroll Wheel
  wheelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    height: ITEM_HEIGHT * 5,
  },
  wheelColumn: {
    alignItems: 'center',
    width: 100,
  },
  wheelLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  wheelWrapper: {
    height: ITEM_HEIGHT * 5,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  wheel: {
    height: ITEM_HEIGHT * 5,
  },
  wheelHighlight: {
    position: 'absolute' as const,
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 10,
    zIndex: -1,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  wheelItemText: {
    fontSize: 22,
    fontWeight: '500',
  },
  wheelItemActive: {
    fontWeight: '800' as const,
    fontSize: 26,
  },
  wheelSeparator: {
    fontSize: 28,
    fontWeight: '800',
    marginHorizontal: 10,
    marginTop: 20,
  },
  timerDisplay: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center' as const,
    marginBottom: 20,
    opacity: 0.6,
  },
  startBtn: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  startBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 10,
  },
  timerNote: {
    fontSize: 12,
    textAlign: 'center' as const,
    marginTop: 15,
    lineHeight: 18,
    opacity: 0.6,
  },
});
