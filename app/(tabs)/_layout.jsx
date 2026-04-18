// app/(tabs)/_layout.jsx
// Tab bar premium de Fintú — paleta Soft Dark Luxury

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants/colors';

const { width } = Dimensions.get('window');
const TAB_WIDTH = width / 5;

// ──────────────────────────────────────────
// Componente: MiTabBar (Custom Tab Bar)
// ──────────────────────────────────────────
function MiTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  // Valor animado para la posición X del punto indicador
  const posicionPunto = useRef(new Animated.Value(0)).current;

  // Sincronizar la posición del punto cuando cambia el índice
  useEffect(() => {
    Animated.spring(posicionPunto, {
      toValue: state.index * TAB_WIDTH,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [state.index]);

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: insets.bottom + 10 }]}>
      {/* Punto indicador deslizante */}
      <Animated.View
        style={[
          styles.puntoIndicador,
          { transform: [{ translateX: posicionPunto }] },
        ]}
      >
        <View style={styles.punto} />
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
  const scaleAnim = useRef(new Animated.Value(isFocused ? 1.18 : 1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isFocused) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.25, useNativeDriver: true, friction: 4 }),
        Animated.spring(scaleAnim, { toValue: 1.18, useNativeDriver: true, friction: 4 }),
      ]).start();

      if (routeName === 'agregar') {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          ])
        ).start();
      }
    } else {
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
      pulseAnim.setValue(1);
    }
  }, [isFocused]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.92, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: isFocused ? 1.18 : 1, useNativeDriver: true, friction: 4 }),
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

  // Botón central de Agregar
  if (routeName === 'agregar') {
    return (
      <Pressable onPress={handlePress} style={styles.tabItem}>
        <Animated.View
          style={[
            styles.botonAgregarCentral,
            { transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }] },
          ]}
        >
          <Ionicons name="add" size={32} color="#FFF" />
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
          size={24}
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
// Layout principal de Tabs
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
    height: 75,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
  },
  botonAgregarCentral: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -35,
    borderWidth: 4,
    borderColor: COLORS.surface,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
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
  puntoIndicador: {
    position: 'absolute',
    top: 0,
    width: TAB_WIDTH,
    alignItems: 'center',
  },
  punto: {
    width: 20,
    height: 3,
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
});
