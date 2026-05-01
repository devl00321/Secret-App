import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Switch, ScrollView } from 'react-native';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Shield, AlertTriangle, Phone, Radio } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const SafetyScreen = () => {
  const [isWalkSafe, setIsWalkSafe] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
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
              <Text style={styles.modeTitle}>Walk Safe Mode</Text>
              <Text style={styles.modeDesc}>{"Alerts partner if you don't reach home"}</Text>
            </View>
            <Switch 
              value={isWalkSafe} 
              onValueChange={setIsWalkSafe} 
              trackColor={{ false: '#DDD', true: '#FF6B6B' }}
            />
          </View>
        </Card>

        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Radio size={20} color={isWalkSafe ? "#FF6B6B" : "#AAA"} />
            <Text style={styles.statusLabel}>Tracking: {isWalkSafe ? "Active" : "Inactive"}</Text>
          </View>
          <View style={styles.statusItem}>
            <Shield size={20} color="#4CAF50" />
            <Text style={styles.statusLabel}>Partner Alerted</Text>
          </View>
        </View>

        <View style={styles.emergencyContacts}>
          <Text style={styles.sectionTitle}>Emergency Actions</Text>
          <TouchableOpacity style={styles.actionItem}>
            <Phone size={24} color="#333" />
            <Text style={styles.actionText}>Call Partner</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionItem, styles.lastAction]}>
            <AlertTriangle size={24} color="#FF6B6B" />
            <Text style={[styles.actionText, { color: '#FF6B6B' }]}>Silent Emergency Alert</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
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
    backgroundColor: 'white',
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
