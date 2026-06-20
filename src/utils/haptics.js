// haptics — tiny guarded wrapper around expo-haptics.
// Lazily/guarded-requires the native module so the app never crashes if it's
// unavailable (e.g. web, missing build). Every call is wrapped in try/catch and
// is a no-op on failure — these helpers NEVER throw.
// Hafif dokunsal geri bildirim sarmalayıcısı — modül yoksa sessizce yok sayılır.

let _haptics; // cached module ref; null once we know it's unavailable.

function getHaptics() {
  if (_haptics !== undefined) return _haptics;
  try {
    // eslint-disable-next-line global-require
    _haptics = require('expo-haptics');
  } catch (e) {
    _haptics = null; // not available — remember so we don't retry.
  }
  return _haptics;
}

/** Light tap — for primary taps / selections. Hafif dokunuş. */
export function tap() {
  try {
    const H = getHaptics();
    if (H?.impactAsync) H.impactAsync(H.ImpactFeedbackStyle?.Light);
  } catch (e) {
    // no-op
  }
}

/** Success notification. Başarı geri bildirimi. */
export function success() {
  try {
    const H = getHaptics();
    if (H?.notificationAsync) {
      H.notificationAsync(H.NotificationFeedbackType?.Success);
    }
  } catch (e) {
    // no-op
  }
}

/** Warning notification. Uyarı geri bildirimi. */
export function warning() {
  try {
    const H = getHaptics();
    if (H?.notificationAsync) {
      H.notificationAsync(H.NotificationFeedbackType?.Warning);
    }
  } catch (e) {
    // no-op
  }
}

export default { tap, success, warning };
