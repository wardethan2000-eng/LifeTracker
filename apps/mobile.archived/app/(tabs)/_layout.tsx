import { Tabs } from "expo-router";
import { useTheme } from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useQuery } from "@tanstack/react-query";
import { getMe, getHouseholdNotifications } from "../../lib/api";
import type { ReactNode } from "react";

type IconProps = { color: string; size: number };

function HomeIcon({ color, size }: IconProps): ReactNode {
  return <MaterialCommunityIcons name="home-outline" color={color} size={size} />;
}
function ScanIcon({ color, size }: IconProps): ReactNode {
  return <MaterialCommunityIcons name="barcode-scan" color={color} size={size} />;
}
function CaptureIcon({ color, size }: IconProps): ReactNode {
  return <MaterialCommunityIcons name="pencil-plus-outline" color={color} size={size} />;
}
function SearchIcon({ color, size }: IconProps): ReactNode {
  return <MaterialCommunityIcons name="magnify" color={color} size={size} />;
}
function MoreIcon({ color, size }: IconProps): ReactNode {
  return <MaterialCommunityIcons name="dots-horizontal-circle-outline" color={color} size={size} />;
}

export default function TabsLayout() {
  const theme = useTheme();

  // Unread notification count for the badge on the More tab
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";
  const { data: notifData } = useQuery({
    queryKey: ["notifications-unread-count", householdId],
    queryFn: () => getHouseholdNotifications(householdId, { status: "unread", limit: 1 }),
    enabled: !!householdId,
    staleTime: 60 * 1000, // 1 minute
  });
  const unreadCount = notifData?.unreadCount ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: HomeIcon,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ScanIcon,
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: "Capture",
          tabBarIcon: CaptureIcon,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: SearchIcon,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: MoreIcon,
          ...(unreadCount > 0 ? { tabBarBadge: unreadCount } : {}),
        }}
      />
    </Tabs>
  );
}
