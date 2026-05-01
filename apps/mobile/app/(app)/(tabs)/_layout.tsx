import React from 'react';
import { Tabs } from 'expo-router';
import { CustomTabBar } from '../../../src/components/CustomTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="location"
        options={{
          title: 'Map',
        }}
      />
      <Tabs.Screen
        name="safety"
        options={{
          title: 'Safety',
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: 'Timeline',
        }}
      />
    </Tabs>
  );
}
