import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

// ── XP Rewards ───────────────────────────────────────────────────────────────
export const XP_REWARDS = {
  log_weight:         10,
  upload_meal:        20,
  meal_analysis:      10,
  log_workout:        25,
  weight_training:    35,  // bonus on top of log_workout
  reach_protein:      30,
  complete_all_missions: 50,
};

// ── Daily Missions ────────────────────────────────────────────────────────────
export const MISSIONS = [
  { id: 'log_weight',   icon: '⚖️', xp: XP_REWARDS.log_weight,   en: 'Log your weight',        tr: 'Kilonu kaydet' },
  { id: 'upload_meal',  icon: '🍽️', xp: XP_REWARDS.upload_meal,  en: 'Log a meal',              tr: 'Öğün kaydet' },
  { id: 'log_workout',  icon: '🏋️', xp: XP_REWARDS.log_workout,  en: 'Log a workout',           tr: 'Spor seansı kaydet' },
  { id: 'reach_protein',icon: '💪', xp: XP_REWARDS.reach_protein, en: 'Hit your protein target', tr: 'Protein hedefine ulaş' },
];

// ── Level System ──────────────────────────────────────────────────────────────
export const LEVELS = [
  { level: 1, en: 'Starter',           tr: 'Başlangıç',        emoji: '🌱', minXP: 0    },
  { level: 2, en: 'Fat Burner',         tr: 'Yağ Yakıcı',       emoji: '🔥', minXP: 150  },
  { level: 3, en: 'Muscle Protector',   tr: 'Kas Koruyucu',     emoji: '💪', minXP: 400  },
  { level: 4, en: 'Metabolic Builder',  tr: 'Metabolizma Ustası',emoji: '⚡', minXP: 800  },
  { level: 5, en: 'Body Architect',     tr: 'Vücut Mimarı',     emoji: '🏆', minXP: 1500 },
];

export function getCurrentLevel(totalXP) {
  let current = LEVELS[0];
  for (const l of LEVELS) { if (totalXP >= l.minXP) current = l; }
  return current;
}

export function getNextLevel(totalXP) {
  const cur = getCurrentLevel(totalXP);
  return LEVELS.find(l => l.level === cur.level + 1) || null;
}

export function getXPProgress(totalXP) {
  const cur = getCurrentLevel(totalXP);
  const next = getNextLevel(totalXP);
  if (!next) return { pct: 100, xpInLevel: 0, xpNeeded: 0 };
  const xpInLevel = totalXP - cur.minXP;
  const xpNeeded = next.minXP - cur.minXP;
  return { pct: Math.round((xpInLevel / xpNeeded) * 100), xpInLevel, xpNeeded, xpToNext: xpNeeded - xpInLevel };
}

// ── Health Score (0–100) ──────────────────────────────────────────────────────
export function calcHealthScore({ proteinPct = 0, loggedMeals = 0, loggedWorkout = false, loggedWeight = false }) {
  let score = 0;
  score += Math.min(proteinPct, 100) * 0.45;          // 45 pts max
  score += Math.min(loggedMeals, 3) * 10 * 0.25;      // 25 pts max (3 meals = full)
  if (loggedWorkout) score += 20;                       // 20 pts
  if (loggedWeight) score += 10;                        // 10 pts
  return Math.round(Math.min(score, 100));
}

// ── Context ───────────────────────────────────────────────────────────────────
const GamificationContext = createContext({});

export function GamificationProvider({ children }) {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const [completedMissions, setCompletedMissions] = useState([]);
  const [dailyXP, setDailyXP] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [streak, setStreak] = useState(0);
  const [xpFlash, setXpFlash] = useState(null); // { xp, label }

  const dailyKey = user ? `gamif_daily_${user.uid}_${today}` : null;
  const totalKey = user ? `gamif_total_${user.uid}` : null;

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  async function load() {
    try {
      const d = await AsyncStorage.getItem(dailyKey);
      if (d) {
        const parsed = JSON.parse(d);
        setCompletedMissions(parsed.missions || []);
        setDailyXP(parsed.xp || 0);
      }
      const t = await AsyncStorage.getItem(totalKey);
      if (t) {
        const parsed = JSON.parse(t);
        setTotalXP(parsed.totalXP || 0);
        // Streak logic
        const last = parsed.lastActiveDate;
        const yest = new Date(); yest.setDate(yest.getDate() - 1);
        const yStr = yest.toISOString().split('T')[0];
        if (last === today) {
          setStreak(parsed.streak || 0);
        } else if (last === yStr) {
          setStreak(parsed.streak || 0);
        } else if (last) {
          setStreak(0);
          await AsyncStorage.setItem(totalKey, JSON.stringify({ ...parsed, streak: 0 }));
        }
      }
    } catch {}
  }

  const earnXP = useCallback(async (amount, label) => {
    if (!user || !totalKey || !dailyKey) return;
    const newDaily = dailyXP + amount;
    const newTotal = totalXP + amount;

    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yStr = yest.toISOString().split('T')[0];
    const totalRaw = await AsyncStorage.getItem(totalKey);
    const totalData = totalRaw ? JSON.parse(totalRaw) : {};
    let newStreak = streak;
    if (totalData.lastActiveDate !== today) {
      newStreak = totalData.lastActiveDate === yStr ? (totalData.streak || 0) + 1 : 1;
    }

    await AsyncStorage.setItem(totalKey, JSON.stringify({ totalXP: newTotal, streak: newStreak, lastActiveDate: today }));
    const dailyRaw = await AsyncStorage.getItem(dailyKey);
    const dailyData = dailyRaw ? JSON.parse(dailyRaw) : {};
    await AsyncStorage.setItem(dailyKey, JSON.stringify({ ...dailyData, xp: newDaily }));

    setTotalXP(newTotal);
    setDailyXP(newDaily);
    setStreak(newStreak);
    setXpFlash({ xp: amount, label });
    setTimeout(() => setXpFlash(null), 2500);
  }, [user, totalKey, dailyKey, dailyXP, totalXP, streak, today]);

  const completeMission = useCallback(async (missionId) => {
    if (!user || !dailyKey || completedMissions.includes(missionId)) return;
    const mission = MISSIONS.find(m => m.id === missionId);
    if (!mission) return;

    const newCompleted = [...completedMissions, missionId];
    setCompletedMissions(newCompleted);
    const dailyRaw = await AsyncStorage.getItem(dailyKey);
    const dailyData = dailyRaw ? JSON.parse(dailyRaw) : {};
    await AsyncStorage.setItem(dailyKey, JSON.stringify({ ...dailyData, missions: newCompleted }));

    await earnXP(mission.xp, mission.en);

    // Bonus if all missions complete
    if (newCompleted.length === MISSIONS.length) {
      await earnXP(XP_REWARDS.complete_all_missions, '🎯 All missions!');
    }
  }, [user, dailyKey, completedMissions, earnXP]);

  const isMissionDone = useCallback((id) => completedMissions.includes(id), [completedMissions]);

  const value = useMemo(() => ({
    completedMissions, dailyXP, totalXP, streak,
    completeMission, earnXP, isMissionDone, xpFlash,
  }), [
    completedMissions, dailyXP, totalXP, streak,
    completeMission, earnXP, isMissionDone, xpFlash,
  ]);

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  return useContext(GamificationContext);
}
