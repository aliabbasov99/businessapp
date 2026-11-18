import { useEventListener } from 'expo';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { getPendingAuth } from '@/utils/pending-auth';

// 21:9 portrait intro. `contentFit="cover"` fills 21:9 screens edge to edge
// and crops the top and bottom on 16:9 screens.
const introVideo = require('@/assets/videos/intro.mp4');

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
    (async () => {
      // A pending account skips the login form entirely: open the approval
      // screen and let it sign in automatically once the admin approves.
      const pending = await getPendingAuth().catch(() => null);
      router.replace(pending ? '/pending_approval' : '/login');
    })();
  }, []);

  useEffect(() => {
    // The intro runs for ~6.1s. Keep an extra second as a fallback in case
    // playback never starts; `playToEnd` normally navigates first.
    const timer = setTimeout(() => {
      goToLogin();
    }, 7000);

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
        contentFit="cover"
        nativeControls={false}
        playsInline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
