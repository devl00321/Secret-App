import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Platform, Linking, TextInput, FlatList, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Header } from '../components/Header';
import { Settings, Navigation2, MapPin, Heart, Battery, Info, Search, Loader2 } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useLocationStore } from '../store/useLocationStore';
import { locationService } from '../services/locationService';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { HeartMarker } from '../components/Location/HeartMarker';
import { LocationSettingsModal } from '../components/Location/LocationSettingsModal';
import { ReachSafelyMode } from '../components/Location/ReachSafelyMode';
import { useAuthStore } from '../store/useAuthStore';
import { MapComponent } from '../components/Location/MapComponent';
import { SavedPlacesModal } from '../components/Location/SavedPlacesModal';
import { PartnerInfoSheet } from '../components/Location/PartnerInfoSheet';
import { useRouter } from 'expo-router';

// Configure notifications
// Configure notifications (Guard for Expo Go SDK 53+)
if (Platform.OS !== 'web' && Constants.appOwnership !== 'expo') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// REPLACE WITH YOUR GOOGLE MAPS API KEY IN .env FILE
const GOOGLE_MAPS_APIKEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export const LocationScreen = () => {
  const theme = useTheme();
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const { user, partner } = useAuthStore();
  
  // Use individual selectors to prevent unnecessary re-renders when other state changes
  const userLocation = useLocationStore(state => state.userLocation);
  const partnerLocation = useLocationStore(state => state.partnerLocation);
  const isSharing = useLocationStore(state => state.isSharing);
  const isTripActive = useLocationStore(state => state.isTripActive);
  const destination = useLocationStore(state => state.destination);
  const distanceToPartner = useLocationStore(state => state.distanceToPartner);
  const etaToPartner = useLocationStore(state => state.etaToPartner);
  const updateMetrics = useLocationStore(state => state.updateMetrics);
  const setTripActive = useLocationStore(state => state.setTripActive);
  const savedPlaces = useLocationStore(state => state.savedPlaces);
  const partnerSavedPlaces = useLocationStore(state => state.partnerSavedPlaces);

  const [showSettings, setShowSettings] = useState(false);
  const [showSavedPlaces, setShowSavedPlaces] = useState(false);
  const [showPartnerInfo, setShowPartnerInfo] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<{ foreground: boolean; background: boolean } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPingToast, setShowPingToast] = useState(false);
  const toastAnim = useRef(new Animated.Value(-100)).current;

  const setupLocation = async () => {
    try {
      const status = await locationService.requestPermissions();
      setPermissionStatus(status);
      
      if (status.foreground) {
        await locationService.startTracking();
      }
      
      if (partner?.id) {
        locationService.subscribeToPartner(partner.id);
      }
    } catch (err) {
      console.warn('Location setup failed:', err);
    }
  };

  useEffect(() => {
    setupLocation();
    
    return () => {
      locationService.stopTracking();
    };
  }, [partner?.id]);

  // Sync saved places whenever they change
  useEffect(() => {
    locationService.syncSavedPlaces();
  }, [savedPlaces]);

  // Listen for incoming pings from partner
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = locationService.subscribeToIncomingPings(user.uid, (ping) => {
      // Trigger "Extended Heartbeat" haptics: 15 seconds of rhythmic pulses
      if (Platform.OS !== 'web') {
        let count = 0;
        const maxCycles = 15; // roughly 15-18 seconds total
        
        const triggerHeartbeat = () => {
          if (count >= maxCycles) return;
          
          // First thump
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          
          // Second thump after 150ms
          setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            count++;
            
            // Next cycle after 1 second pause
            setTimeout(triggerHeartbeat, 1000);
          }, 150);
        };
        
        triggerHeartbeat();
      }
      
      // Show in-app Ping Toast
      setShowPingToast(true);
      Animated.sequence([
        Animated.spring(toastAnim, { toValue: 60, useNativeDriver: true }),
        Animated.delay(15000), // Match haptic duration
        Animated.timing(toastAnim, { toValue: -100, duration: 300, useNativeDriver: true })
      ]).start(() => setShowPingToast(false));
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Auto-center on user when location is first found
  useEffect(() => {
    if (userLocation && mapReady && !partnerLocation) {
      mapRef.current?.animateToRegion?.({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  }, [!!userLocation, mapReady]);

  // Handle navigation zoom
  useEffect(() => {
    if (isNavigating && userLocation && partnerLocation && mapReady) {
      mapRef.current?.fitToCoordinates?.([
        { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
        { latitude: partnerLocation.latitude, longitude: partnerLocation.longitude }
      ], {
        edgePadding: { top: 150, right: 50, bottom: 450, left: 50 },
        animated: true,
      });
    }
  }, [isNavigating, !!userLocation, !!partnerLocation, mapReady]);

  const centerMap = () => {
    if (!mapReady) return;

    if (userLocation && partnerLocation) {
      // Fit both if both available
      mapRef.current?.fitToCoordinates?.([
        { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
        { latitude: partnerLocation.latitude, longitude: partnerLocation.longitude }
      ], {
        edgePadding: { top: 100, right: 50, bottom: 450, left: 50 },
        animated: true,
      });
    } else if (userLocation) {
      // Center on user if only user available
      mapRef.current?.animateToRegion?.({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
    
    if (isNavigating) setIsNavigating(false); // Stop nav if user manually centers
  };

  const openInGoogleMaps = () => {
    if (!partnerLocation) return;
    const url = Platform.select({
      ios: `maps://app?daddr=${partnerLocation.latitude},${partnerLocation.longitude}`,
      android: `google.navigation:q=${partnerLocation.latitude},${partnerLocation.longitude}`,
    });
    if (url) Linking.openURL(url);
  };

  const getEmotionalStatus = () => {
    if (!partnerLocation) return "Find my love... 🔍";
    if (!distanceToPartner) return "Calculating distance... ⏳";
    if (distanceToPartner < 0.1) return "You both are nearby! 💓";
    if (distanceToPartner < 1) return "She's just a few steps away 💞";
    return `She is ${distanceToPartner.toFixed(1)} km away 💙`;
  };

  // Helper to calculate distance in km
  const searchLocation = async (query: string) => {
    setSearchQuery(query);
    if (!query || query.length < 3) {
      setSearchSuggestions([]);
      return;
    }

    try {
      setIsSearching(true);
      // Use expo-location geocoding as a more reliable fallback/primary search
      const results = await locationService.geocode(query);
      if (results && results.length > 0) {
        // Map native results to a common format
        const suggestions = results.slice(0, 5).map((res, index) => ({
          place_id: `native-${index}-${res.latitude}-${res.longitude}`,
          description: `${query} (${res.city || res.region || 'Result'})`,
          coords: {
            latitude: res.latitude,
            longitude: res.longitude
          }
        }));
        setSearchSuggestions(suggestions);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate a data fetch from Firebase
    await new Promise(resolve => setTimeout(resolve, 1500));
    await setupLocation();
    setIsRefreshing(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleFocusPlace = (place: any) => {
    if (place.latitude && place.longitude) {
      mapRef.current?.animateToRegion({
        latitude: Number(place.latitude),
        longitude: Number(place.longitude),
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
      setShowPartnerInfo(false);
    }
  };

  const goToPlace = async (place: any) => {
    try {
      const coords = place.coords;
      if (coords) {
        mapRef.current?.animateToRegion({
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 1000);
        setSearchSuggestions([]);
        setSearchQuery('');
      }
    } catch (error) {
      console.error('Jump error:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const sendArrivalNotification = async (placeName: string) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Reached ${placeName}! 🏠`,
        body: `We've notified ${partner?.displayName || 'your partner'} that you reached ${placeName} safely.`,
      },
      trigger: null,
    });
    // In a real app, you would also trigger a Firestore update that sends a push to the partner
  };

  // Live distance update effect
  useEffect(() => {
    if (userLocation && partnerLocation) {
      const dist = calculateDistance(
        userLocation.coords.latitude,
        userLocation.coords.longitude,
        partnerLocation.latitude,
        partnerLocation.longitude
      );
      
      // If we don't have route ETA, estimate based on 30km/h avg speed
      const estimatedEta = etaToPartner || (dist / 30) * 60;
      updateMetrics(dist, estimatedEta);

      // Smart Geofencing: If trip is active and we are near destination
      if (isTripActive && destination) {
        const distToDest = calculateDistance(
          userLocation.coords.latitude,
          userLocation.coords.longitude,
          destination.latitude,
          destination.longitude
        );

        if (distToDest < 0.15) { // 150 meters (matching default radius)
          setTripActive(false);
          sendArrivalNotification(destination.name || 'your destination');
        }
      }
    }
  }, [
    userLocation?.coords.latitude, 
    userLocation?.coords.longitude, 
    partnerLocation?.latitude, 
    partnerLocation?.longitude,
    isTripActive,
    destination?.name
  ]);

  const handleRegionChangeComplete = React.useCallback((region: any) => {
    if (isSelectingLocation && region) {
      setSelectedLocation({
        latitude: region.latitude,
        longitude: region.longitude
      });
    }
  }, [isSelectingLocation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.map}>
        <MapComponent
          mapRef={mapRef}
          userLocation={userLocation}
          partnerLocation={partnerLocation}
          destination={destination}
          GOOGLE_MAPS_APIKEY={GOOGLE_MAPS_APIKEY}
          onMapReady={() => setMapReady(true)}
          updateMetrics={updateMetrics}
          theme={theme}
          darkMapStyle={darkMapStyle}
          user={user}
          savedPlaces={savedPlaces || []}
          distanceToPartner={distanceToPartner}
          etaToPartner={etaToPartner}
          isSelectingLocation={isSelectingLocation}
          onRegionChangeComplete={handleRegionChangeComplete}
          onMarkerPress={() => setShowPartnerInfo(true)}
        />
      </View>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topContainer}>
          <View style={styles.topBar}>
            {isNavigating ? (
              <View style={[styles.navHeader, { backgroundColor: theme.surface }]}>
                <View style={[styles.navIconCircle, { backgroundColor: theme.primary }]}>
                  <Navigation2 size={20} color="white" />
                </View>
                <View style={styles.navHeaderTextContainer}>
                  <Text style={[styles.navHeaderTitle, { color: theme.text }]}>Navigating to Partner</Text>
                  <Text style={[styles.navHeaderSubtitle, { color: theme.textLight }]}>
                    {distanceToPartner?.toFixed(1)} km • {Math.round(etaToPartner || 0)} min remaining
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.navCloseButton}
                  onPress={() => setIsNavigating(false)}
                >
                  <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity 
                  style={[styles.iconButton, { backgroundColor: theme.surface }]}
                  onPress={() => setShowSettings(true)}
                >
                  <Settings size={22} color={theme.text} />
                </TouchableOpacity>
                
                <View style={[styles.statusBadge, { backgroundColor: theme.surface }]}>
                  <View style={[styles.pulseDot, { backgroundColor: isSharing ? theme.primary : theme.textLight }]} />
                  <Text style={[styles.statusText, { color: theme.text }]}>
                    {isSharing ? 'Sharing Live' : 'Location Hidden'}
                  </Text>
                </View>

                <TouchableOpacity 
                  style={[styles.iconButton, { backgroundColor: theme.surface }]}
                  onPress={centerMap}
                >
                  <Navigation2 size={22} color={theme.text} />
                </TouchableOpacity>
              </>
            )}
          </View>
          
          {isSelectingLocation && (
            <View style={[styles.selectionBanner, { backgroundColor: theme.surface }]}>
              <View style={styles.searchBar}>
                <Search size={18} color={theme.textLight} />
                <TextInput
                  placeholder="Search city or area..."
                  placeholderTextColor={theme.textLight}
                  style={[styles.searchInput, { color: theme.text }]}
                  value={searchQuery}
                  onChangeText={searchLocation}
                />
                {isSearching && <ActivityIndicator size="small" color={theme.primary} />}
              </View>

              {searchSuggestions.length > 0 && (
                <View style={[styles.suggestionsList, { backgroundColor: theme.surface }]}>
                  {searchSuggestions.map((item) => (
                    <TouchableOpacity 
                      key={item.place_id} 
                      style={styles.suggestionItem}
                      onPress={() => goToPlace(item)}
                    >
                      <MapPin size={16} color={theme.textLight} />
                      <Text style={[styles.suggestionText, { color: theme.text }]} numberOfLines={1}>
                        {item.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.selectionInfo}>
                <MapPin size={20} color={theme.primary} />
                <Text style={[styles.selectionText, { color: theme.text }]}>
                  {searchQuery ? 'Found results!' : 'Drag map to set location'}
                </Text>
              </View>
              <View style={styles.selectionButtons}>
                <TouchableOpacity 
                  style={[styles.cancelSelectBtn, { backgroundColor: theme.border }]}
                  onPress={() => {
                    setIsSelectingLocation(false);
                    setShowSavedPlaces(true);
                  }}
                >
                  <Text style={{ color: theme.text }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.confirmSelectBtn, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    setIsSelectingLocation(false);
                    setShowSavedPlaces(true);
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </View>

        <View style={styles.bottomSheet}>
          <ReachSafelyMode />
          
          {!isNavigating && (
            <View style={[styles.floatingInfoCard, { backgroundColor: theme.surface }]}>
              <View style={styles.infoRow}>
                <View style={styles.partnerInfo}>
                  <View style={[styles.avatarCircle, { backgroundColor: theme.primary + '15' }]}>
                    <Heart size={18} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.emotionalText, { color: theme.text }]} numberOfLines={1}>
                      {getEmotionalStatus()}
                    </Text>
                    {etaToPartner !== null && etaToPartner !== undefined && (
                      <Text style={[styles.etaText, { color: theme.textLight }]}>
                        ETA: {Math.round(etaToPartner)} mins
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity 
                  style={[styles.navButton, { backgroundColor: isNavigating ? theme.textLight : theme.primary }]}
                  onPress={() => setIsNavigating(!isNavigating)}
                  activeOpacity={0.8}
                >
                  <Navigation2 size={14} color="white" style={{ marginRight: 4 }} />
                  <Text style={styles.navButtonText}>{isNavigating ? 'Stop' : 'Go'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Spacer for Tab Bar */}
          <View style={{ height: 110 }} />
        </View>
      </SafeAreaView>

      {/* Real-time Ping Toast */}
      {showPingToast && (
        <Animated.View 
          style={[
            styles.pingToast, 
            { 
              backgroundColor: theme.primary,
              transform: [{ translateY: toastAnim }] 
            }
          ]}
        >
          <Heart color="white" size={20} fill="white" />
          <Text style={styles.pingToastText}>Received a heartbeat! ❤️</Text>
        </Animated.View>
      )}

      <LocationSettingsModal 
        visible={showSettings} 
        onClose={() => setShowSettings(false)} 
        onOpenSavedPlaces={() => {
          setShowSettings(false);
          // Small delay to allow previous modal to close properly
          setTimeout(() => setShowSavedPlaces(true), 100);
        }}
      />

      <SavedPlacesModal 
        visible={showSavedPlaces} 
        onClose={() => {
          setShowSavedPlaces(false);
          setSelectedLocation(null);
        }}
        onSelectOnMap={() => {
          setShowSavedPlaces(false);
          setIsSelectingLocation(true);
        }}
        initialLocation={selectedLocation}
      />

      <PartnerInfoSheet 
        visible={showPartnerInfo} 
        onClose={() => setShowPartnerInfo(false)} 
        partner={partner}
        partnerLocation={partnerLocation}
        distance={distanceToPartner}
        savedPlaces={partnerSavedPlaces || []}
        onNavigate={openInGoogleMaps}
        onChat={() => {
          setShowPartnerInfo(false);
          router.push('/(tabs)/chat');
        }}
        onLocate={() => {
          if (partnerLocation) {
            mapRef.current?.animateToRegion({
              latitude: partnerLocation.latitude,
              longitude: partnerLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 1000);
            setShowPartnerInfo(false);
          }
        }}
        onPing={() => {
          if (partner?.id) {
            locationService.sendPing(partner.id);
          }
        }}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onFocusPlace={handleFocusPlace}
      />

      {permissionStatus && !permissionStatus.foreground && (
        <View style={[StyleSheet.absoluteFill, styles.permissionOverlay, { backgroundColor: theme.background }]}>
          <MapPin size={60} color={theme.primary} style={{ marginBottom: 20 }} />
          <Text style={[styles.permissionTitle, { color: theme.text }]}>Location Access Required 💙</Text>
          <Text style={[styles.permissionDesc, { color: theme.textLight }]}>
            To keep you and your partner safe, we need access to your location while you're using the app.
          </Text>
          <TouchableOpacity 
            style={[styles.permissionButton, { backgroundColor: theme.primary }]}
            onPress={setupLocation}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ marginTop: 20 }}
            onPress={() => Linking.openSettings()}
          >
            <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#212121" }]
  },
  {
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#757575" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#212121" }]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [{ "color": "#757575" }]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [{ "color": "#181818" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry.fill",
    "stylers": [{ "color": "#2c2c2c" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#000000" }]
  }
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 20,
  },
  topContainer: {
    width: '100%',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  floatingInfoCard: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginHorizontal: 20,
    marginBottom: 10,
  },
  iconButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  bottomSheet: {
    width: '100%',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  emotionalText: {
    fontSize: 14,
    fontWeight: '800',
  },
  etaText: {
    fontSize: 12,
    marginTop: 4,
  },
  navButton: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pingToast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 10000,
  },
  pingToastText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 10,
    fontSize: 15,
  },
  navButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  permissionOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    zIndex: 1000,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  permissionDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  permissionButton: {
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  navIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navHeaderTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  navHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  navHeaderSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  navCloseButton: {
    paddingHorizontal: 12,
  },
  selectionBanner: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  selectionText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  selectionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelSelectBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginRight: 10,
  },
  confirmSelectBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 45,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
  },
  suggestionsList: {
    maxHeight: 200,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  suggestionText: {
    marginLeft: 10,
    fontSize: 14,
  },
});
