import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Card,
  Divider,
  List,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "../../lib/api";
import { storage, mmkvGet, mmkvSet } from "../../lib/storage";
import { STORAGE_KEYS } from "../../lib/constants";

type ColorSchemePref = "system" | "light" | "dark";

export default function SettingsScreen() {
  const theme = useTheme();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const user = me?.user;
  const household = me?.households[0];

  const [colorScheme, setColorScheme] = useState<ColorSchemePref>(
    () => (mmkvGet<ColorSchemePref>(STORAGE_KEYS.COLOR_SCHEME) ?? "system")
  );

  const updateColorScheme = (value: ColorSchemePref) => {
    setColorScheme(value);
    mmkvSet(STORAGE_KEYS.COLOR_SCHEME, value);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="headlineSmall" style={[styles.heading, { color: theme.colors.onBackground }]}>
          Settings
        </Text>

        {/* Profile */}
        {user && (
          <Card mode="outlined" style={styles.card}>
            <Card.Title title="Profile" titleVariant="titleSmall" />
            <Divider />
            <List.Item
              title={user.displayName ?? "—"}
              description="Display name"
              left={(props) => <List.Icon {...props} icon="account-outline" color={theme.colors.primary} />}
            />
            {user.email && (
              <List.Item
                title={user.email}
                description="Email"
                left={(props) => <List.Icon {...props} icon="email-outline" color={theme.colors.primary} />}
              />
            )}
            {household && (
              <List.Item
                title={household.name}
                description="Household"
                left={(props) => <List.Icon {...props} icon="home-outline" color={theme.colors.primary} />}
              />
            )}
          </Card>
        )}

        {/* Appearance */}
        <Card mode="outlined" style={styles.card}>
          <Card.Title title="Appearance" titleVariant="titleSmall" />
          <Divider />
          <View style={styles.colorSchemeRow}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, flex: 1 }}>
              Theme
            </Text>
            <View style={styles.colorSchemeOptions}>
              {(["system", "light", "dark"] as ColorSchemePref[]).map((option) => (
                <List.Item
                  key={option}
                  title={option.charAt(0).toUpperCase() + option.slice(1)}
                  style={styles.radioOption}
                  right={() => (
                    <Switch
                      value={colorScheme === option}
                      onValueChange={() => updateColorScheme(option)}
                      color={theme.colors.primary}
                    />
                  )}
                />
              ))}
            </View>
          </View>
        </Card>

        {/* Notifications */}
        <Card mode="outlined" style={styles.card}>
          <Card.Title title="Notifications" titleVariant="titleSmall" />
          <Divider />
          <List.Item
            title="Push notifications"
            description="Enabled via device registration"
            left={(props) => <List.Icon {...props} icon="bell-outline" color={theme.colors.primary} />}
            right={() => <Switch value disabled color={theme.colors.primary} />}
          />
        </Card>

        {/* About */}
        <Card mode="outlined" style={styles.card}>
          <Card.Title title="About" titleVariant="titleSmall" />
          <Divider />
          <List.Item
            title="LifeKeeper"
            description="Phase 3 · Expo SDK 52"
            left={(props) => <List.Icon {...props} icon="information-outline" color={theme.colors.primary} />}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  heading: { marginBottom: 8 },
  card: { marginBottom: 0 },
  colorSchemeRow: { padding: 8 },
  colorSchemeOptions: {},
  radioOption: { paddingVertical: 0 },
});
