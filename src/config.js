import Constants from 'expo-constants';

export const OPENAI_API_KEY =
  Constants.expoConfig?.extra?.openaiApiKey ||
  '';

export const REVENUECAT_API_KEY =
  Constants.expoConfig?.extra?.revenuecatApiKey ||
  '';
