import AsyncStorage from '@react-native-async-storage/async-storage';

// B3: These AsyncStorage keys (user_profile_*, weight_logs_*, meal_logs_*) are the
// single local source of truth for user data. There is no second persistence layer.
// B2: Full history is preserved here — do NOT cap logs with slice(); silently
// dropping older entries discards real user data.

// B5: guard every parse so a single corrupt record can't throw / white-screen.
function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function saveUserProfile(userId, data) {
  await AsyncStorage.setItem(`user_profile_${userId}`, JSON.stringify(data));
}

export async function getUserProfile(userId) {
  const raw = await AsyncStorage.getItem(`user_profile_${userId}`);
  return safeParse(raw, null);
}

export async function saveWeightLog(userId, weight) {
  const key = `weight_logs_${userId}`;
  const raw = await AsyncStorage.getItem(key);
  const logs = safeParse(raw, []);
  logs.push({ weight, date: new Date().toISOString().split('T')[0], timestamp: new Date().toISOString() });
  await AsyncStorage.setItem(key, JSON.stringify(logs));
}

export async function getWeightLogs(userId) {
  const raw = await AsyncStorage.getItem(`weight_logs_${userId}`);
  return safeParse(raw, []);
}

export async function saveMealAnalysis(userId, analysisData) {
  const key = `meal_logs_${userId}`;
  const raw = await AsyncStorage.getItem(key);
  const logs = safeParse(raw, []);
  logs.push({ ...analysisData, date: new Date().toISOString().split('T')[0], timestamp: new Date().toISOString() });
  await AsyncStorage.setItem(key, JSON.stringify(logs));
}

export async function getMealLogs(userId) {
  const raw = await AsyncStorage.getItem(`meal_logs_${userId}`);
  return safeParse(raw, []);
}
