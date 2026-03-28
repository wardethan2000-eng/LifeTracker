import { Tabs } from "expo-router";
import { useTheme } from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
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
        }}
      />
    </Tabs>
  );
}
