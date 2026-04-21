// app/(tabs)/_layout.jsx
// Tab bar premium con punto indicador animado y botón FAB central

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants/colors';

const { width } = Dimensions.get('window');
const TAB_WIDTH = width / 5;
const TAB_BAR_HEIGHT = 72;

// ──────────────────────────────────────────
// Componente: MiTabBar (Custom Tab Bar)
// ──────────────────────────────────────────
function MiTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  // Animación del punto indicador bajo el ícono activo
  const posicionPunto = useRef(new Animated.Value(state.index * TAB_WIDTH)).current;

  useEffect(() => {
    Animated.spring(posicionPunto, {
      toValue: state.index * TAB_WIDTH,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [state.index]);

  return (
    <View style={[
      styles.tabBarContainer,
      { paddingBottom: insets.bottom + 8, height: TAB_BAR_HEIGHT + insets.bottom + 8 }
    ]}>
      {/* Punto indicador deslizante bajo el ícono activo */}
      <Animated.View
        style={[styles.puntoIndicadorWrap, { transform: [{ translateX: posicionPunto }] }]}
      >
        <View style={styles.puntoIndicador} />
      </Animated.View>

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            if (route.name === 'agregar') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } else {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            navigation.navigate(route.name);
          }
        };

        return (
          <TabItem
            key={route.key}
            label={label}
            isFocused={isFocused}
            onPress={onPress}
            routeName={route.name}
          />
        );
      })}
    </View>
  );
}

// ──────────────────────────────────────────
// Componente: TabItem
// ──────────────────────────────────────────
function TabItem({ label, isFocused, onPress, routeName }) {
  const scaleAnim = useRef(new Animated.Value(isFocused ? 1.12 : 1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isFocused ? 1.12 : 1,
      useNativeDriver: true,
      friction: 6,
      tension: 50,
    }).start();
  }, [isFocused]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: isFocused ? 1.12 : 1, useNativeDriver: true, friction: 5 }),
    ]).start();
    onPress();
  };

  const getIcon = (focused) => {
    switch (routeName) {
      case 'index':       return focused ? 'home' : 'home-outline';
      case 'gastos':      return focused ? 'list' : 'list-outline';
      case 'agregar':     return 'add';
      case 'presupuesto': return focused ? 'pie-chart' : 'pie-chart-outline';
      case 'perfil':      return focused ? 'person' : 'person-outline';
      default:            return 'help-circle';
    }
  };

  // Botón FAB central (agregar)
  if (routeName === 'agregar') {
    return (
      <Pressable onPress={handlePress} style={styles.tabItem}>
        <Animated.View style={[styles.fabCentral, { transform: [{ scale: scaleAnim }] }]}>
          <Ionicons name="add" size={30} color={COLORS.white} />
        </Animated.View>
        <Text style={[styles.label, isFocused && styles.labelActivo]}>Agregar</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress} style={styles.tabItem}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons
          name={getIcon(isFocused)}
          size={22}
          color={isFocused ? COLORS.primary : COLORS.textMuted}
        />
      </Animated.View>
      <Text style={[styles.label, isFocused && styles.labelActivo]}>
        {label === 'index' ? 'Inicio' : label}
      </Text>
    </Pressable>
  );
}

// ──────────────────────────────────────────
// Layout Principal de Tabs
// ──────────────────────────────────────────
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <MiTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"       options={{ title: 'Inicio' }} />
      <Tabs.Screen name="gastos"      options={{ title: 'Gastos' }} />
      <Tabs.Screen name="agregar"     options={{ title: 'Agregar' }} />
      <Tabs.Screen name="presupuesto" options={{ title: 'Plan' }} />
      <Tabs.Screen name="perfil"      options={{ title: 'Perfil' }} />
    </Tabs>
  );
}

// ──────────────────────────────────────────
// Estilos
// ──────────────────────────────────────────
const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },

  // Punto indicador bajo el ícono activo
  puntoIndicadorWrap: {
    position: 'absolute',
    top: 0,
    width: TAB_WIDTH,
    alignItems: 'center',
  },
  puntoIndicador: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginTop: 6,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
    paddingTop: 10,
  },

  // FAB central sobresale 16px hacia arriba
  fabCentral: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },

  label: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },
  labelActivo: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
