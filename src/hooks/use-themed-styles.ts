import { useMemo } from 'react';

import type { getColors } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

export function useThemedStyles<Styles>(createStyles: (colors: ReturnType<typeof getColors>) => Styles) {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors, createStyles]);
}
