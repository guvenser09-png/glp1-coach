export default {
  expo: {
    name: "GLP-1 Coach",
    slug: "glp1-coach",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#4F46E5",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.glp1coach.app",
      userInterfaceStyle: "automatic",
      buildNumber: "1",
      infoPlist: {
        NSCameraUsageDescription:
          "GLP-1 Coach uses your camera to take photos of your meals for protein and nutrition tracking.",
        NSPhotoLibraryUsageDescription:
          "GLP-1 Coach accesses your photo library so you can select meal photos for protein and nutrition tracking.",
        NSMotionUsageDescription:
          "GLP-1 Coach uses your device's motion sensors to count your daily steps to support your fitness goals.",
        ITSAppUsesNonExemptEncryption: false,
      },
      usesAppleSignIn: true,
      privacyManifests: {
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
            NSPrivacyAccessedAPITypeReasons: ["C617.1"],
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
          },
        ],
        NSPrivacyCollectedDataTypes: [
          {
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherDiagnosticData",
            NSPrivacyCollectedDataTypeLinked: false,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: [
              "NSPrivacyCollectedDataTypePurposeAppFunctionality",
            ],
          },
        ],
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#4F46E5",
      },
      package: "com.glp1coach.app",
      userInterfaceStyle: "automatic",
      versionCode: 1,
      permissions: [
        // CAMERA: capture meal photos for protein/nutrition tracking.
        "android.permission.CAMERA",
        // READ_MEDIA_IMAGES: select existing meal photos (Android 13+ scoped media access).
        "android.permission.READ_MEDIA_IMAGES",
        // ACTIVITY_RECOGNITION: read daily step count to support fitness goals.
        "android.permission.ACTIVITY_RECOGNITION",
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      [
        "expo-image-picker",
        {
          photosPermission:
            "GLP-1 Coach accesses your photo library so you can select meal photos for protein and nutrition tracking.",
          cameraPermission:
            "GLP-1 Coach uses your camera to take photos of your meals for protein and nutrition tracking.",
        },
      ],
      "expo-localization",
      "expo-font",
      [
        "@kingstinct/react-native-healthkit",
        {
          NSHealthShareUsageDescription:
            "GLP-1 Coach reads your weight, body composition, active energy and heart rate from Apple Health / Apple Watch to track progress and calories burned.",
          NSHealthUpdateUsageDescription:
            "GLP-1 Coach saves the weight you log back to Apple Health so your data stays in sync across your devices.",
          background: false,
        },
      ],
      "./app.plugin.js",
    ],
    scheme: "glp1coach",
    extra: {
      // SECURITY (audit #1): no hardcoded project credentials here. Anything in
      // `extra` ships in the client bundle, so it must come ONLY from env. The
      // Supabase URL + publishable (anon) key are safe to ship (public by design),
      // but env-only keeps the app portable across projects and out of git.
      // The OpenAI secret key NEVER lives here — it stays on the Supabase edge proxy.
      // Set these in .env (local) and as EAS secrets (builds). See .env.example.
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
      revenuecatApiKey: process.env.REVENUECAT_API_KEY || "",
      eas: {
        projectId: "b328678b-4d82-4468-9028-6890cf5aad20",
      },
    },
    owner: "guvenser",
  },
};
