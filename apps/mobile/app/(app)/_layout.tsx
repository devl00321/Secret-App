import { Stack } from 'expo-router';

export default function AppLayout() {
  // Redirection is now handled centrally in the RootLayout
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[chatId]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
