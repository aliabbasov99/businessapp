import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { LocaleProvider } from '@/context/LocaleContext';
import { DataProvider } from '@/context/DataProvider';
import { PreferencesProvider } from '@/context/PreferencesContext';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { colors, isDark } = useTheme();

  return (
    <PreferencesProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.white },
          animation: 'none',
        }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="login" options={{ animation: 'none' }} />
        <Stack.Screen name="login_page_phone" />
        <Stack.Screen name="login_page_code" />
        <Stack.Screen name="forgot_password" />
        <Stack.Screen name="demo" options={{ animation: 'none' }} />
        <Stack.Screen name="profile" />
        <Stack.Screen name="profile_detail" />
      </Stack>
    </PreferencesProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Montserrat-Regular': require('../../assets/fonts/Montserrat-Regular.ttf'),
    'Montserrat-Medium': require('../../assets/fonts/Montserrat-Medium.ttf'),
    'Montserrat-SemiBold': require('../../assets/fonts/Montserrat-SemiBold.ttf'),
    'Montserrat-Bold': require('../../assets/fonts/Montserrat-Bold.ttf'),
    'Raleway-Regular': require('../../assets/fonts/Raleway-Regular.ttf'),
    'Raleway-Medium': require('../../assets/fonts/Raleway-Medium.ttf'),
    'Raleway-SemiBold': require('../../assets/fonts/Raleway-SemiBold.ttf'),
    'Raleway-Bold': require('../../assets/fonts/Raleway-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <LocaleProvider>
          <DataProvider><RootNavigator /></DataProvider>
        </LocaleProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
