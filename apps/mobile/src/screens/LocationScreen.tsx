import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Platform, Linking, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Navigation2, 
  Settings, 
  Heart, 
  Search, 
  ShieldAlert,
  Phone,
  Shield,
  MapPin,
  X,
  Clock,
  BellOff,
  VolumeX
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme';
import { useLocationStore } from '../store/useLocationStore';
import { locationService } from '../services/locationService';
import { useAuthStore } from '../store/useAuthStore';
import { alertService } from '../services/alertService';
import { MapComponent } from '../components/Location/MapComponent';
import { LocationSettingsModal } from '../components/Location/LocationSettingsModal';
import { SavedPlacesModal } from '../components/Location/SavedPlacesModal';
import { PartnerInfoSheet } from '../components/Location/PartnerInfoSheet';
import { ReachSafelyMode } from '../components/Location/ReachSafelyMode';
import { PingAnimation } from '../components/Location/PingAnimation'; // Forced refresh 💓
import { AddPlaceModal } from '../components/Location/AddPlaceModal';
import * as Haptics from 'expo-haptics';

const GOOGLE_MAPS_APIKEY = 'YOUR_GOOGLE_MAPS_API_KEY_HERE';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const LocationScreen = () => {
  const theme = useTheme();
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const { user, coupleId, partner, currentUserProfile } = useAuthStore();
  const { 
    userLocation, 
    partnerLocation, 
    savedPlaces,
    partnerSavedPlaces, 
    activeSos,
    distanceToPartner,
    etaToPartner,
    updateMetrics,
    destination,
    partnerTrip,
    partnerWalkSafe,
    isTripActive,
    isSirenMuted,
    setSirenMuted
  } = useLocationStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showSavedPlaces, setShowSavedPlaces] = useState(false);
  const [showPartnerInfo, setShowPartnerInfo] = useState(false);
  const [showReachSafely, setShowReachSafely] = useState(false);
  const [isIntercepting, setIsIntercepting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPingAnim, setShowPingAnim] = useState(false);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number, longitude: number } | null>(null);
  const bannerPulse = useRef(new Animated.Value(1)).current;
  const partnerName = currentUserProfile?.partnerNickname || partner?.displayName || 'Partner';

  useEffect(() => {
    locationService.startTracking();
    locationService.syncSavedPlaces(); // Sync local places to cloud on entry

    // Auto-center on partner after a short delay once mounted
    const timer = setTimeout(() => {
      if (partnerLocation) {
        zoomToPartner();
      }
    }, 1500);

    return () => {
      locationService.stopTracking();
      clearTimeout(timer);
    };
  }, [coupleId, partner?.id]);

  useEffect(() => {
    if (activeSos?.isActive && activeSos.triggeredBy !== user?.uid) {
      zoomToPartner();
      startBannerPulse();
    } else {
      bannerPulse.setValue(1);
    }
  }, [activeSos?.isActive]);

  // REDUNDANT: Handled globally in locationService.ts
  /*
  useEffect(() => { ... })
  */

  const startBannerPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bannerPulse, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(bannerPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      const coords = userLocation.coords || userLocation;
      mapRef.current.animateToRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  const zoomToPartner = () => {
    if (partnerLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: partnerLocation.latitude,
        longitude: partnerLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    }
  };

  const handleNavigate = () => {
    if (partnerLocation) {
      const url = Platform.select({
        ios: `maps://app?daddr=${partnerLocation.latitude},${partnerLocation.longitude}`,
        android: `google.navigation:q=${partnerLocation.latitude},${partnerLocation.longitude}`,
      });
      if (url) Linking.openURL(url);
    }
  };

  const handlePing = async () => {
    if (partner?.id) {
      await locationService.sendPing(partner.id);
    }
  };

  const isPartnerSos = activeSos?.isActive && activeSos.triggeredBy !== user?.uid;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.map}>
        <MapComponent
          mapRef={mapRef}
          userLocation={userLocation}
          partnerLocation={partnerLocation}
          destination={destination}
          GOOGLE_MAPS_APIKEY={GOOGLE_MAPS_APIKEY}
          onMapReady={() => {}}
          updateMetrics={updateMetrics}
          theme={theme}
          darkMapStyle={[]}
          user={user}
          savedPlaces={savedPlaces || []}
          distanceToPartner={distanceToPartner}
          etaToPartner={etaToPartner}
          onMarkerPress={() => setShowPartnerInfo(true)}
          partnerName={partnerName}
          isSelectingLocation={isSelectingLocation}
          onRegionChangeComplete={(region: any) => {
            if (isSelectingLocation) {
              setSelectedCoords({ latitude: region.latitude, longitude: region.longitude });
            }
          }}
        />
      </View>

      {/* EMERGENCY UI */}
      {isPartnerSos && (
        <View style={styles.emergencyOverlay} pointerEvents="box-none">
          <LinearGradient 
            colors={['rgba(0,0,0,0.8)', 'transparent', 'rgba(139,0,0,0.6)']} 
            style={StyleSheet.absoluteFill} 
            pointerEvents="none"
          />
          <SafeAreaView style={styles.sosHeader}>
            <Animated.View style={[styles.sosBanner, { transform: [{ scale: bannerPulse }] }]}>
              <ShieldAlert size={24} color="white" strokeWidth={3} />
              <Text style={styles.sosBannerText}>PARTNER SOS ACTIVE</Text>
            </Animated.View>
          </SafeAreaView>
          <View style={styles.emergencyPanelContainer}>
            <View style={styles.emergencyPanel}>
              <View style={styles.panelHeader}>
                <View style={styles.statusDot} />
                <Text style={styles.panelTitle}>Emergency Response</Text>
              </View>
              <View style={styles.emergencyActions}>
                <TouchableOpacity style={[styles.emergencyBtn, { backgroundColor: '#FF3B30' }]} onPress={() => Linking.openURL('tel:112')}>
                  <Phone size={20} color="white" />
                  <Text style={styles.emergencyBtnText} numberOfLines={1}>Call 112</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.emergencyBtn, { backgroundColor: '#34C759' }]} 
                  onPress={() => {
                    if (partner?.phoneNumber) {
                      Linking.openURL(`tel:${partner.phoneNumber}`);
                    } else {
                      Alert.alert('No Phone Number', 'Your partner has not set a phone number in their profile.');
                    }
                  }}
                >
                  <Phone size={20} color="white" />
                  <Text style={styles.emergencyBtnText} numberOfLines={1}>Call Partner</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.emergencyBtn, { backgroundColor: '#007AFF' }]} onPress={handleNavigate}>
                  <Navigation2 size={20} color="white" />
                  <Text style={styles.emergencyBtnText} numberOfLines={1}>Navigate</Text>
                </TouchableOpacity>
                {!isSirenMuted && (
                  <TouchableOpacity 
                    style={[styles.emergencyBtn, { backgroundColor: '#555' }]} 
                    onPress={() => {
                      alertService.stopSiren();
                      setSirenMuted(true);
                    }}
                  >
                    <VolumeX size={20} color="white" />
                    <Text style={styles.emergencyBtnText} numberOfLines={1}>Mute Siren</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      )}

      {/* STANDARD UI */}
      {!isPartnerSos && !isSelectingLocation && (
        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          <View style={styles.topContainer}>
            <View style={styles.topBar}>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: theme.surface }]}
                onPress={() => setShowSettings(true)}
              >
                <Settings size={22} color={theme.text} />
              </TouchableOpacity>
              
              <View style={[styles.liveBadge, { backgroundColor: theme.surface }]}>
                <View style={styles.pulseDot} />
                <Text style={[styles.liveText, { color: theme.text }]}>Sharing Live</Text>
              </View>

              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: theme.surface }]}
                onPress={centerOnUser}
              >
                <Navigation2 size={22} color={theme.text} style={{ transform: [{ rotate: '45deg' }] }} />
              </TouchableOpacity>
            </View>

            <View style={styles.leftControl}>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: theme.surface }]}
                onPress={() => setShowReachSafely(true)}
              >
                <Shield size={22} color={theme.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.rightControl}>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: theme.surface }]}
                onPress={() => setShowPartnerInfo(true)}
              >
                <Heart size={22} color={theme.primary} fill={theme.primary} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.bottomContainer} pointerEvents="box-none">
            {isTripActive ? (
              <ReachSafelyMode />
            ) : isIntercepting ? (
              <View style={[styles.interceptCard, { backgroundColor: theme.surface }]}>
                <View style={styles.interceptHeader}>
                  <View style={styles.interceptIcon}>
                    <Navigation2 size={20} color={theme.primary} />
                  </View>
                  <View style={styles.interceptTitleContainer}>
                    <Text style={[styles.interceptTitle, { color: theme.text }]}>
                      Locating {currentUserProfile?.partnerNickname || partner?.displayName || 'Partner'}
                    </Text>
                    <Text style={[styles.interceptSubtitle, { color: theme.textLight }]}>
                      Live path updated • Intercepting 🚀
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setIsIntercepting(false)}>
                    <X size={20} color={theme.textLight} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.interceptMetrics}>
                  <View style={styles.metricBox}>
                    <Text style={[styles.metricMain, { color: theme.primary }]}>
                      {distanceToPartner 
                        ? distanceToPartner < 1 
                          ? `${Math.round(distanceToPartner * 1000)} m` 
                          : `${distanceToPartner.toFixed(1)} km` 
                        : '--'}
                    </Text>
                    <Text style={styles.metricSub}>DISTANCE</Text>
                  </View>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <View style={styles.metricBox}>
                    <Text style={[styles.metricMain, { color: '#00C853' }]}>
                      {etaToPartner ? `${Math.round(etaToPartner)} min` : '--'}
                    </Text>
                    <Text style={styles.metricSub}>EST. ARRIVAL</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.stopInterceptBtn, { backgroundColor: theme.border + '50' }]}
                  onPress={() => setIsIntercepting(false)}
                >
                  <Text style={[styles.stopInterceptText, { color: theme.text }]}>Stop Intercept</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.searchBarContainer, { backgroundColor: theme.surface }]}>
                <MapPin size={20} color={theme.primary} />
                <Text style={[styles.searchPlaceholder, { color: theme.textLight }]}>
                  Find my {currentUserProfile?.partnerNickname || partner?.displayName || 'love'}...
                </Text>
                <Search size={20} color={theme.textLight} />
                <TouchableOpacity 
                  style={[styles.goButton, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    setIsIntercepting(true);
                    zoomToPartner();
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                  }}
                >
                  <Navigation2 size={18} color="white" />
                  <Text style={styles.goText}>Go</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      )}

      <ReachSafelyMode visible={showReachSafely} onClose={() => setShowReachSafely(false)} />
      <LocationSettingsModal visible={showSettings} onClose={() => setShowSettings(false)} onOpenSavedPlaces={() => { setShowSettings(false); setShowSavedPlaces(true); }} />
      <SavedPlacesModal 
        visible={showSavedPlaces} 
        onClose={() => setShowSavedPlaces(false)} 
        onSelectOnMap={() => { 
          setShowSavedPlaces(false); 
          setIsSelectingLocation(true);
          // Set initial coords to current map center
          if (userLocation) {
            setSelectedCoords({ 
              latitude: userLocation.coords.latitude, 
              longitude: userLocation.coords.longitude 
            });
          }
        }} 
      />

      {/* CONFIRM LOCATION OVERLAY */}
      {isSelectingLocation && (
        <SafeAreaView style={styles.confirmContainer} pointerEvents="box-none">
          <View style={[styles.confirmCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.confirmTitle, { color: theme.text }]}>Move map to pick location</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity 
                style={[styles.confirmBtn, { backgroundColor: theme.border }]} 
                onPress={() => setIsSelectingLocation(false)}
              >
                <Text style={[styles.confirmBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmBtn, { backgroundColor: theme.primary }]} 
                onPress={() => {
                  if (selectedCoords) {
                    setIsSelectingLocation(false);
                    setShowAddPlaceModal(true);
                  }
                }}
              >
                <Text style={[styles.confirmBtnText, { color: 'white' }]}>Confirm Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      )}

      <AddPlaceModal 
        visible={showAddPlaceModal}
        onClose={() => setShowAddPlaceModal(false)}
        onSave={(name, type) => {
          if (selectedCoords) {
            useLocationStore.getState().addSavedPlace({
              name,
              type: type as any,
              latitude: selectedCoords.latitude,
              longitude: selectedCoords.longitude,
              radius: 200
            });
            // Force sync for Android stability
            locationService.syncSavedPlaces();
          }
        }}
      />
      <PartnerInfoSheet 
        visible={showPartnerInfo} 
        onClose={() => setShowPartnerInfo(false)}
        onNavigate={handleNavigate}
        onChat={() => {
          setShowPartnerInfo(false);
          router.push('/(app)/chat' as any);
        }}
        onLocate={zoomToPartner}
        onPing={handlePing}
        onRefresh={() => {
          setIsRefreshing(true);
          setTimeout(() => setIsRefreshing(false), 1500);
        }}
        partner={partner}
        partnerName={partnerName}
        partnerLocation={partnerLocation}
        distance={distanceToPartner}
        savedPlaces={partnerSavedPlaces || []}
        onFocusPlace={(place) => {
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: Number(place.latitude),
              longitude: Number(place.longitude),
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            });
          }
        }}
        isRefreshing={isRefreshing}
        partnerTrip={partnerTrip}
      />

      <PingAnimation 
        visible={showPingAnim} 
        onComplete={() => setShowPingAnim(false)} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  topContainer: { paddingHorizontal: 20, paddingTop: 10 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', marginRight: 6 },
  liveText: { fontSize: 13, fontWeight: '700' },
  leftControl: { position: 'absolute', top: 70, left: 20 },
  rightControl: { position: 'absolute', top: 70, right: 20 },
  bottomContainer: { paddingHorizontal: 20, paddingBottom: 110 },
  searchBarContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 30, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 10, 
    elevation: 5,
    width: SCREEN_WIDTH * 0.88,
    alignSelf: 'center'
  },
  interceptCard: {
    padding: 16,
    borderRadius: 24,
    width: SCREEN_WIDTH * 0.88,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.05)'
  },
  interceptHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  interceptIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255, 107, 107, 0.1)', justifyContent: 'center', alignItems: 'center' },
  interceptTitleContainer: { flex: 1, marginLeft: 12 },
  interceptTitle: { fontSize: 14, fontWeight: '800' },
  interceptSubtitle: { fontSize: 10, marginTop: 1 },
  interceptMetrics: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.02)', paddingVertical: 12, borderRadius: 16, marginBottom: 15 },
  metricBox: { alignItems: 'center' },
  metricMain: { fontSize: 18, fontWeight: '900' },
  metricSub: { fontSize: 8, fontWeight: '800', opacity: 0.5, marginTop: 2, letterSpacing: 0.5 },
  divider: { width: 1, height: 20, opacity: 0.1 },
  stopInterceptBtn: { height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  stopInterceptText: { fontSize: 12, fontWeight: '700' },
  searchPlaceholder: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600' },
  goButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, marginLeft: 10 },
  goText: { color: 'white', fontWeight: 'bold', marginLeft: 6 },
  emergencyOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
  sosHeader: { alignItems: 'center', marginTop: 20 },
  sosBanner: { backgroundColor: '#FF3B30', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 14, borderRadius: 35, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 15, elevation: 10 },
  sosBannerText: { color: 'white', fontWeight: '900', marginLeft: 12, fontSize: 18, letterSpacing: 0.5 },
  emergencyPanelContainer: { position: 'absolute', bottom: 125, left: 0, right: 0, alignItems: 'center' },
  emergencyPanel: { width: SCREEN_WIDTH * 0.88, backgroundColor: 'rgba(255, 255, 255, 0.98)', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 15, elevation: 10 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B30', marginRight: 10 },
  panelTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  emergencyActions: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between', 
    rowGap: 12,
    marginTop: 10
  },
  emergencyBtn: { 
    width: '48%', 
    height: 64, 
    borderRadius: 22, 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 6,
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 5,
    elevation: 2
  },
  emergencyBtnText: { color: 'white', fontWeight: '900', fontSize: 12, marginTop: 4, textAlign: 'center' },
  confirmContainer: { position: 'absolute', bottom: 120, left: 0, right: 0, alignItems: 'center', pointerEvents: 'box-none' },
  confirmCard: { width: SCREEN_WIDTH * 0.88, padding: 20, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  confirmTitle: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 15 },
  confirmActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  confirmBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { fontWeight: '800', fontSize: 14 }
});
