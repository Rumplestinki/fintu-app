// components/Toast.jsx
// Toast de notificación reutilizable con animación de entrada/salida

import React, { useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

export default function Toast({ visible, mensaje, tipo = 'exito' }) {
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2200),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[
      styles.toast,
      tipo === 'exito' ? styles.toastExito : styles.toastError,
      { opacity },
    ]}>
      <Text style={styles.emoji}>{tipo === 'exito' ? '✅' : '❌'}</Text>
      <Text style={styles.texto} numberOfLines={2}>{mensaje}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  toastExito: {
    backgroundColor: '#1A2A1A',
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  toastError: {
    backgroundColor: '#2A1A1A',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  emoji: { fontSize: 18 },
  texto: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});
