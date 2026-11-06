import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/context/ThemeContext';

type BackIconProps = {
  size?: number;
};

export function BackIcon({ size = 14 }: BackIconProps) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 5 8 12l7 7"
        stroke={colors.accent}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
