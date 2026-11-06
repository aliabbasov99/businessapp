import { useThemedStyles } from '@/hooks/use-themed-styles';
import { LocalizedText as Text } from '@/components/localized-text';
import { useTheme } from '@/context/ThemeContext';
import { useLocale } from '@/context/LocaleContext';
import { Fonts, getColors } from '@/constants/theme';
import type { PeriodData } from '@/data/schema';
import { useId, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

export type { PeriodData, SeriesItem } from '@/data/schema';

interface Props {
  title: string;
  showTitle?: boolean;
  /** true olarsa kart çərçivəsi/başlıq olmadan (ReportCard daxilində) çəkilir */
  bare?: boolean;
  period: number;
  data: PeriodData[];
  privacy?: boolean;
}

/* ---------- Yardımçı funksiyalar ---------- */

const trim = (n: number) => String(Math.round(n * 10) / 10);

export function formatAxis(v: number) {
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${sign}${trim(a / 1_000_000)}M`;
  if (a >= 1_000) return `${sign}${trim(a / 1_000)}K`;
  return `${sign}${trim(a)}`;
}

/** Data-dan "yaxşı" ox aralığı seçir (≈5 interval). */
function niceAxis(min: number, max: number) {
  const lo = Math.min(min, 0);
  const hi = Math.max(max, 0);
  const span = hi - lo || 1;
  const raw = span / 5;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = [1, 2, 2.5, 3, 5, 6, 10].map(m => m * pow);
  const step = steps.find(s => s >= raw) ?? 10 * pow;
  return {
    yMin: Math.floor(lo / step) * step,
    yMax: Math.ceil(hi / step) * step,
    yStep: step,
  };
}

type Pt = { x: number; y: number };

/** Monoton kubik interpolyasiya — xətt nöqtələrin arasında "dalğalanmır". */
function monotonePath(pts: Pt[]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;

  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    m[i] = (pts[i + 1].y - pts[i].y) / dx[i];
  }
  const t: number[] = new Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    t[i] =
      m[i - 1] * m[i] <= 0
        ? 0
        : (3 * (dx[i - 1] + dx[i])) /
          ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  }

  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i].x + h},${pts[i].y + t[i] * h} ${pts[i + 1].x - h},${
      pts[i + 1].y - t[i + 1] * h
    } ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

/* ---------- Komponent ---------- */

export default function LineChartBase({ title, showTitle = true, bare = false, period, data, privacy = false }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useLocale();
  const [plotWidth, setPlotWidth] = useState(345);
  const cfg = data[period] ?? data[0];
  const { labels, series } = cfg;
  const n = labels.length;
  const rotate = n > 8;
  const VB_W = bare ? Math.max(220, plotWidth) : 330;
  const PLOT_L = bare ? 42 : 44;
  const PLOT_R = bare ? VB_W - (rotate ? 8 : 17) : 324;
  const PLOT_T = 15;
  const PLOT_B = bare && !rotate ? 182 : 199;

  const [selected, setSelected] = useState<{ seriesIdx: number; pointIdx?: number } | null>(null);
  // Sabit, təkrar-yaradıcı (idempotent) id: React-in useId generatorundan alınır
  const gid = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  // period dəyişəndə seçim sıfırlansın
  const [lastPeriod, setLastPeriod] = useState(period);
  if (lastPeriod !== period) {
    setLastPeriod(period);
    setSelected(null);
  }

  const all = series.flatMap(s => s.values);
  const auto = niceAxis(Math.min(...all), Math.max(...all));
  const yMin = cfg.yMin ?? auto.yMin;
  const yMax = cfg.yMax ?? auto.yMax;
  const yStep = cfg.yStep ?? auto.yStep;

  const tickCount = Math.round((yMax - yMin) / yStep);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => yMin + i * yStep);

  const vbH = bare ? (rotate ? 270 : 214) : (rotate ? 252 : 224);
  const bandW = (PLOT_R - PLOT_L) / n;
  const xAt = (i: number) => bare ? PLOT_L + i / Math.max(1, n - 1) * (PLOT_R - PLOT_L) : PLOT_L + (i + 0.5) * bandW;
  const yAt = (v: number) => {
    const y = PLOT_B - ((v - yMin) / (yMax - yMin || 1)) * (PLOT_B - PLOT_T);
    return Number.isFinite(y) ? y : PLOT_B;
  };

  const handlePointPress = (seriesIdx: number, pointIdx: number) => {
    if (selected?.seriesIdx === seriesIdx && selected?.pointIdx === pointIdx) setSelected(null);
    else setSelected({ seriesIdx, pointIdx });
  };

  const handleLegendPress = (seriesIdx: number) => {
    if (selected?.seriesIdx === seriesIdx && selected?.pointIdx === undefined) setSelected(null);
    else setSelected({ seriesIdx });
  };

  /* Tooltip */
  const activeSeries = selected ? series[selected.seriesIdx] : null;
  const pickedIdx = selected?.pointIdx;
  let tooltipEl: React.ReactNode = null;
  if (activeSeries && pickedIdx !== undefined) {
    const val = activeSeries.values[pickedIdx];
    const cx = xAt(pickedIdx);
    const cy = yAt(val);
    const valText = privacy ? '•••' : `${val.toLocaleString('en-US')}${activeSeries.isCurrency ? ' ₼' : ''}`;
    const bw = Math.max(54, valText.length * 6.8 + 14);
    const bx = Math.max(PLOT_L - 4, Math.min(PLOT_R + 4 - bw, cx - bw / 2));
    const isAbove = cy - 28 >= 6;
    const by = isAbove ? cy - 28 : cy + 10;
    const tail = isAbove
      ? `${cx - 4},${by + 20} ${cx + 4},${by + 20} ${cx},${cy - 4}`
      : `${cx - 4},${by + 2} ${cx + 4},${by + 2} ${cx},${cy + 4}`;
    tooltipEl = (
      <>
        <Polygon points={tail} fill={activeSeries.color} />
        <Rect x={bx} y={by} width={bw} height={22} rx={5} fill={activeSeries.color} />
        <SvgText
          x={bx + bw / 2}
          y={by + 14.5}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="10"
          fontFamily={Fonts.bold}>
          {valText}
        </SvgText>
      </>
    );
  }

  const zeroY = yAt(0);

  return (
    <View style={bare ? styles.bare : styles.wrap}>
      {!bare && (
        <View style={styles.accent}>
          <View style={styles.accentLeft} />
          <View style={styles.accentRight} />
        </View>
      )}
      {showTitle && !bare && <Text style={styles.title}>{title}</Text>}

      {/* Legend */}
      <View style={[styles.legendRow, bare && styles.reportLegendRow]}>
        {series.map((s, idx) => {
          const isSelected = selected?.seriesIdx === idx;
          const isDimmed = selected !== null && !isSelected;
          return (
            <Pressable
              key={s.key}
              accessibilityRole="button"
              accessibilityLabel={t(s.name)}
              accessibilityState={{ selected: isSelected }}
              onPress={() => handleLegendPress(idx)}
              style={[
                styles.legendItem,
                bare && styles.reportLegendItem,
                isDimmed && styles.legendItemDimmed,
                isSelected && !bare && styles.legendItemActive,
              ]}>
              <View style={[styles.ring, { borderColor: s.color, backgroundColor: `${s.color}14` }]} />
              <Text style={[styles.legendText, bare && styles.reportLegendText, isSelected && styles.legendTextActive]}>{s.name}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Chart */}
      <View
        onLayout={bare ? event => setPlotWidth(event.nativeEvent.layout.width) : undefined}
        style={bare ? { height: vbH } : { aspectRatio: VB_W / vbH, marginTop: 4 }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${vbH}`} preserveAspectRatio="xMidYMid meet">
          <Defs>
            {series
              .filter(s => s.area)
              .map(s => (
                <LinearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={s.color} stopOpacity={0.16} />
                  <Stop offset="1" stopColor={s.color} stopOpacity={0.04} />
                </LinearGradient>
              ))}
          </Defs>

          {/* Fon — toxununca seçimi ləğv edir */}
          <Rect x="0" y="0" width={VB_W} height={vbH} fill="rgba(0,0,0,0.001)" onPress={() => setSelected(null)} />

          {/* Üfüqi şəbəkə + Y yazıları */}
          {ticks.map((v, i) => (
            <Line
              key={`h${i}`}
              x1={PLOT_L}
              x2={PLOT_R}
              y1={yAt(v)}
              y2={yAt(v)}
              stroke={colors.border}
              strokeWidth={0.7}
            />
          ))}
          {ticks.map((v, i) => (
            <SvgText
              key={`yl${i}`}
              x={PLOT_L - 6}
              y={yAt(v) + 3.5}
              textAnchor="end"
              fill={colors.textMuted}
              fontSize="9.5"
              fontFamily={Fonts.regular}>
              {privacy ? '•••' : formatAxis(v)}
            </SvgText>
          ))}
          {/* Mənfi dəyərlər olanda sıfır xətti qabarıq */}
          {yMin < 0 && (
            <Line x1={PLOT_L} x2={PLOT_R} y1={zeroY} y2={zeroY} stroke={colors.border} strokeWidth={1} />
          )}

          {/* Şaquli şəbəkə + X yazıları */}
          {labels.map((_, i) => (
            <Line
              key={`v${i}`}
              x1={xAt(i)}
              x2={xAt(i)}
              y1={PLOT_T}
              y2={PLOT_B}
              stroke={colors.border}
              strokeWidth={0.6}
            />
          ))}
          {labels.map((label, i) => {
            if (bare && rotate && VB_W < 290 && i % 2 && i !== n - 1) return null;
            const x = xAt(i);
            return rotate ? (
              <SvgText
                key={`xl${i}`}
                x={x + 3}
                y={PLOT_B + 14}
                transform={`rotate(${bare ? -38 : -45}, ${x + 3}, ${PLOT_B + 14})`}
                textAnchor="end"
                fill={colors.textMuted}
                fontSize="9.5"
                fontFamily={Fonts.regular}>
                {t(label)}
              </SvgText>
            ) : (
              <SvgText
                key={`xl${i}`}
                x={x}
                y={PLOT_B + 16}
                textAnchor="middle"
                fill={colors.textMuted}
                fontSize="9.5"
                fontFamily={Fonts.regular}>
                {t(label)}
              </SvgText>
            );
          })}

          {/* Sahə (area) */}
          {series.map((s, idx) => {
            if (!s.area) return null;
            const pts = s.values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
            const base = yMin < 0 ? zeroY : PLOT_B;
            const d = `${monotonePath(pts)} L${pts[pts.length - 1].x},${base} L${pts[0].x},${base} Z`;
            const dim = selected !== null && selected.seriesIdx !== idx;
            return (
              <Path key={`a_${s.key}`} d={d} fill={bare ? s.color : `url(#${gid}-${s.key})`} opacity={bare ? (dim ? 0.012 : 0.075) : (dim ? 0.25 : 1)} />
            );
          })}

          {/* Xətlər */}
          {series.map((s, idx) => {
            const active = selected === null || selected.seriesIdx === idx;
            return (
              <Path
                key={`p_${s.key}`}
                d={monotonePath(s.values.map((v, i) => ({ x: xAt(i), y: yAt(v) })))}
                stroke={s.color}
                strokeWidth={selected?.seriesIdx === idx ? 2.8 : bare ? 2 : 2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={active ? 1 : 0.18}
              />
            );
          })}

          {/* Nöqtələr (ağ içli halqa) */}
          {series.map((s, idx) => {
            const active = selected === null || selected.seriesIdx === idx;
            return s.values.map((v, j) => {
              const picked = selected?.seriesIdx === idx && selected?.pointIdx === j;
              return (
                <Circle
                  key={`c_${s.key}_${j}`}
                  cx={xAt(j)}
                  cy={yAt(v)}
                  r={picked ? 4.5 : 3.4}
                  fill={picked ? s.color : bare ? `${s.color}14` : colors.white}
                  stroke={picked ? '#FFFFFF' : s.color}
                  strokeWidth={picked ? 2 : 1.9}
                  opacity={active ? 1 : 0.18}
                />
              );
            });
          })}

          {tooltipEl}

          {/* Toxunma sahələri */}
          {series.map((s, idx) =>
            s.values.map((v, j) => (
              <Circle
                key={`hit_${s.key}_${j}`}
                cx={xAt(j)}
                cy={yAt(v)}
                r={n > 8 ? 9 : 14}
                fill="rgba(0,0,0,0.001)"
                onPress={() => handlePointPress(idx, j)}
              />
            )),
          )}
        </Svg>
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    marginBottom: 15,
    marginHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 15,
    paddingBottom: 14,
    overflow: 'hidden',
    shadowColor: '#054F96',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  bare: {},
  accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, flexDirection: 'row' },
  accentLeft: { flex: 1, backgroundColor: colors.header },
  accentRight: { flex: 1, backgroundColor: '#7FC2FA' },
  title: {
    color: colors.accent,
    fontFamily: Fonts.bold,
    fontSize: 16,
    letterSpacing: -0.3,
    marginTop: 2,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 10,
    rowGap: 4,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 5,
  },
  legendItemDimmed: { opacity: 0.35 },
  legendItemActive: { backgroundColor: colors.raised },
  reportLegendRow: { marginTop: 0, marginBottom: 7, paddingHorizontal: 4, columnGap: 8, rowGap: 0 },
  reportLegendItem: { minHeight: 34, paddingHorizontal: 0, gap: 4 },
  reportLegendText: { fontSize: 10 },
  ring: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: colors.white,
  },
  legendText: { color: colors.textSecondary, fontFamily: Fonts.regular, fontSize: 9.5 },
  legendTextActive: { color: colors.textPrimary, fontFamily: Fonts.semibold },
});
