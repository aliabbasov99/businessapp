import { useDatabase } from '@/hooks/use-database';
import { getOverviewCards, type CardKey, type Metric, type OverviewCard } from '@/data/overview';
import { formatMoney, formatNumber, formatPercent } from '@/utils/format';
import { carouselOffset, dragCarouselPosition, previewCarouselPosition, wrapCarouselIndex } from '@/utils/carousel';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { LocalizedText as Text } from '@/components/localized-text';
import { useLocale } from '@/context/LocaleContext';
import { useTheme } from '@/context/ThemeContext';
import { AzerbaijaniManat, Building, Package, Wallet } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { Fonts, getColors } from '@/constants/theme';

export type { CardKey } from '@/data/overview';

const CARD_HEIGHT = 212;
const SNAP_SPRING = { stiffness: 220, damping: 28, mass: 1, overshootClamping: false };

type StatCardData = OverviewCard & { icon: (color: string) => ReactNode; tint: string };

const CARD_STYLES: Record<CardKey, { icon: (color: string) => ReactNode; tint: string }> = {
  dovriyye: { icon: color => <AzerbaijaniManat size={17} color={color} strokeWidth={2} />, tint: '#EEF4FD' },
  anbar: { icon: color => <Package size={17} color={color} strokeWidth={1.8} />, tint: '#F2FAFF' },
  techizatcilar: { icon: color => <Building size={17} color={color} strokeWidth={1.8} />, tint: '#F4F6FE' },
  kassa: { icon: color => <Wallet size={17} color={color} strokeWidth={1.8} />, tint: '#EFF8FB' },
};

function metricValue(metric: Metric, locale: string) {
  return metric.unit === 'money' ? formatMoney(metric.value, locale) : formatNumber(metric.value, locale);
}

function TrendPill({ change }: { change: number }) {
  const styles = useThemedStyles(createStyles);
  const { locale } = useLocale();
  const up = change >= 0;
  return (
    <View style={[styles.trendPill, up ? styles.trendPillUp : styles.trendPillDown]}>
      <Text style={[styles.trendText, up ? styles.trendTextUp : styles.trendTextDown]}>
        {formatPercent(change, locale, true)}
      </Text>
    </View>
  );
}

function MetricRow({ metric, privacy, big }: { metric: Metric; privacy: boolean; big?: boolean }) {
  const styles = useThemedStyles(createStyles);
  const { locale } = useLocale();
  return (
    <View>
      <Text style={styles.metricLabel} numberOfLines={1}>
        {metric.label}
      </Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, big && styles.metricValueBig]} numberOfLines={1}>
          {privacy ? (metric.unit === 'money' ? '••• ₼' : '•••') : metricValue(metric, locale)}
        </Text>
        {!privacy ? <TrendPill change={metric.changePercent} /> : null}
      </View>
    </View>
  );
}

type DeckCardProps = {
  card: StatCardData;
  index: number;
  count: number;
  position: SharedValue<number>;
  width: number;
  step: number;
  active: boolean;
  interactive: boolean;
  privacy: boolean;
  onPress: () => void;
};

function DeckCard({ card, count, index, position, width, step, active, interactive, privacy, onPress }: DeckCardProps) {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t, locale } = useLocale();
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const d = carouselOffset(index, position.get(), count);

    const x = interpolate(d, [-2, -1, 0, 1, 2], [-step * 2, -step, 0, step, step * 2], Extrapolation.CLAMP);
    const scale = interpolate(d, [-2, -1, 0, 1, 2], [0.7, 0.85, 1, 0.85, 0.7], Extrapolation.CLAMP);
    const shadowOpacity = interpolate(d, [-2, -1, 0, 1, 2], [0, 0.12, 0.3, 0.12, 0], Extrapolation.CLAMP);
    const zIndex = Math.abs(d) < 0.5 ? 10 : Math.abs(d) < 1.5 ? 5 : 1;

    const opacity = interpolate(d, [-2, -1, 0, 1, 2], [0, 0.7, 1, 0.7, 0], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ translateX: x }, { scale }],
      shadowOpacity,
      zIndex,
    };
  });

  return (
    <Animated.View
      pointerEvents={interactive ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      style={[styles.deckCard, { width, backgroundColor: isDark ? colors.raised : card.tint }, animatedStyle]}>
      <Pressable
        style={styles.deckPressable}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={t(card.title)}>
        <View style={[styles.ring, styles.ringTop]} />
        <View style={[styles.ring, styles.ringBottom]} />

        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{card.title}</Text>
          <View style={styles.iconBox}>{card.icon(colors.accent)}</View>
        </View>

        <MetricRow metric={card.main} privacy={privacy} big />

        <View style={styles.detailsBox}>
          {card.details.map((metric, i) => (
            <View
              key={metric.label}
              style={[styles.detailCell, i === 1 && styles.detailCellRight]}>
              <Text style={styles.detailLabel} numberOfLines={1}>
                {metric.label}
              </Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {privacy ? (metric.unit === 'money' ? '••• ₼' : '•••') : metricValue(metric, locale)}
              </Text>
              {!privacy ? <TrendPill change={metric.changePercent} /> : null}
            </View>
          ))}
        </View>
      </Pressable>
    </Animated.View>
  );
}

type StatCarouselProps = {
  privacy: boolean;
  /** Aktiv kartın siyahısını qaytarır: dovriyye → çeklər, anbar → məhsullar və s. */
  renderList?: (key: CardKey) => ReactNode;
};

export function StatCarousel({ privacy, renderList }: StatCarouselProps) {
  useDatabase();
  const CARDS: StatCardData[] = getOverviewCards().map(card => ({ ...card, ...CARD_STYLES[card.key] }));
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 60, 420);
  const step = cardWidth * 0.6;
  const count = CARDS.length;
  const position = useSharedValue(0);
  const previewPosition = useSharedValue(0);
  const dragBase = useSharedValue(0);
  const dragging = useSharedValue(false);
  const swiped = useSharedValue(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const preview = (index: number) => {
    'worklet';
    if (index === previewPosition.get()) return;
    previewPosition.set(index);
    runOnJS(setActiveIndex)(wrapCarouselIndex(index, count));
  };

  const settle = () => {
    'worklet';
    // The displayed list and the release target share the same selection.
    // Releasing the finger must never make a second, velocity-based decision.
    position.set(withSpring(previewPosition.get(), SNAP_SPRING));
  };

  const goTo = (index: number) => {
    cancelAnimation(position);
    const current = Math.round(position.get());
    preview(current + carouselOffset(index, current, count));
    settle();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .maxPointers(1)
    .onBegin(() => {
      'worklet';
      swiped.set(false);
    })
    .onStart(() => {
      'worklet';
      cancelAnimation(position);
      dragBase.set(position.get());
      preview(previewCarouselPosition(position.get(), previewPosition.get()));
      dragging.set(true);
      swiped.set(true);
    })
    .onUpdate((event) => {
      'worklet';
      const next = dragCarouselPosition(dragBase.get(), event.translationX, step);
      position.set(next);
      preview(previewCarouselPosition(next, previewPosition.get()));
    })
    .onEnd((_event, success) => {
      'worklet';
      if (success) settle();
    })
    .onFinalize((_event, success) => {
      'worklet';
      if (!success && dragging.get()) settle();
      dragging.set(false);
    });

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={pan}>
        <View style={styles.deck}>
          {CARDS.map((card, index) => (
            <DeckCard
              key={card.key}
              card={card}
              count={count}
              index={index}
              position={position}
              width={cardWidth}
              step={step}
              active={index === activeIndex}
              interactive={Math.abs(carouselOffset(index, activeIndex, count)) <= 1}
              privacy={privacy}
              onPress={() => {
                // A card press delivered after a pan must not undo that swipe.
                if (!swiped.get()) goTo(index);
              }}
            />
          ))}
        </View>
      </GestureDetector>

      {renderList ? (
        <Animated.View
          key={CARDS[activeIndex].key}
          entering={FadeIn.duration(160)}
          style={styles.listWrap}>
          {renderList(CARDS[activeIndex].key)}
        </Animated.View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  wrap: {
    marginBottom: 6,
  },
  listWrap: {
    marginTop: 22,
  },
  deck: {
    height: CARD_HEIGHT,
    width: '100%',
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckCard: {
    position: 'absolute',
    height: CARD_HEIGHT,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    justifyContent: 'space-between',
    shadowColor: '#174F81',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
  },
  deckPressable: {
    flex: 1,
    paddingVertical: 17,
    paddingHorizontal: 18,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
  },
  ringTop: {
    width: 170,
    height: 170,
    top: -96,
    right: -52,
    borderWidth: 21,
    borderColor: 'rgba(127,194,250,0.14)',
  },
  ringBottom: {
    width: 210,
    height: 210,
    bottom: -170,
    left: -130,
    borderWidth: 33,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: colors.accent,
  },
  iconBox: {
    width: 31,
    height: 31,
    borderRadius: 11,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  metricValue: {
    fontFamily: Fonts.semibold,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  metricValueBig: {
    fontSize: 27,
    letterSpacing: -1,
  },
  trendPill: {
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  trendPillUp: {
    backgroundColor: colors.trendUpBg,
    borderColor: colors.border,
  },
  trendPillDown: {
    backgroundColor: colors.trendDownBg,
    borderColor: colors.border,
  },
  trendText: {
    fontFamily: Fonts.medium,
    fontSize: 10.5,
    lineHeight: 13,
  },
  trendTextUp: {
    color: colors.trendUp,
  },
  trendTextDown: {
    color: colors.trendDown,
  },
  detailsBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  detailCell: {
    flex: 1,
    gap: 4,
  },
  detailCellRight: {
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  detailLabel: {
    fontFamily: Fonts.regular,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  detailValue: {
    fontFamily: Fonts.semibold,
    fontSize: 12.5,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
});
