import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, SafeAreaView, Switch, TouchableOpacity, Platform } from 'react-native';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useAuthStore } from '../store/useAuthStore';
import { User, Lock, MessageSquareText, Shield, Palette } from 'lucide-react-native';
import { useTheme } from '../theme';
import Animated, { FadeInUp } from 'react-native-reanimated';

export const ProfileScreen = () => {
  const theme = useTheme();
  const { logout, user } = useAuthStore();
  const [aiEnabled, setAiEnabled] = useState(true);
  const [locationPermissions, setLocationPermissions] = useState(true);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Settings" showBack />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Animated.View entering={FadeInUp.duration(600)} style={styles.profileHeader}>
          <View style={[styles.avatarLarge, { backgroundColor: theme.primarySoft, borderColor: theme.surface }]}>
            <User size={50} color={theme.primary} />
          </View>
          <Text style={[styles.userName, { color: theme.text }]}>{user?.displayName || 'Partner'}</Text>
          <Text style={[styles.userEmail, { color: theme.textLight }]}>{user?.email || 'Connected'}</Text>
        </Animated.View>

        <Text style={[styles.sectionTitle, { color: theme.textLight }]}>App Experience</Text>
        <Card style={styles.settingsCard}>
          <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
            <View style={styles.settingLabelContainer}>
              <View style={[styles.iconBox, { backgroundColor: '#E0F2FE' }]}>
                <MessageSquareText size={20} color="#0EA5E9" />
              </View>
              <View style={styles.settingTextContent}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Relationship AI</Text>
                <Text style={[styles.settingDesc, { color: theme.textLight }]}>Smart nudges & insights</Text>
              </View>
            </View>
            <Switch 
              value={aiEnabled} 
              onValueChange={setAiEnabled}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={Platform.OS === 'android' ? 'white' : undefined}
            />
          </View>

          <View style={[styles.settingItem, styles.noBorder]}>
            <View style={styles.settingLabelContainer}>
              <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
                <Shield size={20} color="#22C55E" />
              </View>
              <View style={styles.settingTextContent}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Safe Share</Text>
                <Text style={[styles.settingDesc, { color: theme.textLight }]}>Private location requests</Text>
              </View>
            </View>
            <Switch 
              value={locationPermissions} 
              onValueChange={setLocationPermissions}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={Platform.OS === 'android' ? 'white' : undefined}
            />
          </View>
        </Card>

        <Text style={[styles.sectionTitle, { color: theme.textLight }]}>Account</Text>
        <Card style={styles.settingsCard}>
          <TouchableOpacity style={[styles.accountItem, { borderBottomColor: theme.border }]}>
            <Lock size={20} color={theme.textLight} />
            <Text style={[styles.accountLabel, { color: theme.text }]}>Privacy Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.accountItem, styles.noBorder]}>
            <Palette size={20} color={theme.textLight} />
            <Text style={[styles.accountLabel, { color: theme.text }]}>Appearance</Text>
            <Text style={[styles.accountValue, { color: theme.primary }]}>System</Text>
          </TouchableOpacity>
        </Card>

        <Button 
          title="Logout" 
          onPress={logout} 
          variant="ghost" 
          style={styles.logoutButton}
          textStyle={{ color: '#FF4747', fontWeight: '800' }}
        />
        
        <Text style={styles.versionText}>LUVV Premium • v1.2.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  profileHeader: {
    alignItems: 'center',
    marginVertical: 40,
  },
  avatarLarge: {
    width: 110,
    height: 110,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    transform: [{ rotate: '5deg' }],
  },
  userName: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  userEmail: {
    fontSize: 15,
    marginTop: 4,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 16,
    marginLeft: 6,
    letterSpacing: 1.5,
  },
  settingsCard: {
    marginBottom: 32,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextContent: {
    marginLeft: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  settingDesc: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  accountLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 16,
    flex: 1,
  },
  accountValue: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  logoutButton: {
    marginTop: 20,
    backgroundColor: 'rgba(255, 71, 71, 0.05)',
  },
  versionText: {
    textAlign: 'center',
    color: '#AAA',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 40,
    marginBottom: 60,
  },
});
