// components/BotonVoz.jsx
// Botón de micrófono reutilizable — mantener presionado para grabar
// Usa expo-audio (SDK 54+)

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  Animated, ActivityIndicator, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { AudioModule, RecordingPresets } from 'expo-audio';
import { COLORS } from '../constants/colors';
import { procesarAudioConGemini } from '../services/voz';

export default function BotonVoz({ onResultado, tamaño = 'normal' }) {
  const [estado, setEstado] = useState('idle');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);
  const recorderRef = useRef(null);

  // ── Animación de pulso mientras graba ──
  useEffect(() => {
    if (estado === 'grabando') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      if (pulseLoop.current) pulseLoop.current.stop();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [estado]);

  // ── Limpiar al desmontar ──
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.stop().catch(() => {});
        recorderRef.current = null;
      }
    };
  }, []);

  // ── Iniciar grabación al presionar ──
  const handlePressIn = async () => {
    if (estado !== 'idle') return;

    const permiso = await AudioModule.requestRecordingPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert(
        'Permiso de micrófono',
        'Fintú necesita acceso al micrófono. Ve a Configuración y actívalo.',
        [{ text: 'Entendido' }]
      );
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      recorderRef.current = recorder;
      await recorder.prepareToRecordAsync();
      await recorder.record();
      setEstado('grabando');
    } catch (error) {
      console.error('Error al iniciar grabación:', error);
      recorderRef.current = null;
      setEstado('idle');
      Alert.alert('Error', 'No se pudo iniciar la grabación. Intenta de nuevo.');
    }
  };

  // ── Detener y procesar al soltar ──
  const handlePressOut = async () => {
    if (estado !== 'grabando' || !recorderRef.current) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setEstado('procesando');

      const recorder = recorderRef.current;
      await recorder.stop();
      const audioUri = recorder.uri;
      recorderRef.current = null;

      if (!audioUri) throw new Error('No se generó el archivo de audio');

      const datos = await procesarAudioConGemini(audioUri);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEstado('idle');
      onResultado(datos);

    } catch (error) {
      recorderRef.current = null;
      setEstado('idle');

      // Errores controlados — mensajes específicos sin Alert genérico
      if (error.message === 'NO_ES_GASTO') {
        Alert.alert(
          'No detecté un gasto 🤔',
          'Di algo como: "gasté 50 pesos en tacos" o "150 de uber"',
          [{ text: 'Intentar de nuevo' }]
        );
      } else if (error.message.includes('saturado')) {
        Alert.alert(
          'Gemini ocupado ⏳',
          'El servicio de IA está saturado. Espera unos segundos e intenta de nuevo.',
          [{ text: 'OK' }]
        );
      } else {
        console.error('Error procesando audio:', error);
        Alert.alert(
          'No se entendió',
          'Habla más claro y cerca del micrófono. Ejemplo: "gasté 80 pesos en el Oxxo"'
        );
      }
    }
  };

  const esGrande = tamaño === 'grande';
  const tamañoBoton = esGrande ? 72 : 56;
  const colorFondo =
    estado === 'grabando'   ? '#FF4444' :
    estado === 'procesando' ? COLORS.surfaceLight :
    COLORS.primary;

  return (
    <View style={estilos.contenedor}>
      {estado === 'grabando' && (
        <Animated.View style={[
          estilos.anilloPulso,
          {
            width: tamañoBoton + 20,
            height: tamañoBoton + 20,
            borderRadius: (tamañoBoton + 20) / 2,
            transform: [{ scale: pulseAnim }],
          },
        ]} />
      )}

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
            backgroundColor: colorFondo,
          },
        ]}
      >
        {estado === 'procesando' ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={{ fontSize: esGrande ? 32 : 24 }}>
            {estado === 'grabando' ? '⏹' : '🎙️'}
          </Text>
        )}
      </Pressable>

      <Text style={estilos.instruccion}>
        {estado === 'idle'      ? 'Mantén presionado' :
         estado === 'grabando'  ? 'Suelta para procesar' :
         'Procesando…'}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  anilloPulso: {
    position: 'absolute',
    backgroundColor: '#FF444430',
    borderWidth: 2,
    borderColor: '#FF444460',
  },
  boton: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  instruccion: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
