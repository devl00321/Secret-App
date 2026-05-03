import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
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
  BookOpen
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { useLocationStore, SavedPlace } from '../../store/useLocationStore';

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

export const ReachSafelyMode = () => {
  const theme = useTheme();
  const { isTripActive, setTripActive, distanceToPartner, savedPlaces, destination } = useLocationStore();
  const [showSelector, setShowSelector] = useState(false);

  const startTrip = (place: SavedPlace) => {
    setTripActive(true, {
      latitude: place.latitude,
      longitude: place.longitude,
      name: place.name
    });
    setShowSelector(false);
  };

  if (isTripActive) {
    return (
      <View style={[styles.activeContainer, { backgroundColor: theme.surface }]}>
        <View style={styles.header}>
          <LinearGradient 
            colors={[theme.primary, theme.primary + 'AA']} 
            style={styles.pulse}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Navigation size={22} color="white" />
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={[styles.status, { color: theme.text }]} numberOfLines={1}>
              Heading to {destination?.name || 'Destination'} 🏃‍♂️
            </Text>
            <Text style={[styles.eta, { color: theme.textLight }]} numberOfLines={1}>
              Live tracking active • Partner notified 💙
            </Text>
          </View>
        </View>

        <View style={[styles.metrics, { backgroundColor: theme.isDark ? '#222' : '#F8F9FF' }]}>
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: theme.primary }]}>
              {distanceToPartner ? `${distanceToPartner.toFixed(1)} km` : '--'}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.textLight }]}>REMAINING</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: '#00C853' }]}>
              Safe
            </Text>
            <Text style={[styles.metricLabel, { color: theme.textLight }]}>STATUS</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.reachedButton, { backgroundColor: theme.primary }]}
          onPress={() => setTripActive(false)}
          activeOpacity={0.8}
        >
          <CheckCircle2 size={18} color="white" />
          <Text style={styles.reachedButtonText}>I've Reached Safely</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <View style={styles.info}>
          <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
            <Shield size={22} color={theme.primary} />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>Reach Safely Mode</Text>
            <Text style={[styles.desc, { color: theme.textLight }]} numberOfLines={2}>
              Pick a destination to start tracking.
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.miniStartButton, { backgroundColor: theme.primary }]}
            onPress={() => setShowSelector(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.miniStartButtonText}>Start</Text>
            <ChevronRight size={14} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Where are you going? 📍</Text>
              <TouchableOpacity onPress={() => setShowSelector(false)}>
                <X size={24} color={theme.textLight} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.selectorList}>
              {savedPlaces.length === 0 ? (
                <View style={styles.emptyState}>
                  <MapPin size={40} color={theme.textLight} style={{ opacity: 0.3, marginBottom: 10 }} />
                  <Text style={[styles.emptyText, { color: theme.textLight }]}>No saved places yet.</Text>
                  <Text style={[styles.emptySubText, { color: theme.textLight }]}>
                    Add your Home, Work or Tuition in Settings first!
                  </Text>
                </View>
              ) : (
                savedPlaces.map((place) => {
                  const Icon = PLACE_ICONS[place.type] || MapPin;
                  return (
                    <TouchableOpacity
                      key={place.id}
                      style={[styles.placeOption, { backgroundColor: theme.isDark ? '#222' : '#F8F8F8' }]}
                      onPress={() => startTrip(place)}
                    >
                      <View style={[styles.placeIconCircle, { backgroundColor: theme.primary + '15' }]}>
                        <Icon size={20} color={theme.primary} />
                      </View>
                      <Text style={[styles.placeOptionName, { color: theme.text }]}>{place.name}</Text>
                      <ChevronRight size={18} color={theme.textLight} />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {savedPlaces.length > 0 && (
              <Text style={[styles.modalNote, { color: theme.textLight }]}>
                We'll notify your partner automatically when you arrive.
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  activeContainer: {
    padding: 20,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.7,
  },
  miniStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  miniStartButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 2,
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
  },
  metricValue: {
    fontSize: 18,
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
  reachedButton: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    paddingBottom: 40,
    maxHeight: '70%',
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
  }
});
