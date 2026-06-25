import React from 'react';
import Svg, { Rect, Path, Circle, Line } from 'react-native-svg';

// Maya — the in-app wellness coach mascot. Matches the official Stitch logo
// (rounded indigo chat-bubble with antenna, sparkly eyes, rosy cheeks, smile).
// Scales cleanly at any size; drop in wherever the coach appears.
export default function MayaAvatar({ size = 28, style }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      style={style}
      accessibilityRole="image"
      accessibilityLabel="Maya"
    >
      {/* body */}
      <Rect x="30" y="50" width="140" height="110" rx="55" fill="#4F46E5" />
      {/* tail / bubble notch */}
      <Path d="M70 155L50 180L45 150" fill="#4F46E5" />
      {/* eyes */}
      <Circle cx="70" cy="100" r="10" fill="#ffffff" />
      <Circle cx="130" cy="100" r="10" fill="#ffffff" />
      <Circle cx="70" cy="98" r="4" fill="#000000" />
      <Circle cx="130" cy="98" r="4" fill="#000000" />
      {/* sparkles */}
      <Circle cx="74" cy="94" r="2" fill="#ffffff" />
      <Circle cx="134" cy="94" r="2" fill="#ffffff" />
      {/* cheeks */}
      <Circle cx="55" cy="120" r="8" fill="#FB7185" fillOpacity={0.6} />
      <Circle cx="145" cy="120" r="8" fill="#FB7185" fillOpacity={0.6} />
      {/* smile */}
      <Path d="M85 130C85 130 100 140 115 130" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* antenna */}
      <Line x1="100" y1="50" x2="100" y2="30" stroke="#4F46E5" strokeWidth="4" strokeLinecap="round" />
      <Circle cx="100" cy="25" r="5" fill="#4F46E5" />
    </Svg>
  );
}
