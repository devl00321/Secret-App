import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';

export default function Index() {
  const { user } = useAuthStore();

  if (!user) {
    return <Redirect href="/(auth)" />;
  }

  // Redirect to the first tab (home)
  return <Redirect href="/(app)/(tabs)" />;
}
