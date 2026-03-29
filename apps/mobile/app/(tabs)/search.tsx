import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import { ActivityIndicator, Chip, Searchbar, Snackbar, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { getMe, searchHousehold } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { storage } from "../../lib/storage";
import { STORAGE_KEYS } from "../../lib/constants";

const ENTITY_ICONS: Record<string, string> = {
  asset: "🔧",
  project: "📁",
  hobby: "🎨",
  idea: "💡",
  entry: "📝",
  inventory_item: "📦",
  schedule: "🗓️",
  log: "📋",
  comment: "💬",
};

function loadRecentSearches(): string[] {
  try {
    const raw = storage.getString(STORAGE_KEYS.RECENT_SEARCHES);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function saveRecentSearches(searches: string[]) {
  storage.set(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(searches.slice(0, 10)));
}

function addRecentSearch(q: string) {
  const existing = loadRecentSearches();
  const updated = [q, ...existing.filter((s) => s !== q)].slice(0, 10);
  saveRecentSearches(updated);
}

export default function SearchScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const [snackVisible, setSnackVisible] = useState(false);

  const MOBILE_ENTITY_TYPES = new Set(["asset", "project", "hobby", "idea", "entry"]);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  // Debounce search input 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading: searching } = useQuery({
    queryKey: ["search", householdId, debouncedQuery],
    queryFn: () => searchHousehold(householdId, debouncedQuery, { limit: 30 }),
    enabled: !!householdId && debouncedQuery.length >= 2,
  });

  function handleSearch(q: string) {
    setQuery(q);
  }

  function chooseRecent(q: string) {
    setQuery(q);
  }

  function clearRecents() {
    saveRecentSearches([]);
    setRecentSearches([]);
  }

  // Save search to recents when results arrive
  useEffect(() => {
    if (debouncedQuery.length >= 2 && results) {
      addRecentSearch(debouncedQuery);
      setRecentSearches(loadRecentSearches());
    }
  }, [debouncedQuery, results]);

  const allResults = results?.groups.flatMap((g) =>
    g.results.map((r) => ({ ...r, groupLabel: g.label }))
  ) ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.searchBarWrap}>
        <Searchbar
          placeholder="Search assets, projects, notes…"
          value={query}
          onChangeText={handleSearch}
          style={{ backgroundColor: theme.colors.surface }}
          autoFocus
        />
      </View>

      {/* Recent searches — shown when input empty */}
      {!debouncedQuery && recentSearches.length > 0 && (
        <View style={styles.recentsWrap}>
          <View style={styles.recentsHeader}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              Recent
            </Text>
            <TouchableOpacity onPress={clearRecents}>
              <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
                Clear
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chips}>
            {recentSearches.map((s) => (
              <Chip key={s} onPress={() => chooseRecent(s)} style={styles.chip}>
                {s}
              </Chip>
            ))}
          </View>
        </View>
      )}

      {/* Searching indicator */}
      {debouncedQuery.length >= 2 && searching && (
        <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loader} />
      )}

      {/* Results */}
      {debouncedQuery.length >= 2 && !searching && (
        <FlatList
          data={allResults}
          keyExtractor={(item) => `${item.entityType}-${item.entityId}`}
          contentContainerStyle={styles.resultList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.resultRow, { borderBottomColor: theme.colors.outlineVariant }]}
              onPress={() => {
                if (!MOBILE_ENTITY_TYPES.has(item.entityType)) {
                  setSnackVisible(true);
                  return;
                }
                const path = item.entityUrl.startsWith("/") ? item.entityUrl : `/${item.entityUrl}`;
                router.push(path as Parameters<typeof router.push>[0]);
              }}
            >
              <Text style={styles.entityIcon}>{ENTITY_ICONS[item.entityType] ?? "🔍"}</Text>
              <View style={styles.resultInfo}>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                ) : null}
                <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
                  {item.groupLabel}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState icon="🔍" title={`No results for "${debouncedQuery}"`} />
          }
        />
      )}

      {/* Prompt when query too short */}
      {debouncedQuery.length > 0 && debouncedQuery.length < 2 && (
        <View style={styles.loader}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
            Keep typing…
          </Text>
        </View>
      )}
      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={2500}
      >
        Not available in the mobile app yet
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBarWrap: { padding: 12, paddingBottom: 4 },
  recentsWrap: { padding: 16, gap: 8 },
  recentsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {},
  loader: { marginTop: 20, alignItems: "center" },
  resultList: { paddingBottom: 24 },
  resultRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  entityIcon: { fontSize: 20 },
  resultInfo: { flex: 1 },
});
