import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
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
  partnerName
}: MapComponentProps) => {
  const [shouldTrack, setShouldTrack] = React.useState(true);

  React.useEffect(() => {
    if (Platform.OS === 'android') {
      const timer = setTimeout(() => setShouldTrack(false), 2000);
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
        customMapStyle={theme.isDark ? darkMapStyle : []}
        initialRegion={{
          latitude: partnerCoords?.latitude || userCoords?.latitude || 17.3850,
          longitude: partnerCoords?.longitude || userCoords?.longitude || 78.4867,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Only render markers if coordinates are valid to prevent Native Crashes */}
        {userCoords && userCoords.latitude && (
          <Marker
            coordinate={userCoords}
            title="Me"
            tracksViewChanges={shouldTrack}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <HeartMarker type="me" initial={user?.displayName?.[0] || 'M'} />
          </Marker>
        )}

        {partnerCoords && partnerCoords.latitude && (
          <Marker
            coordinate={partnerCoords}
            title="Partner"
            tracksViewChanges={shouldTrack}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={onMarkerPress}
          >
            <HeartMarker 
              type="partner" 
              initial={(partnerName || 'P')[0].toUpperCase()} 
              batteryLevel={partnerLocation?.batteryLevel}
            />
          </Marker>
        )}

        {userCoords && partnerCoords && GOOGLE_MAPS_APIKEY && GOOGLE_MAPS_APIKEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE' && (
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

        {savedPlaces?.filter(p => p && p.latitude && p.longitude).map((place) => (
          <React.Fragment key={place.id}>
            <Marker
              coordinate={{
                latitude: Number(place.latitude),
                longitude: Number(place.longitude),
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={shouldTrack}
            >
              <View style={styles.placeMarker}>
                <View style={[styles.placeTag, { borderColor: theme.border }]}>
                  <Text style={[styles.placeText, { color: theme.text }]}>{place.name}</Text>
                </View>
                <View style={[styles.placeIcon, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
                  {getPlaceIcon(place.type, theme.primary)}
                </View>
              </View>
            </Marker>
            <Circle
              center={{
                latitude: Number(place.latitude),
                longitude: Number(place.longitude),
              }}
              radius={Number(place.radius || 200)}
              strokeColor={theme.primary + '80'}
              fillColor={theme.primary + '20'}
              zIndex={1}
              strokeWidth={1}
            />
          </React.Fragment>
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
  placeMarker: { alignItems: 'center' },
  placeTag: {
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 4,
    borderWidth: 1,
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
