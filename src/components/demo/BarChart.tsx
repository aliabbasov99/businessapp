import { useDatabase } from '@/hooks/use-database';
import { createReports } from '@/data/reports';
import { useLocale } from '@/context/LocaleContext';
import LineChartBase from './LineChartBase';

export default function BarChart({
  showTitle = true,
  bare = false,
  period = 0,
}: {
  showTitle?: boolean;
  bare?: boolean;
  period?: number;
}) {
  useDatabase();
  const { locale } = useLocale();
  const data = createReports(null, locale)[1].data;
  return (
    <LineChartBase
      title="Anbar Analizi"
      showTitle={showTitle}
      bare={bare}
      period={period}
      data={data}
    />
  );
}
