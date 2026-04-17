// components/BotonVoz.jsx
// Botón de micrófono reutilizable — con onda de audio reactiva
// Usa expo-audio (SDK 54+)

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  Animated, ActivityIndicator, Alert, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hap } from '../services/haptics';
import { AudioModule, RecordingPresets } from 'expo-audio';
import { COLORS } from '../constants/colors';
import { procesarAudioConGemini } from '../services/voz';

export default function BotonVoz({ onResultado, tamaño = 'normal' }) {
  const [estado, setEstado] = useState('idle');
  const [volumen, setVolumen] = useState(0); // 0 a 1 aprox
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const recorderRef = useRef(null);

  // ── Barras de la onda (5 barras) ──
  const barAnims = [
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
  ];

  // ── Efecto de pulso y anillos ──
  useEffect(() => {
    if (estado === 'grabando') {
      // Pulso del botón
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();

      // Anillo 1
      Animated.loop(
        Animated.sequence([
          Animated.timing(ring1Anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(ring1Anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();

      // Anillo 2 (con delay)
      const ring2Timeout = setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(ring2Anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
            Animated.timing(ring2Anim, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        ).start();
      }, 600);

      return () => clearTimeout(ring2Timeout);
    } else if (estado === 'procesando') {
      // Pulso suave al procesar
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.98, duration: 500, useNativeDriver: true }),
        ])
      ).start();
      ring1Anim.setValue(0);
      ring2Anim.setValue(0);
    } else {
      pulseAnim.setValue(1);
      ring1Anim.setValue(0);
      ring2Anim.setValue(0);
    }
  }, [estado]);

  // ── Actualizar altura de barras según volumen ──
  useEffect(() => {
    if (estado === 'grabando') {
      barAnims.forEach((anim, i) => {
        // Variación aleatoria ligera para que se vea orgánico
        const targetScale = 1 + (volumen * (2.5 + Math.random()));
        Animated.spring(anim, {
          toValue: targetScale,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }).start();
      });
    } else {
      barAnims.forEach(anim => anim.setValue(1));
    }
  }, [volumen, estado]);

  // ── Limpiar al desmontar ──
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.stop().catch(() => {});
        recorderRef.current = null;
      }
    };
  }, []);

  // ── Iniciar grabación ──
  const handlePressIn = async () => {
    if (estado !== 'idle') return;

    const permiso = await AudioModule.requestRecordingPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Error', 'Necesitamos permiso de micrófono.');
      return;
    }

    try {
      hap.guardar();

      const recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);

      // Activar metering para la onda reactiva
      recorder.onRecordingStatusUpdate = (status) => {
        if (status.metering !== undefined) {
          // El metering viene en dB (-160 a 0 aprox)
          const db = status.metering;
          const level = Math.max(0, (db + 60) / 50); 
          setVolumen(level);
        }
      };

      recorderRef.current = recorder;
      
      // CRITICAL: isMeteringEnabled DEBE estar en true
      await recorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      
      await recorder.record();
      setEstado('grabando');
    } catch (error) {
      console.error('Error al iniciar recorder:', error);
      setEstado('idle');
    }
  };

  // ── Detener y procesar ──
  const handlePressOut = async () => {
    if (estado !== 'grabando' || !recorderRef.current) return;

    try {
      hap.suave();
      setEstado('procesando');
      setVolumen(0);

      const recorder = recorderRef.current;
      await recorder.stop();
      const audioUri = recorder.uri;
      recorderRef.current = null;

      const datos = await procesarAudioConGemini(audioUri);

      setEstado('idle');
      onResultado(datos);

    } catch (error) {
      setEstado('idle');
      if (error.message !== 'NO_ES_GASTO') {
        Alert.alert('Error', 'No pude procesar el audio. Habla más claro.');
      }
    }
  };

  const esGrande = tamaño === 'grande';
  const tamañoBoton = esGrande ? 80 : 60;

  return (
    <View style={estilos.contenedor}>

      {/* Onda de audio visual */}
      <View style={estilos.ondaContenedor}>
        {barAnims.map((anim, i) => (
          <Animated.View 
            key={i} 
            style={[
              estilos.barraOnda, 
              { 
                transform: [{ scaleY: anim }],
                opacity: estado === 'grabando' ? 1 : 0.3
              }
            ]} 
          />
        ))}
      </View>

      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {/* Anillos — solo visibles al grabar */}
        {estado === 'grabando' && (
          <>
            <Animated.View style={[
              estilos.anillo,
              {
                width: tamañoBoton + 40,
                height: tamañoBoton + 40,
                borderRadius: (tamañoBoton + 40) / 2,
                opacity: ring1Anim.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0.6, 0.3, 0],
                }),
                transform: [{
                  scale: ring1Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.6],
                  }),
                }],
              },
            ]} />
            <Animated.View style={[
              estilos.anillo,
              {
                width: tamañoBoton + 40,
                height: tamañoBoton + 40,
                borderRadius: (tamañoBoton + 40) / 2,
                opacity: ring2Anim.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0.6, 0.3, 0],
                }),
                transform: [{
                  scale: ring2Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.6],
                  }),
                }],
              },
            ]} />
          </>
        )}

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={estado === 'procesando'}
            style={[
              estilos.boton,
              {
                width: tamañoBoton,
                height: tamañoBoton,
                borderRadius: tamañoBoton / 2,
                backgroundColor: estado === 'grabando' ? '#FF4444' : COLORS.primary,
              },
            ]}
          >
            {estado === 'procesando' ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : estado === 'grabando' ? (
              <View style={estilos.iconoStop}>
                <View style={{
                  width: esGrande ? 24 : 18,
                  height: esGrande ? 24 : 18,
                  borderRadius: 4,
                  backgroundColor: '#fff',
                }} />
              </View>
            ) : (
              <Ionicons
                name="mic"
                size={esGrande ? 36 : 28}
                color="#fff"
              />
            )}
          </Pressable>
        </Animated.View>
      </View>

      <Text style={estilos.instruccion}>
        {estado === 'idle' ? 'Mantén presionado para hablar' : 
         estado === 'grabando' ? 'Suelta para finalizar' : 
         'Analizando tu gasto...'}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  ondaContenedor: {
    flexDirection: 'row',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 16,
  },
  barraOnda: {
    width: 4,
    height: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  anillo: {
    position: 'absolute',
    backgroundColor: COLORS.primary,
  },
  boton: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  iconoStop: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  instruccion: {
    marginTop: 20,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
