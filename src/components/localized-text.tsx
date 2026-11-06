import { Children, type ReactNode } from 'react';
import { Text, type TextProps } from 'react-native';

import { useLocale } from '@/context/LocaleContext';

export function LocalizedText({ children, ...props }: TextProps) {
  const { t } = useLocale();
  const translateChild = (child: ReactNode): ReactNode => {
    if (typeof child !== 'string' || !child.trim()) return child;
    return child.replace(child.trim(), t(child.trim()));
  };
  return <Text {...props}>{Children.map(children, translateChild)}</Text>;
}
