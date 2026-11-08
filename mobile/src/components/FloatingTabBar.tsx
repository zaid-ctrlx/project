import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";

import { useReduceMotion } from "../hooks/useReduceMotion";
import { useSafeInsets } from "../hooks/useSafeInsets";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { radius, spacing } from "../theme";

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Home: ["home-outline", "home"],
  Discover: ["compass-outline", "compass"],
  Messages: ["chatbubble-outline", "chatbubble"],
  Profile: ["person-outline", "person"],
};

// A rounded navy bar that floats above the screen edge, with one orange pill
// marking the active tab. It sits in the normal layout (not over the content)
// so no screen's list/map is ever hidden behind it.
export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeInsets();
  const { styles, colors } = useThemedStyles((colors) => ({
    outer: { backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      height: 64,
      borderRadius: 26,
      backgroundColor: colors.tabBar,
      shadowColor: "#000",
      shadowOpacity: 0.28,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
    item: { flex: 1, alignItems: "center", justifyContent: "center", height: 64 },
    pill: { width: 46, height: 46, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
    badge: {
      position: "absolute",
      top: -2,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.tabBar,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { color: colors.primaryText, fontSize: 10, fontWeight: "800" },
  }));

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const [off, on] = ICONS[route.name] ?? ["ellipse-outline", "ellipse"];
          return (
            <TabItem
              key={route.key}
              focused={focused}
              icon={focused ? on : off}
              label={String(options.tabBarAccessibilityLabel ?? route.name)}
              badge={options.tabBarBadge}
              activeFill={colors.accent}
              activeIcon={colors.accentText}
              inactiveIcon={colors.tabBarInactive}
              badgeStyle={styles.badge}
              badgeTextStyle={styles.badgeText}
              itemStyle={styles.item}
              pillStyle={styles.pill}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            />
          );
        })}
      </View>
    </View>
  );
}

type ItemProps = {
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge: string | number | undefined;
  activeFill: string;
  activeIcon: string;
  inactiveIcon: string;
  badgeStyle: object;
  badgeTextStyle: object;
  itemStyle: object;
  pillStyle: object;
  onPress: () => void;
  onLongPress: () => void;
};

function TabItem(p: ItemProps) {
  const reduce = useReduceMotion();
  const grow = useRef(new Animated.Value(p.focused ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      grow.setValue(p.focused ? 1 : 0);
      return;
    }
    Animated.timing(grow, {
      toValue: p.focused ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: true,
    }).start();
  }, [p.focused, grow, reduce]);

  return (
    <Pressable
      style={p.itemStyle}
      onPress={p.onPress}
      onLongPress={p.onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: p.focused }}
      accessibilityLabel={p.label}
    >
      <View style={p.pillStyle}>
        {/* The orange pill grows in behind the icon instead of snapping. */}
        <Animated.View
          style={{
            position: "absolute",
            width: 46,
            height: 46,
            borderRadius: 16,
            backgroundColor: p.activeFill,
            opacity: grow,
            transform: [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          }}
        />
        <Ionicons name={p.icon} size={22} color={p.focused ? p.activeIcon : p.inactiveIcon} />
        {p.badge != null && p.badge !== 0 && (
          <View style={p.badgeStyle}>
            <Text style={p.badgeTextStyle}>{p.badge}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
