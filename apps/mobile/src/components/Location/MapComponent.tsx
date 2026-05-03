import React from 'react';
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
import { View, Text } from 'react-native';

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
  onMarkerPress
}: MapComponentProps) => {
  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        onMapReady={onMapReady}
        onRegionChangeComplete={onRegionChangeComplete}
      showsUserLocation={true}
      showsMyLocationButton={false}
      customMapStyle={theme.isDark ? darkMapStyle : []}
      initialRegion={{
        latitude: userLocation?.coords.latitude || 37.78825,
        longitude: userLocation?.coords.longitude || -122.4324,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
    >
      {userLocation && (
        <Marker
          coordinate={{
            latitude: userLocation.coords.latitude,
            longitude: userLocation.coords.longitude,
          }}
          title="Me"
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 1 }}
        >
          <HeartMarker type="me" initial={user?.displayName?.[0] || 'M'} />
        </Marker>
      )}

      {partnerLocation && (
        <Marker
          coordinate={{
            latitude: partnerLocation.latitude,
            longitude: partnerLocation.longitude,
          }}
          title="Partner"
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 1 }}
          onPress={onMarkerPress}
        >
          <HeartMarker 
            type="partner" 
            initial={partnerLocation.status === 'home' ? undefined : 'P'} 
            batteryLevel={partnerLocation.batteryLevel}
          />
        </Marker>
      )}

      {userLocation && partnerLocation && GOOGLE_MAPS_APIKEY && GOOGLE_MAPS_APIKEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE' && (
        <MapViewDirections
          origin={{
            latitude: userLocation.coords.latitude,
            longitude: userLocation.coords.longitude,
          }}
          destination={{
            latitude: partnerLocation.latitude,
            longitude: partnerLocation.longitude,
          }}
          apikey={GOOGLE_MAPS_APIKEY}
          strokeWidth={4}
          strokeColor={theme.primary}
          lineDashPattern={[0]}
          onReady={result => {
            // Optimization: Only update global state if distance changes by more than 0.05km (50m)
            // or ETA changes by more than 1 minute.
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
            title={place.name}
            description={place.type}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false} // CRITICAL: Stop redundant re-renders
          >
            <View style={{ 
              backgroundColor: theme.surface, 
              padding: 6, 
              borderRadius: 20, 
              borderWidth: 2, 
              borderColor: theme.primary,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }}>
              {getPlaceIcon(place.type, theme.primary)}
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
      <View style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: -20,
        marginTop: -40,
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}>
        <MapPin size={40} color={theme.primary} />
        <View style={{ 
          width: 6, 
          height: 6, 
          borderRadius: 3, 
          backgroundColor: theme.primary,
          marginTop: -3,
          borderWidth: 1,
          borderColor: 'white'
        }} />
      </View>
    )}
    </View>
  );
});
