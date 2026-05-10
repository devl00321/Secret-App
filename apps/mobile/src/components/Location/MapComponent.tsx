import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { HeartMarker } from './HeartMarker';
import { useTheme } from '../../theme';
import { 
  Home, 
  Briefcase, 
  BookOpen, 
  School, 
  GraduationCap, 
  Building2, 
  Dumbbell, 
  MapPin 
} from 'lucide-react-native';

interface MapComponentProps {
  mapRef: React.RefObject<any>;
  userLocation: any;
  partnerLocation: any;
  destination: any;
  GOOGLE_MAPS_APIKEY: string;
  onMapReady: () => void;
  updateMetrics: (dist: number, dur: number) => void;
  theme: any;
  darkMapStyle: any;
  user: any;
  savedPlaces: any[];
  distanceToPartner: number | null;
  etaToPartner: number | null;
  isSelectingLocation?: boolean;
  onRegionChangeComplete?: (region: any) => void;
  onMarkerPress?: () => void;
  partnerName?: string;
  myColor?: string;
  partnerColor?: string;
  walkSafePath?: { latitude: number; longitude: number }[];
  partnerWalkSafePath?: { latitude: number; longitude: number }[];
  lastCompletedPath?: { latitude: number; longitude: number }[] | null;
  partnerLastCompletedPath?: { latitude: number; longitude: number }[] | null;
}

const getPlaceIcon = (type: string, color: string) => {
  const size = 18;
  switch (type) {
    case 'home': return <Home size={size} color={color} />;
    case 'office': return <Briefcase size={size} color={color} />;
    case 'tuition': return <BookOpen size={size} color={color} />;
    case 'school': return <School size={size} color={color} />;
    case 'college': return <GraduationCap size={size} color={color} />;
    case 'hostel': return <Building2 size={size} color={color} />;
    case 'gym': return <Dumbbell size={size} color={color} />;
    default: return <MapPin size={size} color={color} />;
  }
};

export const MapComponent = React.memo(({
  mapRef,
  userLocation,
  partnerLocation,
  destination,
  GOOGLE_MAPS_APIKEY,
  onMapReady,
  updateMetrics,
  theme,
  darkMapStyle,
  user,
  savedPlaces,
  distanceToPartner,
  etaToPartner,
  isSelectingLocation,
  onRegionChangeComplete,
  onMarkerPress,
  partnerName,
  myColor,
  partnerColor,
  walkSafePath,
  partnerWalkSafePath,
  lastCompletedPath,
  partnerLastCompletedPath
}: MapComponentProps) => {
  const [shouldTrack, setShouldTrack] = React.useState(true);

  React.useEffect(() => {
    if (Platform.OS === 'android') {
      const timer = setTimeout(() => setShouldTrack(false), 4000);
      return () => clearTimeout(timer);
    } else {
      setShouldTrack(false);
    }
  }, []);

  // Helper to safely get coordinates from flattened or nested userLocation
  const getCoords = (loc: any) => {
    if (!loc) return null;
    return {
      latitude: loc.latitude ?? loc.coords?.latitude,
      longitude: loc.longitude ?? loc.coords?.longitude,
    };
  };

  const userCoords = getCoords(userLocation);
  const partnerCoords = partnerLocation ? { latitude: partnerLocation.latitude, longitude: partnerLocation.longitude } : null;

  const validSavedPlaces = savedPlaces?.filter(p => p && p.latitude && p.longitude) || [];

  return (
    <View style={styles.flex}>
      <MapView
        ref={mapRef}
        style={styles.flex}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        onMapReady={onMapReady}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={true}
        showsMyLocationButton={false}
        userInterfaceStyle={theme.isDark ? 'dark' : 'light'}
        customMapStyle={theme.isDark ? darkMapStyle : []}
        initialRegion={{
          latitude: partnerCoords?.latitude || userCoords?.latitude || 17.3850,
          longitude: partnerCoords?.longitude || userCoords?.longitude || 78.4867,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* PASS 1: Circles (Background layer) */}
        {validSavedPlaces.map((place) => (
          <Circle
            key={`circle-${place.id}`}
            center={{
              latitude: Number(place.latitude),
              longitude: Number(place.longitude),
            }}
            radius={Number(place.radius || 200)}
            strokeColor={(place.color || (place.isPartner ? theme.secondary : theme.primary)) + '80'}
            fillColor={(place.color || (place.isPartner ? theme.secondary : theme.primary)) + '20'}
            zIndex={1}
            strokeWidth={1}
          />
        ))}

        {/* Only render markers if coordinates are valid to prevent Native Crashes */}
        {userCoords && userCoords.latitude && (
          <Marker
            key={`me-${shouldTrack ? 'tracking' : 'static'}`}
            coordinate={userCoords}
            title="Me"
            tracksViewChanges={shouldTrack}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={10}
          >
            <HeartMarker type="me" initial={user?.displayName?.[0] || 'M'} color={myColor} />
          </Marker>
        )}

        {partnerCoords && partnerCoords.latitude && (
          <Marker
            key={`partner-${shouldTrack ? 'tracking' : 'static'}`}
            coordinate={partnerCoords}
            title="Partner"
            tracksViewChanges={shouldTrack}
            anchor={{ x: 0.5, y: 1 }}
            onPress={onMarkerPress}
            zIndex={10}
          >
            <HeartMarker 
              type="partner" 
              initial={(partnerName || 'P')[0].toUpperCase()} 
              batteryLevel={partnerLocation?.batteryLevel}
              color={partnerColor}
            />
          </Marker>
        )}

        {/* GOLDEN BREADCRUMBS (Trace of last completed path) */}
        {lastCompletedPath && lastCompletedPath.length > 1 && (
          <Polyline
            coordinates={lastCompletedPath}
            strokeColor="#D4AF37" // Metallic Gold
            strokeWidth={5}
            lineDashPattern={[2, 12]} // Breadcrumb effect
            geodesic={true}
            zIndex={2}
          />
        )}

        {/* PARTNER GOLDEN BREADCRUMBS */}
        {partnerLastCompletedPath && partnerLastCompletedPath.length > 1 && (
          <Polyline
            coordinates={partnerLastCompletedPath}
            strokeColor="#D4AF37" // Metallic Gold
            strokeWidth={5}
            lineDashPattern={[2, 12]} // Breadcrumb effect
            geodesic={true}
            zIndex={2}
          />
        )}

        {/* LIVE PATH TRACKING (Breadcrumbs) */}
        {walkSafePath && walkSafePath.length > 0 && (
          <>
            {/* Start Point Marker */}
            <Circle
              center={walkSafePath[0]}
              radius={10}
              fillColor={myColor || theme.primary}
              strokeColor="white"
              strokeWidth={2}
              zIndex={4}
            />
            {walkSafePath.length > 1 && (
              <Polyline
                coordinates={walkSafePath}
                strokeColor={myColor || theme.primary}
                strokeWidth={6}
                geodesic={true}
                zIndex={3}
              />
            )}
          </>
        )}

        {partnerWalkSafePath && partnerWalkSafePath.length > 0 && (
          <>
            {/* Partner Start Point Marker */}
            <Circle
              center={partnerWalkSafePath[0]}
              radius={10}
              fillColor={partnerColor || theme.secondary}
              strokeColor="white"
              strokeWidth={2}
              zIndex={4}
            />
            {partnerWalkSafePath.length > 1 && (
              <Polyline
                coordinates={partnerWalkSafePath}
                strokeColor={partnerColor || theme.secondary}
                strokeWidth={6}
                geodesic={true}
                zIndex={3}
              />
            )}
          </>
        )}

        {userCoords && partnerCoords && GOOGLE_MAPS_APIKEY && GOOGLE_MAPS_APIKEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE' && !walkSafePath && (
          <MapViewDirections
            origin={userCoords}
            destination={partnerCoords}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4}
            strokeColor={theme.primary}
            lineDashPattern={[0]}
            onReady={result => {
              const distDiff = Math.abs((distanceToPartner || 0) - result.distance);
              const etaDiff = Math.abs((etaToPartner || 0) - result.duration);
              if (distDiff > 0.05 || etaDiff > 1 || distanceToPartner === null) {
                updateMetrics(result.distance, result.duration);
              }
            }}
          />
        )}

        {/* REACH SAFELY ROUTE (Remaining Path for User) */}
        {userCoords && destination && GOOGLE_MAPS_APIKEY && GOOGLE_MAPS_APIKEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE' && (
          <MapViewDirections
            origin={userCoords}
            destination={{ latitude: destination.latitude, longitude: destination.longitude }}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={5}
            strokeColor={myColor || theme.primary}
            mode="WALKING"
            optimizeWaypoints={true}
            precision="high"
          />
        )}

        {/* REACH SAFELY ROUTE (Remaining Path for Partner) */}
        {partnerCoords && partnerWalkSafePath && GOOGLE_MAPS_APIKEY && GOOGLE_MAPS_APIKEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE' && (
          <MapViewDirections
            origin={partnerCoords}
            destination={partnerWalkSafePath[partnerWalkSafePath.length - 1]} // Assuming end of path is destination or we can pass destination directly if available
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={5}
            strokeColor={partnerColor || theme.secondary}
            mode="WALKING"
            precision="high"
          />
        )}

        {/* PASS 2: Place Markers (Top layer) */}
        {validSavedPlaces.map((place) => (
          <Marker
            key={`place-${place.id}-${shouldTrack ? 'tracking' : 'static'}`}
            coordinate={{
              latitude: Number(place.latitude),
              longitude: Number(place.longitude),
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={shouldTrack}
            zIndex={20}
          >
            <View style={styles.placeMarker}>
              <View style={[styles.placeTag, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.placeText, { color: theme.text }]} numberOfLines={1}>
                  {place.name}
                </Text>
              </View>
              <View style={[styles.placeIcon, { backgroundColor: theme.surface, borderColor: place.color || (place.isPartner ? theme.secondary : theme.primary) }]}>
                {getPlaceIcon(place.type, place.color || (place.isPartner ? theme.secondary : theme.primary))}
              </View>
            </View>
          </Marker>
        ))}
      </MapView>

      {isSelectingLocation && (
        <View style={styles.selectorContainer}>
          <MapPin size={40} color={theme.primary} />
          <View style={[styles.selectorDot, { backgroundColor: theme.primary }]} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  placeMarker: { 
    alignItems: 'center',
    width: 120, // Explicit width for Android stability
    height: 80, // Explicit height for Android stability
    justifyContent: 'flex-end',
  },
  placeTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1.5,
    maxWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  placeText: { 
    fontSize: 10, 
    fontWeight: '900', 
    textTransform: 'uppercase'
  },
  placeIcon: { 
    padding: 6, 
    borderRadius: 20, 
    borderWidth: 2, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectorContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none'
  },
  selectorDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    marginTop: -3,
    borderWidth: 1,
    borderColor: 'white'
  }
});
