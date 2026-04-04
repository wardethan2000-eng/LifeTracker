/**
 * Household management screen.
 * Shows members (with roles), pending invitations, and invite-by-email form.
 */
import { useState } from "react";
import { Alert, FlatList, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Divider,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import {
  getHouseholdInvitations,
  getHouseholdMembers,
  getMe,
  inviteMember,
  revokeInvitation,
} from "../../lib/api";
import type { HouseholdInvitation, HouseholdMember } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  return (
    <View
      style={[
        styles.avatar,
        { backgroundColor: color },
      ]}
    >
      <Text style={styles.avatarText}>{initials(name)}</Text>
    </View>
  );
}

export default function HouseholdScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";
  const householdName = me?.households[0]?.name ?? "Your Household";
  const currentUserId = me?.user.id ?? "";

  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ["household-members", householdId],
    queryFn: () => getHouseholdMembers(householdId),
    enabled: !!householdId,
  });

  const { data: invitations, isLoading: loadingInvitations } = useQuery({
    queryKey: ["household-invitations", householdId],
    queryFn: () => getHouseholdInvitations(householdId),
    enabled: !!householdId,
  });

  const { mutate: sendInvite, isPending: sending } = useMutation({
    mutationFn: (email: string) => inviteMember(householdId, email),
    onSuccess: () => {
      setInviteEmail("");
      setInviteError("");
      queryClient.invalidateQueries({ queryKey: ["household-invitations", householdId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: Error) => {
      setInviteError(err.message ?? "Failed to send invitation.");
    },
  });

  const { mutate: revoke } = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(householdId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household-invitations", householdId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
    onError: (err: Error) => Alert.alert("Error", err.message ?? "Could not revoke invitation."),
  });

  const handleSendInvite = () => {
    const email = inviteEmail.trim();
    if (!email || !email.includes("@")) {
      setInviteError("Enter a valid email address.");
      return;
    }
    setInviteError("");
    sendInvite(email);
  };

  const confirmRevoke = (invitationId: string, email: string) => {
    Alert.alert(
      "Revoke Invitation",
      `Cancel the invitation to ${email}?`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: () => revoke(invitationId),
        },
      ]
    );
  };

  const AVATAR_COLORS = [
    "#7B61FF", "#FF6B6B", "#4ECDC4", "#45B7D1",
    "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8",
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Button
            icon="arrow-left"
            mode="text"
            onPress={() => router.back()}
            labelStyle={{ color: theme.colors.onSurfaceVariant }}
          >
            Back
          </Button>
        </View>
        <Text
          variant="headlineSmall"
          style={[styles.title, { color: theme.colors.onBackground }]}
        >
          {householdName}
        </Text>

        {/* Members */}
        <Card mode="outlined" style={styles.card}>
          <Card.Title title="Members" titleVariant="titleSmall" />
          <Divider />
          {loadingMembers ? (
            <ActivityIndicator style={{ margin: 16 }} />
          ) : !members?.length ? (
            <Card.Content>
              <EmptyState icon="👥" title="No members found" />
            </Card.Content>
          ) : (
            members.map((member: HouseholdMember, idx: number) => {
              const displayName =
                member.user?.displayName ??
                member.user?.email ??
                "Unknown";
              const isCurrentUser = member.userId === currentUserId;
              const isOwner = member.role === "owner";
              const avatarColor =
                AVATAR_COLORS[idx % AVATAR_COLORS.length]!;

              return (
                <View
                  key={member.id}
                  style={[
                    styles.memberRow,
                    { borderBottomColor: theme.colors.outline },
                  ]}
                >
                  <Avatar name={displayName} color={avatarColor} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurface }}
                    >
                      {displayName}
                      {isCurrentUser ? " (you)" : ""}
                    </Text>
                    {member.user?.email && member.user.email !== displayName && (
                      <Text
                        variant="labelSmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        {member.user.email}
                      </Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.roleBadge,
                      {
                        backgroundColor: isOwner
                          ? theme.colors.primaryContainer
                          : theme.colors.surfaceVariant,
                      },
                    ]}
                  >
                    <Text
                      variant="labelSmall"
                      style={{
                        color: isOwner
                          ? theme.colors.onPrimaryContainer
                          : theme.colors.onSurfaceVariant,
                      }}
                    >
                      {isOwner ? "Owner" : "Member"}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* Pending Invitations */}
        <Card mode="outlined" style={styles.card}>
          <Card.Title title="Pending Invitations" titleVariant="titleSmall" />
          <Divider />
          {loadingInvitations ? (
            <ActivityIndicator style={{ margin: 16 }} />
          ) : !invitations?.length ? (
            <Card.Content>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, paddingVertical: 8 }}
              >
                No pending invitations.
              </Text>
            </Card.Content>
          ) : (
            invitations.map((inv: HouseholdInvitation) => (
              <View
                key={inv.id}
                style={[
                  styles.invRow,
                  { borderBottomColor: theme.colors.outline },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurface }}
                  >
                    {inv.email}
                  </Text>
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
                  >
                    {inv.expiresAt
                      ? `Expires ${new Date(inv.expiresAt).toLocaleDateString()}`
                      : "No expiration"}
                  </Text>
                </View>
                <IconButton
                  icon="close-circle-outline"
                  size={20}
                  iconColor={theme.colors.error}
                  onPress={() => confirmRevoke(inv.id, inv.email)}
                />
              </View>
            ))
          )}
        </Card>

        {/* Invite form */}
        <Card mode="outlined" style={styles.card}>
          <Card.Title title="Invite Someone" titleVariant="titleSmall" />
          <Card.Content>
            <TextInput
              label="Email address"
              value={inviteEmail}
              onChangeText={(t) => {
                setInviteEmail(t);
                setInviteError("");
              }}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              dense
              style={{ marginBottom: 8 }}
            />
            {inviteError !== "" && (
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.error, marginBottom: 6 }}
              >
                {inviteError}
              </Text>
            )}
            <Button
              mode="contained"
              icon="email-plus-outline"
              onPress={handleSendInvite}
              loading={sending}
              disabled={sending || !householdId}
            >
              Send Invitation
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  headerRow: { marginLeft: -8, marginBottom: 4 },
  title: { marginBottom: 4 },
  card: {},
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  invRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
});
