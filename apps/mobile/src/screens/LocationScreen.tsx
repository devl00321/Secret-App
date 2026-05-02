import React, { useState } from 'react';
import { StyleSheet, View, Text, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { MapPin, Radio, Shield, Phone, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../theme';
import { Card } from '../components/Card';

export const LocationScreen = () => {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const [isSharing, setIsSharing] = useState(false);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Live Location" showBack />
      
      {/* Placeholder for MapView */}
      <View style={[styles.mapPlaceholder, { backgroundColor: theme.isDark ? '#1A1A1A' : '#E8F1F2' }]}>
        <View style={[styles.markerContainer, { top: height * 0.4, left: width * 0.5 }]}>
          <View style={[styles.marker, styles.myMarker]}>
            <Text style={styles.markerInitial}>M</Text>
          </View>
          <Text style={[styles.markerLabel, { color: theme.text }]}>Me</Text>
        </View>

        <View style={[styles.markerContainer, { top: height * 0.3, left: width * 0.4 }]}>
          <View style={[styles.marker, styles.partnerMarker]}>
            <Text style={styles.markerInitial}>P</Text>
          </View>
          <Text style={[styles.markerLabel, { color: theme.text }]}>Partner</Text>
        </View>

        <View style={[styles.mapInstructions, { backgroundColor: theme.surface + 'CC' }]}>
          <Text style={[styles.mapText, { color: theme.textLight }]}>Interactive map will appear here after API configuration</Text>
        </View>
      </View>

      <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <View style={styles.infoRow}>
          <MapPin size={20} color={theme.primary} />
          <Text style={[styles.infoText, { color: theme.text }]}>Partner is at Home (shared 5m ago)</Text>
        </View>
        <Button 
          title={isSharing ? "Stop Sharing" : "Start Sharing Location"} 
          onPress={() => setIsSharing(!isSharing)}
          variant={isSharing ? "outline" : "primary"}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#E8F1F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  myMarker: {
    backgroundColor: '#FF6B6B',
  },
  partnerMarker: {
    backgroundColor: '#6B66FF',
  },
  markerInitial: {
    color: 'white',
    fontWeight: 'bold',
  },
  markerLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    color: '#333',
  },
  mapInstructions: {
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
  },
  mapText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  footer: {
    padding: 25,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#444',
    marginLeft: 10,
    fontWeight: '500',
  },
});
