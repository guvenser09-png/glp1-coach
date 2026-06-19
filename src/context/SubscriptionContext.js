// SubscriptionContext.js
// RevenueCat entitlement key: 'premium'
// Critical: addCustomerInfoUpdateListener keeps isPremium in sync after purchase,
// restore, or server-side subscription change without requiring an app restart.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform, Linking } from 'react-native';
import { REVENUECAT_API_KEY } from '../config';

// react-native-purchases is a native module that is NOT present in Expo Go.
// The paywall is removed and RevenueCat is dormant, so we lazily/guardedly load
// it: in Expo Go (or any build without the native module) Purchases stays null
// and the app boots normally instead of crashing on a missing native module.
let Purchases = null;
let LOG_LEVEL = {};
let PURCHASES_ERROR_CODE = {};
try {
  const mod = require('react-native-purchases');
  Purchases = mod.default ?? mod;
  LOG_LEVEL = mod.LOG_LEVEL ?? {};
  PURCHASES_ERROR_CODE = mod.PURCHASES_ERROR_CODE ?? {};
} catch (e) {
  // Native module unavailable (Expo Go / not built) — RevenueCat stays dormant.
}

const ENTITLEMENT_KEY = 'premium';

const SubscriptionContext = createContext({
  isPremium: false,
  isLoaded: false,
  trialEndsAt: null,
  subscriptionPlan: 'free',
  offerings: null,
  subscribe: async () => {},
  restorePurchases: async () => {},
  refreshCustomerInfo: async () => {},
  checkAccess: () => true,
  manageSubscription: () => {},
});

export function SubscriptionProvider({ children }) {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState('free');
  const [offerings, setOfferings] = useState(null);

  // ── Configure RevenueCat and start listeners on mount ──────────────────────
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      // Android not yet configured; mark as loaded to avoid infinite spinner
      setIsLoaded(true);
      return;
    }

    // Paywall is removed and everything is unlocked (checkAccess => true).
    // RevenueCat is dormant: only configure when an API key is actually present,
    // so an empty key never triggers startup errors. Re-enabling the paywall
    // later just needs the key set in app config.
    if (!REVENUECAT_API_KEY || !Purchases) {
      setIsLoaded(true);
      return;
    }

    Purchases.setLogLevel(LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });

    // Load initial state
    loadCustomerInfo();
    loadOfferings();

    // Real-time listener: fires whenever RevenueCat pushes a subscription update.
    // Without this, a completed purchase won't update isPremium until app restart.
    const listenerSub = Purchases.addCustomerInfoUpdateListener((info) => {
      applyCustomerInfo(info);
    });

    return () => {
      // Clean up listener on unmount (prevents memory leaks / stale setState)
      if (typeof listenerSub?.remove === 'function') {
        listenerSub.remove();
      } else if (typeof listenerSub === 'function') {
        listenerSub();
      }
    };
  }, []);

  // ── Load customer info (called on mount and after purchases) ───────────────
  async function loadCustomerInfo() {
    try {
      const info = await Purchases.getCustomerInfo();
      applyCustomerInfo(info);
    } catch (e) {
      console.warn('RevenueCat: failed to load customer info', e?.message);
    } finally {
      setIsLoaded(true);
    }
  }

  // ── Load available offerings (subscription plans with localized prices) ────
  async function loadOfferings() {
    try {
      const result = await Purchases.getOfferings();
      // result.current is the default offering configured in RevenueCat dashboard
      if (result.current) setOfferings(result.current);
    } catch (e) {
      console.warn('RevenueCat: failed to load offerings', e?.message);
    }
  }

  // ── Apply customer info to state (single source of truth) ─────────────────
  // Called after purchase, restore, and by the real-time listener.
  function applyCustomerInfo(info) {
    const entitlement = info?.entitlements?.active?.[ENTITLEMENT_KEY];
    if (entitlement) {
      setIsPremium(true);
      setTrialEndsAt(entitlement.expirationDate ?? null);
      setSubscriptionPlan(
        entitlement.productIdentifier?.includes('annual') ? 'annual' : 'monthly'
      );
    } else {
      setIsPremium(false);
      setTrialEndsAt(null);
      setSubscriptionPlan('free');
    }
  }

  // ── Purchase a package ─────────────────────────────────────────────────────
  // Returns true on success, false on user cancel. Throws on other errors
  // so the caller (PaywallScreen) can show specific error messages.
  const subscribe = useCallback(async (packageToPurchase) => {
    if (!Purchases) return false;
    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      // Apply immediately from purchase response
      applyCustomerInfo(customerInfo);
      // Second refresh: ensures entitlements are fully propagated on RevenueCat servers
      const fresh = await Purchases.getCustomerInfo();
      applyCustomerInfo(fresh);
      return true;
    } catch (e) {
      // userCancelled or PURCHASE_CANCELLED_ERROR = user tapped cancel in the App Store sheet
      if (e?.userCancelled || e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return false;
      throw e; // PaywallScreen handles specific error codes
    }
  }, []);

  // ── Restore purchases ──────────────────────────────────────────────────────
  // Returns true only if an active 'premium' entitlement is found after restore.
  const restorePurchases = useCallback(async () => {
    if (!Purchases) return false;
    try {
      const info = await Purchases.restorePurchases();
      applyCustomerInfo(info);
      // Second refresh for reliability
      const fresh = await Purchases.getCustomerInfo();
      applyCustomerInfo(fresh);
      // Only return true if the user actually has an active entitlement
      return !!(fresh?.entitlements?.active?.[ENTITLEMENT_KEY]);
    } catch (e) {
      console.warn('RevenueCat: restore failed', e?.message);
      throw e; // Let the caller handle and show proper error message
    }
  }, []);

  // ── Force refresh (e.g. after app comes back to foreground) ───────────────
  const refreshCustomerInfo = useCallback(async () => {
    if (!Purchases) return;
    try {
      const info = await Purchases.getCustomerInfo();
      applyCustomerInfo(info);
    } catch (e) {
      console.warn('RevenueCat: refresh failed', e?.message);
    }
  }, []);

  // Paywall removed — everything is unlocked. RevenueCat plumbing below remains
  // intact but dormant; access is always granted regardless of entitlement state.
  const checkAccess = useCallback(() => true, []);

  const manageSubscription = useCallback(() => {
    Linking.openURL('https://apps.apple.com/account/subscriptions');
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        isPremium,
        isLoaded,
        trialEndsAt,
        subscriptionPlan,
        offerings,
        subscribe,
        restorePurchases,
        refreshCustomerInfo,
        checkAccess,
        manageSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export default SubscriptionContext;
