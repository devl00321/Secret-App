export default ({ config }) => {
  return {
    ...config,
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-logo.png",
          "imageWidth": 160,
          "resizeMode": "contain",
          "backgroundColor": "#1A0B2E",
          "dark": {
            "backgroundColor": "#1A0B2E"
          }
        }
      ],
      [
        "expo-build-properties",
        {
          "ios": {
            "deploymentTarget": "16.1",
            "useFrameworks": "static"
          },
          "android": {
            "ndkVersion": "26.1.10909125"
          }
        }
      ],
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow Love App to access your location always to keep you and your partner safe.",
          "locationWhenInUsePermission": "Allow Love App to access your location while using the app.",
          "locationAlwaysPermission": "Allow Love App to access your location always to keep you and your partner safe.",
          "isAndroidBackgroundLocationEnabled": true
        }
      ],
      [
        "expo-local-authentication",
        {
          "faceIDPermission": "Allow Love App to use FaceID for secure map access."
        }
      ],
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      "@react-native-firebase/messaging",
      "react-native-quick-crypto",
      "expo-secure-store",
      "./hooks/withPodfileFix.js",
      "./hooks/withNoPushEntitlement.js"
    ],
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        // Override with the environment variable if available
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS || config.ios?.config?.googleMapsApiKey
      }
    },
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          ...config.android?.config?.googleMaps,
          // Override with the environment variable if available
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID || config.android?.config?.googleMaps?.apiKey
        }
      }
    }
  };
};
