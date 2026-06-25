// AnimatedSection — lightweight mount entrance (fade + translate-up) used to
// stagger the Daily screen sections. No new deps; pure RN Animated. Respects the
// OS "reduce motion" setting (renders statically when enabled).
import React, { useRef, useEffect, useState } from 'react';
import { Animated, AccessibilityInfo, Easing } from 'react-native';

export default function AnimatedSection({ delay = 0, children, style, ...rest }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { if (mounted) setReduceMotion(!!v); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, delay, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View
      style={[{ opacity: progress, transform: [{ translateY }] }, style]}
      {...rest}
    >
      {children}
    </Animated.View>
  );
}
