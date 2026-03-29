/**
 * EntitySelector — lets the user attach a capture or note to a specific entity
 * (Asset, Project, Hobby, or Idea) or leave it as a standalone household entry.
 */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Dialog, Divider, List, Portal, Searchbar, Text, useTheme } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import {
  getHouseholdAssets,
  getHouseholdProjects,
  getHouseholdHobbies,
  getHouseholdIdeas,
} from "../lib/api";

export interface EntitySelection {
  entityType: string;
  entityId: string;
  label: string;
}

interface EntitySelectorProps {
  householdId: string;
  value: EntitySelection | null;
  onChange: (v: EntitySelection | null) => void;
}

interface EntityOption {
  entityType: string;
  entityId: string;
  label: string;
}

const STANDALONE: EntitySelection = {
  entityType: "home",
  entityId: "",  // filled in at call site with householdId
  label: "None (standalone)",
};

export function EntitySelector({ householdId, value, onChange }: EntitySelectorProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: assetsPage } = useQuery({
    queryKey: ["assets", householdId],
    queryFn: () => getHouseholdAssets(householdId, { limit: 200 }),
    enabled: open && !!householdId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects", householdId],
    queryFn: () => getHouseholdProjects(householdId),
    enabled: open && !!householdId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: hobbiesResult } = useQuery({
    queryKey: ["hobbies", householdId],
    queryFn: () => getHouseholdHobbies(householdId, { limit: 200 }),
    enabled: open && !!householdId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: ideas } = useQuery({
    queryKey: ["ideas", householdId],
    queryFn: () => getHouseholdIdeas(householdId, { limit: 200 }),
    enabled: open && !!householdId,
    staleTime: 2 * 60 * 1000,
  });

  const groups: { title: string; icon: string; items: EntityOption[] }[] = useMemo(() => {
    const q = search.toLowerCase();
    const filter = (label: string) => !q || label.toLowerCase().includes(q);

    const assets: EntityOption[] = (assetsPage?.items ?? [])
      .filter((a) => filter(a.name))
      .map((a) => ({ entityType: "asset", entityId: a.id, label: a.name }));

    const proj: EntityOption[] = (projects ?? [])
      .filter((p) => filter(p.name))
      .map((p) => ({ entityType: "project", entityId: p.id, label: p.name }));

    const hobbies: EntityOption[] = (hobbiesResult?.items ?? [])
      .filter((h) => filter(h.name))
      .map((h) => ({ entityType: "hobby", entityId: h.id, label: h.name }));

    const ideasList: EntityOption[] = ((ideas?.items) ?? [])
      .filter((i) => filter(i.title))
      .map((i) => ({ entityType: "idea", entityId: i.id, label: i.title }));

    return [
      { title: "Assets", icon: "toolbox-outline", items: assets },
      { title: "Projects", icon: "folder-outline", items: proj },
      { title: "Hobbies", icon: "palette-outline", items: hobbies },
      { title: "Ideas", icon: "lightbulb-outline", items: ideasList },
    ].filter((g) => g.items.length > 0);
  }, [assetsPage, projects, hobbiesResult, ideas, search]);

  function select(option: EntityOption | null) {
    if (!option) {
      onChange({ ...STANDALONE, entityId: householdId });
    } else {
      onChange({ entityType: option.entityType, entityId: option.entityId, label: option.label });
    }
    setOpen(false);
    setSearch("");
  }

  const displayLabel = value && value.entityType !== "home" ? value.label : "None (standalone)";

  return (
    <>
      <Button
        mode="outlined"
        icon="link-variant"
        onPress={() => setOpen(true)}
        style={styles.trigger}
        contentStyle={styles.triggerContent}
        labelStyle={{ color: theme.colors.onSurface }}
        compact
      >
        {displayLabel}
      </Button>

      <Portal>
        <Dialog visible={open} onDismiss={() => { setOpen(false); setSearch(""); }} style={styles.dialog}>
          <Dialog.Title>Link to entity</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Searchbar
              placeholder="Search…"
              value={search}
              onChangeText={setSearch}
              style={styles.search}
              inputStyle={styles.searchInput}
            />
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {/* Standalone option */}
              <List.Item
                title="None (standalone)"
                description="Not linked to a specific entity"
                left={(props) => <List.Icon {...props} icon="close-circle-outline" />}
                onPress={() => select(null)}
                titleStyle={!value || value.entityType === "home" ? { color: theme.colors.primary } : undefined}
              />
              <Divider />

              {groups.length === 0 ? (
                <Text
                  variant="bodySmall"
                  style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}
                >
                  {search ? "No matches" : "Loading…"}
                </Text>
              ) : null}

              {groups.map((group) => (
                <View key={group.title}>
                  <List.Subheader>{group.title}</List.Subheader>
                  {group.items.map((item) => (
                    <List.Item
                      key={item.entityId}
                      title={item.label}
                      left={(props) => <List.Icon {...props} icon={group.icon} />}
                      onPress={() => select(item)}
                      titleStyle={
                        value?.entityId === item.entityId
                          ? { color: theme.colors.primary, fontWeight: "600" }
                          : undefined
                      }
                    />
                  ))}
                  <Divider />
                </View>
              ))}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setOpen(false); setSearch(""); }}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { alignSelf: "flex-start" },
  triggerContent: { flexDirection: "row-reverse" },
  dialog: { maxHeight: "80%" },
  dialogContent: { paddingHorizontal: 0, paddingBottom: 0 },
  search: { marginHorizontal: 16, marginBottom: 8 },
  searchInput: { fontSize: 14 },
  list: { maxHeight: 380 },
  empty: { textAlign: "center", paddingVertical: 20 },
});
