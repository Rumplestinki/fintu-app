// components/Toast.jsx
// Toast pill animado — diseño Soft Dark Luxury

import React, { useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

export default function Toast({ visible, mensaje, tipo = 'exito' }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(80)).current;

  React.useEffect(() => {
    if (visible) {
      translateY.setValue(80);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start();

      // Desaparecer a los 2500ms
      const timer = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const nombreCategoria = mensaje.includes(' · ') ? mensaje.split(' · ')[1] : '';
  const montoTexto = mensaje.includes(' · ') ? mensaje.split(' · ')[0] : mensaje;

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
      {/* Check verde */}
      <View style={[styles.checkCirculo, { backgroundColor: tipo === 'exito' ? COLORS.success : COLORS.error }]}>
        <Text style={styles.checkTexto}>{tipo === 'exito' ? '✓' : '✕'}</Text>
      </View>

      {/* Textos */}
      <View style={{ flex: 1 }}>
        <Text style={styles.mensajePrincipal} numberOfLines={1}>
          {tipo === 'exito' ? 'Gasto guardado' : 'Error'}
        </Text>
        {mensaje ? (
          <Text style={styles.mensajeDetalle} numberOfLines={1}>{mensaje}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    backgroundColor: 'rgba(26,26,46,0.95)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 200,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  checkCirculo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTexto: { fontSize: 12, fontWeight: '700', color: COLORS.background },
  mensajePrincipal: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
    lineHeight: 16,
  },
  mensajeDetalle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontVariant: ['tabular-nums'],
    lineHeight: 16,
  },
});
