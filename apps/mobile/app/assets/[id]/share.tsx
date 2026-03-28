/**
 * Share link management for an asset.
 * Lists existing share links, allows creating new ones, copying URLs, and revoking.
 */
import { Alert, FlatList, Share, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Divider,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import {
  createShareLink,
  getMe,
  getShareLinks,
  revokeShareLink,
} from "../../../lib/api";
import type { ShareLink } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";

const SHARE_BASE_URL =
  process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? "https://app.lifekeeper.app";

function linkUrl(token: string) {
  return `${SHARE_BASE_URL}/share/${token}`;
}

export default function AssetShareScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: links, isLoading } = useQuery({
    queryKey: ["share-links", householdId, id],
    queryFn: () => getShareLinks(householdId, id!),
    enabled: !!householdId && !!id,
  });

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () => createShareLink(householdId, id!),
    onSuccess: (link) => {
      queryClient.invalidateQueries({ queryKey: ["share-links", householdId, id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      copyToClipboard(link.token);
    },
  });

  const { mutate: revoke } = useMutation({
    mutationFn: (linkId: string) => revokeShareLink(householdId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share-links", householdId, id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
  });

  const copyToClipboard = async (token: string) => {
    try {
      await Share.share({ message: linkUrl(token), url: linkUrl(token) });
    } catch {
      // user cancelled or share not available — silently ignore
    }
  };

  const confirmRevoke = (linkId: string) => {
    Alert.alert(
      "Revoke Link",
      "This link will stop working immediately. Anyone with it won't be able to access the asset.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: () => revoke(linkId),
        },
      ]
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.headerRow}>
        <Button
          icon="arrow-left"
          mode="text"
          onPress={() => router.back()}
          labelStyle={{ color: theme.colors.onSurfaceVariant }}
        >
          Back
        </Button>
        <Text
          variant="headlineSmall"
          style={{ flex: 1, color: theme.colors.onBackground }}
        >
          Share Links
        </Text>
      </View>

      <View style={styles.createRow}>
        <Button
          mode="contained"
          icon="link-plus"
          onPress={() => create()}
          loading={creating}
          disabled={creating || !householdId}
          style={{ flex: 1 }}
        >
          Create Share Link
        </Button>
      </View>

      <Text
        variant="bodySmall"
        style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
      >
        Share links let anyone view this asset's details without an account.
      </Text>

      <Divider style={{ marginVertical: 8 }} />

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={links ?? []}
          keyExtractor={(item: ShareLink) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="🔗"
              title="No share links"
              body="Create a link to share this asset with others."
            />
          }
          renderItem={({ item }: { item: ShareLink }) => {
            const expired =
              item.expiresAt !== null && new Date(item.expiresAt) < new Date();
            return (
              <Card
                mode="outlined"
                style={[styles.card, expired && { opacity: 0.5 }]}
              >
                <Card.Content style={styles.cardContent}>
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="bodySmall"
                      style={{
                        color: theme.colors.onSurface,
                        fontFamily: "monospace",
                      }}
                      numberOfLines={1}
                    >
                      {linkUrl(item.token)}
                    </Text>
                    <Text
                      variant="labelSmall"
                      style={{
                        color: expired
                          ? theme.colors.error
                          : theme.colors.onSurfaceVariant,
                        marginTop: 2,
                      }}
                    >
                      {item.label ? `${item.label} · ` : ""}
                      {expired
                        ? "Expired"
                        : item.expiresAt
                        ? `Expires ${new Date(item.expiresAt).toLocaleDateString()}`
                        : "No expiration"}
                    </Text>
                  </View>
                  <IconButton
                    icon="content-copy"
                    size={18}
                    onPress={() => copyToClipboard(item.token)}
                    iconColor={theme.colors.primary}
                  />
                  <IconButton
                    icon="link-off"
                    size={18}
                    onPress={() => confirmRevoke(item.id)}
                    iconColor={theme.colors.error}
                  />
                </Card.Content>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  createRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  hint: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
  },
  list: { padding: 16, paddingTop: 4 },
  card: { marginBottom: 8 },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
});
