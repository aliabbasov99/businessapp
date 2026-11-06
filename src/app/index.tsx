import { useEventListener } from 'expo';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

const introVideo =
  Platform.OS === 'ios'
    ? require('@/assets/videos/intro.mov')
    : require('@/assets/videos/intro.mp4');

export default function IntroScreen() {
  const player = useVideoPlayer(introVideo, playerInstance => {
    playerInstance.loop = false;
    playerInstance.muted = true;
    playerInstance.play();
  });

  const hasNavigated = useRef(false);

  const goToLogin = useCallback(() => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    router.replace('/login');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      goToLogin();
    }, 3200);

    return () => clearTimeout(timer);
  }, [goToLogin]);

  useEventListener(player, 'playToEnd', () => {
    goToLogin();
  });

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') {
      goToLogin();
    }
  });

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <VideoView
        style={styles.video}
        player={player}
        contentFit="contain"
        nativeControls={false}
        playsInline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
