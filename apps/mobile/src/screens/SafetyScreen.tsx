import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Shield, AlertTriangle, Phone, Radio } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';

export const SafetyScreen = () => {
  const theme = useTheme();
  const [isWalkSafe, setIsWalkSafe] = useState(false);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Safety Center" showBack />
      
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sosContainer}>
          <TouchableOpacity style={styles.sosButton} activeOpacity={0.8}>
            <LinearGradient colors={['#FF4747', '#D32F2F']} style={styles.sosGradient}>
              <Text style={styles.sosText}>SOS</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.sosHint}>Hold to alert partner immediately</Text>
        </View>

        <Card style={styles.modeCard}>
          <View style={styles.row}>
            <View style={styles.modeInfo}>
              <Text style={[styles.modeTitle, { color: theme.text }]}>Walk Safe Mode</Text>
              <Text style={[styles.modeDesc, { color: theme.textLight }]}>{"Alerts partner if you don't reach home"}</Text>
            </View>
            <Switch 
              value={isWalkSafe} 
              onValueChange={setIsWalkSafe} 
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
        </Card>

        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Radio size={20} color={isWalkSafe ? theme.primary : theme.textLight} />
            <Text style={[styles.statusLabel, { color: theme.textLight }]}>Tracking: {isWalkSafe ? "Active" : "Inactive"}</Text>
          </View>
          <View style={styles.statusItem}>
            <Shield size={20} color="#4CAF50" />
            <Text style={[styles.statusLabel, { color: theme.textLight }]}>Partner Alerted</Text>
          </View>
        </View>

        <View style={styles.emergencyContacts}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Emergency Actions</Text>
          <TouchableOpacity style={[styles.actionItem, { backgroundColor: theme.surface }]}>
            <Phone size={24} color={theme.text} />
            <Text style={[styles.actionText, { color: theme.text }]}>Call Partner</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionItem, styles.lastAction, { backgroundColor: theme.surface, borderColor: theme.primary + '30' }]}>
            <AlertTriangle size={24} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.primary }]}>Silent Emergency Alert</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 25,
    paddingBottom: 120, // Space for custom tab bar
  },
  sosContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  sosButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#FFE5E5',
    padding: 15,
    shadowColor: '#FF4747',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  sosGradient: {
    flex: 1,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  sosText: {
    fontSize: 40,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 2,
  },
  sosHint: {
    marginTop: 20,
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  modeCard: {
    marginTop: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeInfo: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modeDesc: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
    paddingHorizontal: 10,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#555',
    marginLeft: 8,
    fontWeight: '600',
  },
  emergencyContacts: {
    marginTop: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 15,
    color: '#333',
  },
  lastAction: {
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
});
