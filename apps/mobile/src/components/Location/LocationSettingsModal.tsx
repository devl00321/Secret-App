import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Switch, TouchableWithoutFeedback } from 'react-native';
import { X, Clock, Shield, MapPin, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { useLocationStore } from '../../store/useLocationStore';

interface LocationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenSavedPlaces: () => void;
}

export const LocationSettingsModal = ({ visible, onClose, onOpenSavedPlaces }: LocationSettingsModalProps) => {
  const theme = useTheme();
  const { isSharing, sharingDuration, setSharing, setSharingDuration, savedPlaces } = useLocationStore();

  const durations = [
    { label: '15 Minutes', value: '15m' },
    { label: '1 Hour', value: '1h' },
    { label: 'Always', value: 'always' },
  ];

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <View style={[styles.content, { backgroundColor: theme.surface }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>Privacy Settings 🔒</Text>
              <TouchableOpacity onPress={onClose}>
                <X size={24} color={theme.textLight} />
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <View style={styles.row}>
                <View>
                  <Text style={[styles.label, { color: theme.text }]}>Share Live Location</Text>
                  <Text style={[styles.subLabel, { color: theme.textLight }]}>Partner can see where you are</Text>
                </View>
                <Switch 
                  value={isSharing} 
                  onValueChange={setSharing}
                  trackColor={{ false: theme.border, true: theme.primary }}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textLight }]}>GEOFENCING</Text>
              <TouchableOpacity 
                style={[styles.placesButton, { backgroundColor: theme.isDark ? '#222' : '#F8F8F8' }]}
                onPress={onOpenSavedPlaces}
              >
                <View style={styles.placesButtonLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
                    <MapPin size={20} color={theme.primary} />
                  </View>
                  <View style={{ marginLeft: 15 }}>
                    <Text style={[styles.label, { color: theme.text }]}>Saved Places</Text>
                    <Text style={[styles.subLabel, { color: theme.textLight }]}>
                      {savedPlaces.length} zones configured
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color={theme.textLight} />
              </TouchableOpacity>
            </View>

            {isSharing && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textLight }]}>SHARING DURATION</Text>
                {durations.map((d) => (
                  <TouchableOpacity 
                    key={d.value}
                    style={[
                      styles.durationItem, 
                      { backgroundColor: theme.isDark ? '#222' : '#F8F8F8' },
                      sharingDuration === d.value && { borderColor: theme.primary, borderWidth: 2 }
                    ]}
                    onPress={() => setSharingDuration(d.value as any)}
                  >
                    <Clock size={20} color={sharingDuration === d.value ? theme.primary : theme.textLight} />
                    <Text style={[
                      styles.durationText, 
                      { color: theme.text },
                      sharingDuration === d.value && { color: theme.primary, fontWeight: 'bold' }
                    ]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={[styles.infoBox, { backgroundColor: theme.primary + '10' }]}>
              <Shield size={20} color={theme.primary} />
              <Text style={[styles.infoText, { color: theme.text }]}>
                Your location is only shared with your partner. Encrypted and secure.
              </Text>
            </View>

            <Button 
              title="Done" 
              onPress={onClose}
              style={styles.doneButton}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -15 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 12,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  subLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  placesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: 18,
  },
  placesButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  durationText: {
    marginLeft: 15,
    fontSize: 15,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 25,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    marginLeft: 12,
    lineHeight: 18,
  },
  doneButton: {
    marginTop: 10,
  }
});
