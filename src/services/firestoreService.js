import AsyncStorage from '@react-native-async-storage/async-storage';

export async function saveUserProfile(userId, data) {
  await AsyncStorage.setItem(`user_profile_${userId}`, JSON.stringify(data));
}

export async function getUserProfile(userId) {
  const raw = await AsyncStorage.getItem(`user_profile_${userId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function saveWeightLog(userId, weight) {
  const key = `weight_logs_${userId}`;
  const raw = await AsyncStorage.getItem(key);
  const logs = raw ? JSON.parse(raw) : [];
  logs.push({ weight, date: new Date().toISOString().split('T')[0], timestamp: new Date().toISOString() });
  await AsyncStorage.setItem(key, JSON.stringify(logs.slice(-30)));
}

export async function getWeightLogs(userId) {
  const raw = await AsyncStorage.getItem(`weight_logs_${userId}`);
  return raw ? JSON.parse(raw) : [];
}

export async function saveMealAnalysis(userId, analysisData) {
  const key = `meal_logs_${userId}`;
  const raw = await AsyncStorage.getItem(key);
  const logs = raw ? JSON.parse(raw) : [];
  logs.push({ ...analysisData, date: new Date().toISOString().split('T')[0], timestamp: new Date().toISOString() });
  await AsyncStorage.setItem(key, JSON.stringify(logs.slice(-7)));
}

export async function getMealLogs(userId) {
  const raw = await AsyncStorage.getItem(`meal_logs_${userId}`);
  return raw ? JSON.parse(raw) : [];
}
