/**
 * Analytics overview screen — compliance, cost, and household stats.
 * Accessible via More → Analytics.
 */
import { Dimensions, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Card,
  Divider,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { BarChart, LineChart, PieChart } from "react-native-gifted-charts";
import {
  getMe,
  getHouseholdDashboard,
  getScheduleComplianceDashboard,
  getHouseholdCostOverview,
} from "../../lib/api";

const SCREEN_WIDTH = Dimensions.get("window").width;
// Available chart width: full screen minus horizontal padding (16*2) and card padding (16*2)
const CHART_WIDTH = SCREEN_WIDTH - 64;

function KvRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.kvRow}>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: "600" }}>
        {value}
      </Text>
    </View>
  );
}

function StatCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content>
        <Text
          variant="titleSmall"
          style={{ color: theme.colors.onSurface, marginBottom: 10, fontWeight: "600" }}
        >
          {title}
        </Text>
        {children}
      </Card.Content>
    </Card>
  );
}

export default function AnalyticsScreen() {
  const theme = useTheme();

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });
  const householdId = me?.households[0]?.id ?? "";

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["household-dashboard", householdId],
    queryFn: () => getHouseholdDashboard(householdId),
    enabled: !!householdId,
  });

  const { data: compliance, isLoading: compLoading } = useQuery({
    queryKey: ["schedule-compliance", householdId],
    queryFn: () => getScheduleComplianceDashboard(householdId),
    enabled: !!householdId,
  });

  const { data: costs, isLoading: costsLoading } = useQuery({
    queryKey: ["cost-overview", householdId],
    queryFn: () => getHouseholdCostOverview(householdId),
    enabled: !!householdId,
  });

  const loading = meLoading || dashLoading || compLoading || costsLoading;

  const formatPct = (n?: number | null) =>
    n !== undefined && n !== null ? `${Math.round(n * 100)}%` : "—";
  const formatCurrency = (n?: number | null) =>
    n !== undefined && n !== null
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
      : "—";

  // ── Chart data ──────────────────────────────────────────────────────────────

  // Compliance donut: on-time vs missed
  const onTimePct = Math.round((compliance?.overview?.onTimeRate ?? 0) * 100);
  const compliancePieData = [
    { value: onTimePct, color: theme.colors.primary },
    { value: 100 - onTimePct, color: theme.colors.surfaceVariant },
  ];

  // Compliance trend: monthly on-time rate (last 12 months)
  const trendData = (compliance?.trend ?? []).slice(-12).map((pt) => ({
    value: Math.round(pt.onTimeRate * 100),
    label: pt.month.slice(5, 7),
  }));

  // Cost by category: top 5 (bar chart)
  const categoryBarData = (costs?.dashboard?.spendByCategory ?? [])
    .slice(0, 5)
    .map((cat) => ({
      value: cat.totalCost,
      label: (cat.categoryLabel ?? cat.category).slice(0, 6),
      frontColor: theme.colors.primary,
    }));

  // Monthly spend: last 12 months (bar chart)
  const monthlySpendData = (costs?.dashboard?.spendByMonth ?? [])
    .slice(-12)
    .map((m) => ({
      value: m.totalCost,
      label: m.month.slice(5, 7),
      frontColor: theme.colors.secondary,
    }));

  // Forecast: 3 / 6 / 12 month bars
  const forecastBarData = costs?.forecast
    ? [
        { value: costs.forecast.total3m, label: "3 mo", frontColor: theme.colors.primary },
        { value: costs.forecast.total6m, label: "6 mo", frontColor: theme.colors.primary },
        { value: costs.forecast.total12m, label: "12 mo", frontColor: theme.colors.primary },
      ]
    : [];

  const barChartWidth = CHART_WIDTH - 40; // leave room for y-axis labels

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
            Analytics
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
            Last 12 months
          </Text>
        </View>

        {loading && <ActivityIndicator style={{ marginTop: 32 }} />}

        {!loading && (
          <>
            {/* Household Stats */}
            {dashboard && (
              <StatCard title="📊 Household Overview">
                <KvRow label="Assets" value={String(dashboard.stats.assetCount)} />
                <Divider style={styles.divider} />
                <KvRow
                  label="Due soon"
                  value={String(dashboard.stats.dueScheduleCount)}
                />
                <Divider style={styles.divider} />
                <KvRow
                  label="Overdue"
                  value={String(dashboard.stats.overdueScheduleCount)}
                />
                <Divider style={styles.divider} />
                <KvRow
                  label="Unread notifications"
                  value={String(dashboard.stats.unreadNotificationCount)}
                />
              </StatCard>
            )}

            {/* Schedule Compliance */}
            {compliance && (
              <StatCard title="✅ Schedule Compliance">
                {/* On-time rate donut gauge */}
                <View style={styles.chartCentered}>
                  <PieChart
                    donut
                    data={compliancePieData}
                    radius={64}
                    innerRadius={48}
                    centerLabelComponent={() => (
                      <Text
                        variant="titleMedium"
                        style={{ color: theme.colors.onSurface, fontWeight: "700" }}
                      >
                        {`${onTimePct}%`}
                      </Text>
                    )}
                  />
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}
                  >
                    On-time rate
                  </Text>
                </View>

                {/* Monthly on-time rate trend */}
                {trendData.length > 1 && (
                  <View style={styles.chartBlock}>
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.colors.onSurfaceVariant, marginBottom: 6 }}
                    >
                      Monthly on-time rate (%)
                    </Text>
                    <LineChart
                      data={trendData}
                      width={barChartWidth}
                      height={100}
                      color={theme.colors.primary}
                      dataPointsColor={theme.colors.primary}
                      thickness={2}
                      maxValue={100}
                      noOfSections={4}
                      hideRules
                      areaChart
                      startFillColor={theme.colors.primary}
                      endFillColor={theme.colors.background}
                      startOpacity={0.3}
                      endOpacity={0.05}
                      curved
                      xAxisLabelTextStyle={{
                        color: theme.colors.onSurfaceVariant,
                        fontSize: 9,
                      }}
                      yAxisTextStyle={{
                        color: theme.colors.onSurfaceVariant,
                        fontSize: 9,
                      }}
                    />
                  </View>
                )}

                <Divider style={styles.divider} />
                <KvRow
                  label="Completed"
                  value={String(compliance.overview?.totalCompletions ?? "—")}
                />
                <Divider style={styles.divider} />
                <KvRow
                  label="Overdue"
                  value={String(compliance.overview?.currentOverdueCount ?? "—")}
                />
                <Divider style={styles.divider} />
                <KvRow
                  label="Late completions"
                  value={String(compliance.overview?.lateCompletions ?? "—")}
                />
              </StatCard>
            )}

            {/* Cost Overview */}
            {costs?.dashboard && (
              <StatCard title="💰 Cost Overview">
                <KvRow
                  label="Total spend"
                  value={formatCurrency(costs.dashboard.totalSpend)}
                />

                {/* Category bar chart */}
                {categoryBarData.length > 0 && (
                  <View style={styles.chartBlock}>
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.colors.onSurfaceVariant, marginBottom: 6 }}
                    >
                      Spend by category
                    </Text>
                    <BarChart
                      data={categoryBarData}
                      width={barChartWidth}
                      height={120}
                      barWidth={Math.max(20, Math.floor(barChartWidth / (categoryBarData.length * 2)))}
                      spacing={12}
                      hideRules
                      hideYAxisText
                      roundedTop
                      xAxisLabelTextStyle={{
                        color: theme.colors.onSurfaceVariant,
                        fontSize: 9,
                      }}
                      noOfSections={3}
                    />
                  </View>
                )}

                {costs.dashboard.spendByCategory?.slice(0, 5).map((cat) => (
                  <View key={cat.category}>
                    <Divider style={styles.divider} />
                    <KvRow
                      label={cat.categoryLabel ?? cat.category.replace(/_/g, " ")}
                      value={formatCurrency(cat.totalCost)}
                    />
                  </View>
                ))}

                {/* Monthly spend bar chart */}
                {monthlySpendData.length > 1 && (
                  <View style={[styles.chartBlock, { marginTop: 12 }]}>
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.colors.onSurfaceVariant, marginBottom: 6 }}
                    >
                      Monthly spend
                    </Text>
                    <BarChart
                      data={monthlySpendData}
                      width={barChartWidth}
                      height={100}
                      barWidth={Math.max(8, Math.floor(barChartWidth / (monthlySpendData.length * 2)))}
                      spacing={6}
                      hideRules
                      hideYAxisText
                      xAxisLabelTextStyle={{
                        color: theme.colors.onSurfaceVariant,
                        fontSize: 9,
                      }}
                      noOfSections={3}
                    />
                  </View>
                )}
              </StatCard>
            )}

            {/* Spend forecast */}
            {costs?.forecast && (
              <StatCard title="🔮 Spend Forecast">
                {/* 3 / 6 / 12 month forecast bar chart */}
                <View style={styles.chartBlock}>
                  <BarChart
                    data={forecastBarData}
                    width={barChartWidth}
                    height={100}
                    barWidth={Math.floor(barChartWidth / 6)}
                    spacing={Math.floor(barChartWidth / 6)}
                    hideRules
                    hideYAxisText
                    roundedTop
                    xAxisLabelTextStyle={{
                      color: theme.colors.onSurfaceVariant,
                      fontSize: 11,
                    }}
                    noOfSections={3}
                  />
                </View>
                <KvRow
                  label="Next 3 months"
                  value={formatCurrency(costs.forecast.total3m)}
                />
                <Divider style={styles.divider} />
                <KvRow
                  label="Next 6 months"
                  value={formatCurrency(costs.forecast.total6m)}
                />
                <Divider style={styles.divider} />
                <KvRow
                  label="Next 12 months"
                  value={formatCurrency(costs.forecast.total12m)}
                />
              </StatCard>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  header: { marginBottom: 4 },
  card: {},
  kvRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  divider: { marginVertical: 2 },
  chartCentered: { alignItems: "center", marginVertical: 12 },
  chartBlock: { marginVertical: 8, overflow: "hidden" },
});
