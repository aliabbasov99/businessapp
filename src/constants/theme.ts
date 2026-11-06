export const Colors = {
  brand: '#054f96',
  brandLight: '#7FC2FA',
  brandSoft: '#B9DDFC',
  brandLink: '#1F5D9D',
  textPrimary: '#173D5F',
  textSecondary: '#60758A',
  textMuted: '#7B8B9C',
  placeholder: '#8CA0B3',
  border: '#E4EBF1',
  cardBorder: '#DCE6EE',
  divider: '#EDF2F6',
  screenBg: '#F2F5F8',
  sectionBg: '#F2F5F8',
  header: '#054F96',
  accent: '#054F96',
  raised: '#E9F3FE',
  identity: '#E5F2FE',
  inputShadow: '#123C60',
  trendUp: '#0A8165',
  trendUpBg: '#E4F4ED',
  trendDown: '#C44945',
  trendDownBg: '#FFEFED',
  danger: '#925046',
  white: '#FFFFFF',
  googleBlue: '#4285F4',
  googleRed: '#EA4335',
  googleYellow: '#FBBC05',
  googleGreen: '#34A853',
} as const;

export type ThemeName = 'light' | 'dark';

export const DarkColors = {
  brand: '#12385C',
  brandLight: '#3E8FD6',
  brandSoft: '#7FB3E0',
  brandLink: '#5EA3E8',
  textPrimary: '#E9F2FC',
  textSecondary: '#B0C3D7',
  textMuted: '#8FA3B5',
  placeholder: '#6E8299',
  border: '#30465D',
  cardBorder: '#30465D',
  divider: '#30465D',
  screenBg: '#0F1926',
  sectionBg: '#0F1926',
  header: '#12385C',
  accent: '#9BCEFF',
  raised: '#20334A',
  identity: '#20364F',
  inputShadow: '#000000',
  trendUp: '#8FE1B8',
  trendUpBg: '#193C35',
  trendDown: '#FFB4B7',
  trendDownBg: '#482B34',
  danger: '#E8A49B',
  white: '#182739',
  googleBlue: '#4285F4',
  googleRed: '#EA4335',
  googleYellow: '#FBBC05',
  googleGreen: '#34A853',
} as const;

export function getColors(theme: ThemeName) {
  return theme === 'dark' ? DarkColors : Colors;
}

export const Fonts = {
  regular: 'Raleway-Regular',
  medium: 'Raleway-Medium',
  semibold: 'Raleway-SemiBold',
  bold: 'Raleway-Bold',
} as const;
