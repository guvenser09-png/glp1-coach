import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUBSCRIPTION_KEY = 'subscription_data';

// Features accessible by free users (weight tracking + diet plans always free)
const FREE_FEATURES = ['weight', 'diet_plans'];

const SubscriptionContext = createContext({
  isPremium: false,
  trialEndsAt: null,
  subscriptionPlan: 'free',
  startTrial: async () => {},
  subscribe: async () => {},
  checkAccess: () => false,
});

export function SubscriptionProvider({ children }) {
  const [isPremium, setIsPremium] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState('free');

  const applySubscriptionData = useCallback((data) => {
    if (!data) return;

    const now = Date.now();

    if (data.subscriptionPlan === 'trial' && data.trialEndsAt) {
      if (new Date(data.trialEndsAt).getTime() > now) {
        // Trial still active
        setIsPremium(true);
        setTrialEndsAt(data.trialEndsAt);
        setSubscriptionPlan('trial');
      } else {
        // Trial expired — downgrade to free
        setIsPremium(false);
        setTrialEndsAt(data.trialEndsAt);
        setSubscriptionPlan('free');
        AsyncStorage.setItem(
          SUBSCRIPTION_KEY,
          JSON.stringify({ ...data, subscriptionPlan: 'free', isPremium: false })
        );
      }
    } else if (data.subscriptionPlan === 'monthly' || data.subscriptionPlan === 'annual') {
      setIsPremium(true);
      setTrialEndsAt(data.trialEndsAt || null);
      setSubscriptionPlan(data.subscriptionPlan);
    } else {
      setIsPremium(false);
      setTrialEndsAt(data.trialEndsAt || null);
      setSubscriptionPlan('free');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SUBSCRIPTION_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          applySubscriptionData(data);
        }
      } catch (e) {
        console.warn('SubscriptionContext: failed to load subscription data', e);
      }
    })();
  }, [applySubscriptionData]);

  const startTrial = useCallback(async () => {
    const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const data = {
      isPremium: true,
      trialEndsAt: trialEnd,
      subscriptionPlan: 'trial',
    };
    try {
      await AsyncStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('SubscriptionContext: failed to save trial data', e);
    }
    setIsPremium(true);
    setTrialEndsAt(trialEnd);
    setSubscriptionPlan('trial');
  }, []);

  const subscribe = useCallback(async (plan) => {
    const data = {
      isPremium: true,
      trialEndsAt: trialEndsAt,
      subscriptionPlan: plan,
    };
    try {
      await AsyncStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('SubscriptionContext: failed to save subscription data', e);
    }
    setIsPremium(true);
    setSubscriptionPlan(plan);
  }, [trialEndsAt]);

  const checkAccess = useCallback(
    (feature) => {
      if (FREE_FEATURES.includes(feature)) return true;
      return isPremium;
    },
    [isPremium]
  );

  return (
    <SubscriptionContext.Provider
      value={{ isPremium, trialEndsAt, subscriptionPlan, startTrial, subscribe, checkAccess }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export default SubscriptionContext;
