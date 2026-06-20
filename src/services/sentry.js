// Sentry crash/error analytics (report D2).
// DSN'e bağlı: DSN yoksa hiçbir şey yapmaz (no-op). / Gated on a DSN: if no DSN
// is configured this is a complete no-op so the app runs fine without one.
//
// The DSN is read from app config extra (Constants.expoConfig.extra.sentryDsn)
// or the EXPO_PUBLIC_SENTRY_DSN env var. Sentry DSNs are publishable, but we keep
// it env-driven so no secret is hard-coded into the bundle.
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN =
  Constants?.expoConfig?.extra?.sentryDsn ||
  process.env.EXPO_PUBLIC_SENTRY_DSN ||
  '';

let initialized = false;
let noDsnLogged = false;

/**
 * Initialize Sentry once, only when a DSN is present. Safe to call repeatedly.
 * No DSN -> no-op (logs an info line once). Never throws.
 * Sentry'yi yalnızca DSN varsa bir kez başlatır; DSN yoksa sessizce no-op.
 */
export function initSentry() {
  if (initialized) return;

  if (!DSN) {
    if (!noDsnLogged) {
      noDsnLogged = true;
      // eslint-disable-next-line no-console
      console.info(
        '[sentry] No DSN configured — crash reporting disabled. / DSN yok — çökme raporlama devre dışı.'
      );
    }
    return;
  }

  try {
    Sentry.init({
      dsn: DSN,
      enableNative: true,
      tracesSampleRate: 0.2,
    });
    initialized = true;
  } catch (e) {
    // Never let analytics setup crash the app. / Analitik kurulumu uygulamayı çökertmemeli.
    // eslint-disable-next-line no-console
    console.warn('[sentry] init failed / başlatma başarısız:', e?.message || e);
  }
}

/**
 * Report a caught error to Sentry. No-op if Sentry was never initialized
 * (e.g. no DSN). Guarded so it can never throw.
 * Yakalanan bir hatayı Sentry'ye gönderir; başlatılmadıysa no-op.
 *
 * @param {Error} error  The error to capture.
 * @param {object} [info] Optional extra context attached to the event.
 */
export function captureError(error, info) {
  if (!initialized) return;
  try {
    Sentry.captureException(error, info ? { extra: info } : undefined);
  } catch (e) {
    // Swallow — reporting must never break the app. / Raporlama uygulamayı bozmamalı.
  }
}

export default { initSentry, captureError };
