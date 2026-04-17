// components/BotonFintu.jsx
// Botón premium reutilizable de Fintú con press effect y ripple

import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { hap } from '../services/haptics';

export default function BotonFintu({
  onPress,
  label,
  variante = 'primario',  // 'primario' | 'secundario' | 'ghost' | 'peligro'
  deshabilitado = false,
  cargando = false,
  icono = null,           // emoji o texto opcional a la izquierda del label
  estilo = {},            // estilos extra para el contenedor
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const ripples = useRef([]).current;

  // Al presionar — el botón se hunde
  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }),
      Animated.spring(translateYAnim, {
        toValue: 2,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }),
    ]).start();
  };

  // Al soltar — vuelve con spring
  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 6,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 20,
        bounciness: 6,
      }),
    ]).start();
  };

  // Ripple desde el punto de toque
  const handlePress = (event) => {
    if (deshabilitado || cargando) return;
    
    const { locationX, locationY } = event.nativeEvent;
    const rippleAnim = new Animated.Value(0);
    const rippleId = Date.now();
    
    ripples.push({ id: rippleId, x: locationX, y: locationY, anim: rippleAnim });
    
    hap.guardar();
    
    Animated.timing(rippleAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      const idx = ripples.findIndex(r => r.id === rippleId);
      if (idx !== -1) ripples.splice(idx, 1);
    });

    onPress && onPress();
  };

  // Colores según variante
  const colores = {
    primario:   { fondo: '#6C63FF', texto: '#FFFFFF', sombra: '#4B44CC' },
    secundario: { fondo: '#1E1E2E', texto: '#6C63FF', sombra: 'transparent' },
    ghost:      { fondo: 'transparent', texto: '#6C63FF', sombra: 'transparent' },
    peligro:    { fondo: '#FF5252', texto: '#FFFFFF', sombra: '#CC2222' },
  };

  const color = colores[variante] || colores.primario;
  const opacidad = deshabilitado ? 0.45 : 1;

  return (
    <Animated.View
      style={[
        estilos.contenedor,
        estilo,
        {
          transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
          opacity: opacidad,
        },
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={deshabilitado || cargando}
        style={[
          estilos.boton,
          {
            backgroundColor: color.fondo,
            borderWidth: variante === 'ghost' ? 1.5 : 0,
            borderColor: variante === 'ghost' ? '#6C63FF' : 'transparent',
          },
        ]}
      >
        {/* Ripples de tinta */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {ripples.map((ripple) => (
            <Animated.View
              key={ripple.id}
              style={{
                position: 'absolute',
                left: ripple.x - 60,
                top: ripple.y - 60,
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: 'rgba(255,255,255,0.25)',
                transform: [{
                  scale: ripple.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 3],
                  }),
                }],
                opacity: ripple.anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [1, 0.5, 0],
                }),
              }}
            />
          ))}
        </View>

        {/* Contenido del botón */}
        <View style={estilos.contenido}>
          {icono && <Text style={estilos.icono}>{icono}</Text>}
          {cargando ? (
            <Text style={[estilos.label, { color: color.texto }]}>...</Text>
          ) : (
            <Text style={[estilos.label, { color: color.texto }]}>{label}</Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  boton: {
    paddingVertical: 17,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contenido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icono: {
    fontSize: 18,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
