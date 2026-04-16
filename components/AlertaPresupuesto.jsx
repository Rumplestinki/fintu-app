// components/AlertaPresupuesto.jsx
// Tarjeta de alerta de presupuesto — diseño premium con animación y haptics
// Se muestra en el dashboard cuando una categoría supera el 80% o 100%

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/colors';

// ──────────────────────────────────────────
// Barra de progreso animada
// ──────────────────────────────────────────
function BarraProgreso({ porcentaje, color }) {
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: Math.min(porcentaje, 100),
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [porcentaje]);

  return (
    <View style={estilos.barraBg}>
      <Animated.View
        style={[
          estilos.barraRelleno,
          {
            backgroundColor: color,
            width: animWidth.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

// ──────────────────────────────────────────
// Tarjeta individual de alerta
// ──────────────────────────────────────────
function TarjetaAlerta({ alerta, onDismiss, index }) {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrada escalonada según el índice
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();

    // Haptic al aparecer según severidad
    if (index === 0) {
      if (alerta.tipo === 'error') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, []);

  const colorBorde = alerta.tipo === 'error' ? COLORS.error : COLORS.warning;
  const colorFondo = alerta.tipo === 'error' ? '#2A1515' : '#2A2010';
  const colorTexto = alerta.tipo === 'error' ? COLORS.error : COLORS.warning;

  return (
    <Animated.View
      style={[
        estilos.tarjeta,
        {
          borderLeftColor: colorBorde,
          backgroundColor: colorFondo,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {/* Encabezado */}
      <View style={estilos.tarjetaHeader}>
        <View style={estilos.tarjetaLeft}>
          <View style={[estilos.iconoCirculo, { backgroundColor: colorBorde + '25' }]}>
            <Text style={estilos.iconoEmoji}>{alerta.icono}</Text>
          </View>
          <View style={estilos.tarjetaTextos}>
            <Text style={[estilos.tarjetaTitulo, { color: colorTexto }]}>
              {alerta.titulo}
            </Text>
            <Text style={estilos.tarjetaNombre}>{alerta.nombre}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onDismiss(alerta.id);
          }}
          style={estilos.btnCerrar}
          hitSlop={8}
        >
          <Text style={estilos.btnCerrarTxt}>✕</Text>
        </Pressable>
      </View>

      {/* Barra de progreso */}
      <BarraProgreso porcentaje={alerta.porcentaje} color={colorBorde} />

      {/* Detalle */}
      <View style={estilos.tarjetaDetalle}>
        <Text style={estilos.tarjetaMensaje}>{alerta.mensaje}</Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/(tabs)/presupuesto');
          }}
        >
          <Text style={[estilos.verPresupuesto, { color: colorTexto }]}>
            Ver presupuesto →
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ──────────────────────────────────────────
// Componente principal exportado
// Recibe array de alertas y maneja el dismiss
// ──────────────────────────────────────────
export default function AlertaPresupuesto({ alertas, onDismiss }) {
  if (!alertas || alertas.length === 0) return null;

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.encabezado}>
        <Text style={estilos.encabezadoTitulo}>Alertas de presupuesto</Text>
        {alertas.length > 1 && (
          <Text style={estilos.encabezadoConteo}>{alertas.length}</Text>
        )}
      </View>
      {alertas.map((alerta, index) => (
        <TarjetaAlerta
          key={alerta.id}
          alerta={alerta}
          onDismiss={onDismiss}
          index={index}
        />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  encabezadoTitulo: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  encabezadoConteo: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.error,
    backgroundColor: COLORS.error + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },

  tarjeta: {
    borderRadius: 14,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 10,
  },

  tarjetaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tarjetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconoCirculo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconoEmoji: { fontSize: 18 },
  tarjetaTextos: { flex: 1 },
  tarjetaTitulo: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 1,
  },
  tarjetaNombre: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  btnCerrar: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCerrarTxt: {
    fontSize: 13,
    color: COLORS.textMuted,
  },

  barraBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  barraRelleno: {
    height: '100%',
    borderRadius: 2,
  },

  tarjetaDetalle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tarjetaMensaje: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
  },
  verPresupuesto: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
});
