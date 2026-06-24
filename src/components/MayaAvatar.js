import React from 'react';
import Svg, { Path, Rect, Circle, Ellipse } from 'react-native-svg';

// Maya — the in-app wellness coach mascot (concept B: a friendly chat-bubble
// assistant). Scales cleanly at any size; drop in wherever the coach appears.
export default function MayaAvatar({ size = 28, style }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={style}
      accessibilityRole="image"
      accessibilityLabel="Maya"
    >
      {/* little antenna */}
      <Rect x="47" y="4" width="4" height="11" rx="2" fill="#818CF8" />
      <Circle cx="49" cy="4" r="3.6" fill="#818CF8" />
      {/* speech-bubble body */}
      <Path
        d="M30 14 H70 a20 20 0 0 1 20 20 V54 a20 20 0 0 1 -20 20 H40 l-10 12 v-12 a20 20 0 0 1 -20 -20 V34 a20 20 0 0 1 20 -20 Z"
        fill="#4F46E5"
      />
      {/* cheeks */}
      <Ellipse cx="30" cy="52" rx="6" ry="4" fill="#FDA4AF" opacity={0.55} />
      <Ellipse cx="70" cy="52" rx="6" ry="4" fill="#FDA4AF" opacity={0.55} />
      {/* eyes */}
      <Circle cx="40" cy="40" r="9" fill="#ffffff" />
      <Circle cx="60" cy="40" r="9" fill="#ffffff" />
      <Circle cx="41" cy="42" r="4.5" fill="#312E81" />
      <Circle cx="59" cy="42" r="4.5" fill="#312E81" />
      <Circle cx="38" cy="38" r="1.8" fill="#ffffff" />
      <Circle cx="57" cy="38" r="1.8" fill="#ffffff" />
      {/* smile */}
      <Path d="M42 54 Q50 62 58 54" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
    </Svg>
  );
}
