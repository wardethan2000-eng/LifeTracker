import { useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { Divider, List, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

const DOMAIN_SECTIONS = [
  {
    title: "Manage",
    items: [
      { label: "Assets", icon: "wrench-outline", route: "/assets" as const },
      { label: "Projects", icon: "clipboard-list-outline", route: "/projects" as const },
      { label: "Hobbies", icon: "palette-outline", route: "/hobbies" as const },
      { label: "Ideas", icon: "lightbulb-outline", route: "/ideas" as const },
      { label: "Inventory", icon: "package-variant-closed", route: "/inventory" as const },
    ],
  },
  {
    title: "Activity",
    items: [
      { label: "Notes & Entries", icon: "notebook-outline", route: "/entries" as const },
      { label: "Notifications", icon: "bell-outline", route: "/notifications" as const },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Settings", icon: "cog-outline", route: "/settings" as const },
    ],
  },
] as const;

export default function MoreScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView>
        <Text
          variant="headlineSmall"
          style={[styles.heading, { color: theme.colors.onBackground }]}
        >
          More
        </Text>

        {DOMAIN_SECTIONS.map((section) => (
          <List.Section key={section.title}>
            <List.Subheader
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {section.title}
            </List.Subheader>
            {section.items.map((item, idx) => (
              <List.Item
                key={item.route}
                title={item.label}
                left={(props) => (
                  <List.Icon
                    {...props}
                    icon={item.icon}
                    color={theme.colors.primary}
                  />
                )}
                right={(props) => (
                  <List.Icon {...props} icon="chevron-right" />
                )}
                onPress={() => router.push(item.route)}
                style={{ backgroundColor: theme.colors.surface }}
              />
            ))}
            <Divider />
          </List.Section>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
});
