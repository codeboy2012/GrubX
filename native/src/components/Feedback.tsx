import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { palette, spacing, typography } from "@/theme";

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <View style={styles.wrap} accessibilityLabel={label}>
      <ActivityIndicator color={palette.accent} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

export function ErrorState({ title, detail, icon }: { title: string; detail?: string | null; icon?: string }) {
  return (
    <View style={[styles.wrap, styles.panel]} accessibilityRole="alert">
      <Text style={styles.title}>{icon ? `${icon} ` : ""}{title}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string | null }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    marginHorizontal: spacing.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 106, 106, 0.35)",
    backgroundColor: "rgba(255, 106, 106, 0.08)",
  },
  title: {
    color: palette.foreground,
    fontSize: typography.body,
    fontWeight: "600",
    textAlign: "center",
  },
  detail: {
    color: palette.muted,
    fontSize: typography.caption,
    textAlign: "center",
    lineHeight: typography.body * 1.4,
  },
  text: {
    color: palette.muted,
    fontSize: typography.caption,
  },
});
