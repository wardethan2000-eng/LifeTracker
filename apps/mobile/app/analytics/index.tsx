/**
 * Analytics overview screen — compliance, cost, and household stats.
 * Accessible via More → Analytics.
 */
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Card,
  Divider,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  getMe,
  getHouseholdDashboard,
  getScheduleComplianceDashboard,
  getHouseholdCostOverview,
} from "../../lib/api";

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
                <KvRow
                  label="On-time rate"
                  value={formatPct(compliance.overview?.onTimeRate)}
                />
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
                {costs.dashboard.spendByCategory?.slice(0, 5).map((cat) => (
                  <View key={cat.category}>
                    <Divider style={styles.divider} />
                    <KvRow
                      label={cat.categoryLabel ?? cat.category.replace(/_/g, " ")}
                      value={formatCurrency(cat.totalCost)}
                    />
                  </View>
                ))}
              </StatCard>
            )}

            {/* Spend forecast */}
            {costs?.forecast && (
              <StatCard title="🔮 Spend Forecast">
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
});
