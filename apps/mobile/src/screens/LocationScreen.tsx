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
  ShieldCheck,
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
import { PingAnimation } from '../components/Location/PingAnimation';
import { AddPlaceModal } from '../components/Location/AddPlaceModal';
import * as Haptics from 'expo-haptics';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { darkMapStyle } from '../theme/darkMapStyle';

const GOOGLE_MAPS_APIKEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS,
  android: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID,
}) || '';
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
    setSirenMuted,
    walkSafe,
    lastCompletedPath,
    lastCompletedTime,
    partnerLastCompletedPath,
    partnerLastCompletedTime,
    incomingPing,
    aiInsight
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
  const [selectedLocationName, setSelectedLocationName] = useState<string | null>(null);
  const bannerPulse = useRef(new Animated.Value(1)).current;
  const partnerName = currentUserProfile?.partnerNickname || partner?.displayName || 'Partner';

  useEffect(() => {
    locationService.startTracking();
    locationService.syncSavedPlaces(); 

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
    if (incomingPing) {
      console.log('💓 Heartbeat visual triggered!');
      setShowPingAnim(false);
      setTimeout(() => setShowPingAnim(true), 50);
    }
  }, [incomingPing]);

  useEffect(() => {
    if (activeSos?.isActive && activeSos.triggeredBy !== user?.uid) {
      zoomToPartner();
      startBannerPulse();
    } else {
      bannerPulse.setValue(1);
    }
  }, [activeSos?.isActive]);

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
          darkMapStyle={darkMapStyle}
          user={user}
          savedPlaces={[
            ...(savedPlaces || []).map(p => ({ 
              ...p, 
              isPartner: false, 
              color: currentUserProfile?.gender === 'Male' ? '#6B66FF' : '#FF6B6B' 
            })),
            ...(partnerSavedPlaces || []).map(p => ({ 
              ...p, 
              isPartner: true, 
              name: `${partnerName}'s ${p.name}`,
              color: partner?.gender === 'Male' ? '#6B66FF' : '#FF6B6B'
            }))
          ]}
          myColor={currentUserProfile?.gender === 'Male' ? '#6B66FF' : '#FF6B6B'}
          partnerColor={partner?.gender === 'Male' ? '#6B66FF' : '#FF6B6B'}
          distanceToPartner={distanceToPartner}
          etaToPartner={etaToPartner}
          onMarkerPress={() => setShowPartnerInfo(true)}
          partnerName={partnerName}
          isSelectingLocation={isSelectingLocation}
          walkSafePath={walkSafe?.path}
          partnerWalkSafePath={partnerWalkSafe?.path}
          lastCompletedPath={
            lastCompletedPath && lastCompletedTime && (Date.now() - lastCompletedTime < 24 * 60 * 60 * 1000)
              ? lastCompletedPath
              : null
          }
          partnerLastCompletedPath={
            partnerLastCompletedPath && partnerLastCompletedTime && (Date.now() - partnerLastCompletedTime < 24 * 60 * 60 * 1000)
              ? partnerLastCompletedPath
              : null
          }
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
            colors={['rgba(0,0,0,0.8)', 'transparent', 'transparent']} 
            style={StyleSheet.absoluteFill} 
            pointerEvents="none"
          />
          <SafeAreaView style={styles.sosHeader}>
            <View style={styles.sosBanner}>
              <ShieldAlert size={24} color="white" strokeWidth={3} />
              <Text style={styles.sosBannerText}>PARTNER SOS ACTIVE</Text>
            </View>
          </SafeAreaView>
          <View style={styles.emergencyPanelContainer}>
            <View style={styles.emergencyPanel}>
              <View style={styles.panelHeader}>
                <View style={styles.statusDot} />
                <Text style={styles.panelTitle}>Emergency Response</Text>
              </View>

              {aiInsight && (
                <View style={[
                  styles.aiInsightBox, 
                  { backgroundColor: aiInsight.riskLevel === 'high' ? 'rgba(255, 59, 48, 0.05)' : 'rgba(0, 122, 255, 0.05)' }
                ]}>
                  <View style={styles.aiHeader}>
                    <Shield size={14} color={aiInsight.riskLevel === 'high' ? '#FF3B30' : '#007AFF'} />
                    <Text style={[
                      styles.aiTitle, 
                      { color: aiInsight.riskLevel === 'high' ? '#FF3B30' : '#007AFF' }
                    ]}>SAFETY GUARD INSIGHT</Text>
                  </View>
                  <Text style={styles.aiSummary}>{aiInsight.summary}</Text>
                  <View style={styles.aiSuggestion}>
                    <Text style={styles.aiSuggestionLabel}>SUGGESTION: </Text>
                    <Text style={styles.aiSuggestionText}>{aiInsight.suggestion}</Text>
                  </View>
                </View>
              )}

              <View style={styles.emergencyActions}>
                <TouchableOpacity 
                  style={[styles.emergencyBtn, { backgroundColor: '#FF3B30' }]} 
                  onPress={() => Linking.openURL('tel:112')}
                  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
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
                  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                  <Phone size={20} color="white" />
                  <Text style={styles.emergencyBtnText} numberOfLines={1}>Call Partner</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.emergencyBtn, { backgroundColor: '#007AFF' }]} 
                  onPress={handleNavigate}
                  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
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
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
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
                hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
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
                hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
              >
                <Navigation2 size={22} color={theme.text} style={{ transform: [{ rotate: '45deg' }] }} />
              </TouchableOpacity>
            </View>

            <View style={styles.leftControl}>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: theme.surface }]}
                onPress={() => setShowReachSafely(true)}
                hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
              >
                <Shield size={22} color={theme.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.rightControl}>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: theme.surface }]}
                onPress={() => setShowPartnerInfo(true)}
                hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
              >
                <Heart size={22} color="#FF6B6B" fill="#FF6B6B" />
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
                      Locating {partnerName}
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
                  style={[styles.actionBtn, { backgroundColor: theme.border + '50' }]}
                  onPress={() => setIsIntercepting(false)}
                >
                  <Text style={[styles.actionBtnText, { color: theme.text }]}>Stop Intercept</Text>
                </TouchableOpacity>
              </View>
            ) : partnerWalkSafe?.isActive ? (
              <View style={[styles.statusCard, { backgroundColor: theme.surface }]}>
                <View style={styles.statusHeader}>
                  <View style={[styles.statusIcon, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
                    <Shield size={20} color="#34C759" />
                  </View>
                  <View style={styles.statusInfo}>
                    <Text style={[styles.statusTitle, { color: theme.text }]}>
                      {partnerName} is on a trip
                    </Text>
                    <Text style={[styles.statusSubtitle, { color: theme.textLight }]}>
                      Heading to {partnerWalkSafe.destinationName}
                    </Text>
                  </View>
                  <View style={styles.timeBadge}>
                    <Clock size={12} color={theme.primary} />
                    <Text style={[styles.timeText, { color: theme.primary }]}>
                      {partnerWalkSafe.deadline ? Math.max(0, Math.round((partnerWalkSafe.deadline - Date.now()) / 60000)) : 0} min
                    </Text>
                  </View>
                </View>
                
                <View style={[styles.progressBarContainer, { backgroundColor: theme.border + '30' }]}>
                  <View style={[styles.progressBar, { 
                    backgroundColor: '#34C759', 
                    width: `${Math.min(100, Math.max(10, 100 - ((partnerWalkSafe.lastCheckDistance || 0) / 5000) * 100))}%` 
                  }]} />
                </View>

                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    setIsIntercepting(true);
                    zoomToPartner();
                  }}
                >
                  <Navigation2 size={16} color="white" />
                  <Text style={styles.actionBtnText}>Intercept {partnerName}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.statusCard, { backgroundColor: theme.surface }]}>
                <View style={styles.statusHeader}>
                  <View style={[styles.statusIcon, { backgroundColor: 'rgba(107, 102, 255, 0.1)' }]}>
                    <ShieldCheck size={20} color={theme.primary} />
                  </View>
                  <View style={styles.statusInfo}>
                    <Text style={[styles.statusTitle, { color: theme.text }]}>
                      {partnerName} is safe
                    </Text>
                    <Text style={[styles.statusSubtitle, { color: theme.textLight }]}>
                      Last seen {new Date(partnerLocation?.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  {partnerLocation?.batteryLevel !== undefined && (
                    <View style={styles.batteryInfo}>
                      <Text style={[styles.batteryText, { 
                        color: partnerLocation.batteryLevel < 20 ? '#FF3B30' : theme.textLight 
                      }]}>
                        {partnerLocation.batteryLevel}%
                      </Text>
                      <View style={[styles.batteryIcon, { 
                        borderColor: theme.textLight,
                        backgroundColor: partnerLocation.batteryLevel < 20 ? '#FF3B30' : '#34C759'
                      }]} />
                    </View>
                  )}
                </View>

                {selectedCoords ? (
                  <View style={styles.tripActionContainer}>
                    <TouchableOpacity 
                      style={[styles.startTripBtn, { backgroundColor: theme.primary }]}
                      onPress={() => {
                        locationService.startWalkSafe(
                          selectedLocationName || 'Selected Destination',
                          selectedCoords.latitude,
                          selectedCoords.longitude
                        );
                        setSelectedCoords(null);
                        setSelectedLocationName(null);
                      }}
                    >
                      <Shield size={18} color="white" />
                      <Text style={styles.startTripText}>Start Walk Safe to {selectedLocationName || 'Destination'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.cancelTripBtn, { backgroundColor: theme.border + '50' }]}
                      onPress={() => {
                        setSelectedCoords(null);
                        setSelectedLocationName(null);
                      }}
                    >
                      <X size={18} color={theme.textLight} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.tripActionContainer}>
                    <TouchableOpacity 
                      style={[styles.startTripBtn, { backgroundColor: theme.primary }]}
                      onPress={() => setShowSettings(true)}
                    >
                      <Navigation2 size={18} color="white" />
                      <Text style={styles.startTripText}>Start a new trip</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
          <View style={styles.searchOverlay}>
            <GooglePlacesAutocomplete
              placeholder="Search for a place..."
              onPress={(data, details = null) => {
                if (details && mapRef.current) {
                  const { lat, lng } = details.geometry.location;
                  setSelectedCoords({ latitude: lat, longitude: lng });
                  setSelectedLocationName(data.description.split(',')[0]);
                  setIsSelectingLocation(false);
                  mapRef.current.animateToRegion({
                    latitude: lat,
                    longitude: lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }, 1000);
                }
              }}
              fetchDetails={true}
              renderRightButton={() => (
                <TouchableOpacity 
                  style={[styles.searchBtn, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    // Logic to trigger search if needed, but Autocomplete handles it
                    // This button is mostly for visual cue / explicit confirmation
                  }}
                >
                  <Search size={18} color="white" />
                </TouchableOpacity>
              )}
              query={{
                key: GOOGLE_MAPS_APIKEY,
                language: 'en',
                types: 'geocode', // Better for finding addresses/cities
              }}
              styles={{
                container: { flex: 0, width: '100%' },
                textInputContainer: {
                  flexDirection: 'row',
                  alignItems: 'center',
                },
                textInput: {
                  height: 50,
                  backgroundColor: theme.surface,
                  borderRadius: 15,
                  paddingHorizontal: 15,
                  fontSize: 16,
                  color: theme.text,
                  flex: 1,
                  ...theme.shadows.soft,
                },
                listView: {
                  backgroundColor: theme.surface,
                  borderRadius: 15,
                  marginTop: 5,
                  ...theme.shadows.medium,
                  zIndex: 1000,
                },
                row: {
                  padding: 13,
                  height: 48,
                  flexDirection: 'row',
                },
                separator: {
                  height: 1,
                  backgroundColor: theme.border,
                },
                description: {
                  color: theme.text,
                },
              }}
              enablePoweredByContainer={false}
              nearbyPlacesAPI="GooglePlacesSearch"
              debounce={400}
            />
          </View>

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
          if (coupleId) {
            router.push(`/(app)/chat/${coupleId}` as any);
          } else {
            Alert.alert('Not Paired', 'You need to be paired with a partner to open the chat.');
          }
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
    padding: 20,
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
  statusCard: {
    padding: 16,
    borderRadius: 24,
    width: SCREEN_WIDTH * 0.9,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
    marginLeft: 12,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  statusSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 5,
  },
  batteryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batteryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  batteryIcon: {
    width: 14,
    height: 8,
    borderRadius: 1,
    borderWidth: 1,
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  actionBtn: {
    height: 44,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
  },
  searchBarLink: {
    height: 44,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  searchLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tripActionContainer: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  startTripBtn: {
    flex: 1,
    height: 44,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startTripText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelTripBtn: {
    width: 44,
    height: 44,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  aiInsightBox: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginLeft: 6,
  },
  aiSummary: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
    fontWeight: '600',
  },
  aiSuggestion: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  aiSuggestionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#666',
  },
  aiSuggestionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
  },
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
  confirmContainer: { position: 'absolute', top: 60, bottom: 0, left: 0, right: 0, alignItems: 'center', pointerEvents: 'box-none' },
  searchOverlay: {
    width: SCREEN_WIDTH * 0.88,
    zIndex: 2000,
    marginBottom: 20,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  confirmCard: { position: 'absolute', bottom: 120, width: SCREEN_WIDTH * 0.88, padding: 20, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  confirmTitle: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 15 },
  confirmActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  confirmBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { fontWeight: '800', fontSize: 14 }
});
