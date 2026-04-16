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
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/colors';
import { hap } from '../services/haptics';

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
// La clave del cierre suave: animar maxHeight a 0 con overflow hidden.
// Esto hace que el layout colapse gradualmente y las tarjetas de abajo
// suban junto con el colapso, sin saltar bruscamente.
// ──────────────────────────────────────────
function TarjetaAlerta({ alerta, onDismiss, index }) {
  const router = useRouter();

  // Animaciones de entrada
  const slideAnim   = useRef(new Animated.Value(-20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Animaciones de salida del contenido (GPU — suave)
  const exitOpacity    = useRef(new Animated.Value(1)).current;
  const exitTranslateY = useRef(new Animated.Value(0)).current;

  // Animaciones de colapso del layout (JS thread — necesario para maxHeight/margin)
  // maxHeight empieza en 300 (más que suficiente para cualquier tarjeta)
  const maxHeightAnim = useRef(new Animated.Value(300)).current;
  const marginAnim    = useRef(new Animated.Value(10)).current;

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

    // Haptic al aparecer según severidad (solo para la primera alerta)
    if (index === 0) {
      if (alerta.tipo === 'error') {
        hap.advertencia();
      } else {
        hap.suave();
      }
    }
  }, []);

  // Cierre en 3 capas simultáneas:
  // 1. Fade + subida leve del contenido visible (GPU)
  // 2. maxHeight 300 → 0 con overflow:hidden (colapsa el espacio del layout)
  // 3. marginBottom 10 → 0 (elimina el margen residual)
  // Las tarjetas de abajo suben suavemente junto con el colapso — sin salto
  const handleDismiss = () => {
    hap.suave();

    Animated.parallel([
      // Contenido se desvanece y sube ligeramente
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(exitTranslateY, {
        toValue: -6,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      // El contenedor colapsa — arrastra las tarjetas de abajo suavemente
      // Dura un poco más que el fade para que el colapso sea el movimiento dominante
      Animated.timing(maxHeightAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      // El margen también colapsa para no dejar hueco residual
      Animated.timing(marginAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Solo al terminar todo, el padre desmonta el componente
      onDismiss(alerta.id);
    });
  };

  const colorBorde = alerta.tipo === 'error' ? COLORS.error : COLORS.warning;
  const colorFondo = alerta.tipo === 'error' ? '#2A1515' : '#2A2010';
  const colorTexto = alerta.tipo === 'error' ? COLORS.error : COLORS.warning;

  return (
    // overflow: hidden + maxHeight animado = las tarjetas de abajo suben
    // suavemente junto con el colapso, sin ningún salto brusco
    <Animated.View
      style={{
        maxHeight: maxHeightAnim,
        marginBottom: marginAnim,
        overflow: 'hidden',
      }}
    >
      {/* Tarjeta con animación de entrada */}
      <Animated.View
        style={[
          estilos.tarjeta,
          {
            borderLeftColor: colorBorde,
            backgroundColor: colorFondo,
            transform: [
              { translateY: slideAnim },
              { translateY: exitTranslateY },
            ],
            opacity: opacityAnim,
          },
        ]}
      >
        {/* Capa de fade de salida sobre el contenido */}
        <Animated.View style={{ opacity: exitOpacity }}>

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
              onPress={handleDismiss}
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
                hap.suave();
                router.push('/(tabs)/presupuesto');
              }}
            >
              <Text style={[estilos.verPresupuesto, { color: colorTexto }]}>
                Ver presupuesto →
              </Text>
            </Pressable>
          </View>

        </Animated.View>
      </Animated.View>
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

  // marginBottom removido de aquí — lo controla marginAnim en el wrapper
  tarjeta: {
    borderRadius: 14,
    borderLeftWidth: 3,
    padding: 14,
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
