import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function AppLayout() {
  const { user } = useAuthStore();

  // If not authenticated, redirect to login
  if (!user) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[chatId]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
