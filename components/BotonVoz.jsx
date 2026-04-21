// components/BotonVoz.jsx
// Botón de micrófono con orb animado y ripple rings — diseño Soft Dark Luxury
// Usa expo-audio (SDK 54+)

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  Animated, ActivityIndicator, Alert, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { hap } from '../services/haptics';
import { AudioModule, RecordingPresets } from 'expo-audio';
import { COLORS } from '../constants/colors';
import { procesarAudioConGemini } from '../services/voz';

export default function BotonVoz({ onResultado, tamaño = 'normal' }) {
  const [estado, setEstado] = useState('idle'); // idle | grabando | procesando
  const [volumen, setVolumen] = useState(0);

  const recorderRef    = useRef(null);
  const estaGrabando   = useRef(false); // flag nativo para evitar doble disparo
  const recordingTimeoutRef = useRef(null);

  // Animaciones de ripple (2 anillos)
  const ring1Scale   = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(1)).current;
  const ring2Scale   = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(1)).current;
  const ring1Loop    = useRef(null);
  const ring2Loop    = useRef(null);

  // Barras de audio (7 barras dentro del orb)
  const barAnims = useRef(Array.from({ length: 7 }, () => new Animated.Value(0.4))).current;
  const barLoops = useRef([]);

  // Animación procesando (3 puntos)
  const dots = useRef(Array.from({ length: 3 }, () => new Animated.Value(0.3))).current;
  const dotLoops = useRef([]);

  // Pulso suave del orb al procesar
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbLoop  = useRef(null);

  // ── Iniciar/detener animaciones según estado ──
  useEffect(() => {
    if (estado === 'grabando') {
      // Ripple ring 1
      ring1Loop.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ring1Scale, { toValue: 1.8, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(ring1Opacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(ring1Scale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(ring1Opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );
      ring1Loop.current.start();

      // Ripple ring 2 (desfasado 1100ms)
      const ring2Timeout = setTimeout(() => {
        ring2Loop.current = Animated.loop(
          Animated.sequence([
            Animated.parallel([
              Animated.timing(ring2Scale, { toValue: 1.8, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.timing(ring2Opacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(ring2Scale, { toValue: 1, duration: 0, useNativeDriver: true }),
              Animated.timing(ring2Opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
            ]),
          ])
        );
        ring2Loop.current.start();
      }, 1100);

      // Barras de audio animadas en loop
      const delays = [0, 120, 240, 180, 60, 200, 40];
      barLoops.current = barAnims.map((anim, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 400 + i * 60, delay: delays[i], useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.3, duration: 400 + i * 60, useNativeDriver: true }),
          ])
        );
        loop.start();
        return loop;
      });

      return () => {
        clearTimeout(ring2Timeout);
        ring1Loop.current?.stop();
        ring2Loop.current?.stop();
        ring1Scale.setValue(1); ring1Opacity.setValue(1);
        ring2Scale.setValue(1); ring2Opacity.setValue(1);
        barLoops.current.forEach(l => l.stop());
        barAnims.forEach(a => a.setValue(0.4));
      };

    } else if (estado === 'procesando') {
      // Pulso suave del orb
      orbLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(orbScale, { toValue: 1.05, duration: 500, useNativeDriver: true }),
          Animated.timing(orbScale, { toValue: 0.98, duration: 500, useNativeDriver: true }),
        ])
      );
      orbLoop.current.start();

      // Puntos de procesando (stagger)
      const stagger = Animated.stagger(150,
        dots.map(d =>
          Animated.loop(
            Animated.sequence([
              Animated.timing(d, { toValue: 1, duration: 400, useNativeDriver: true }),
              Animated.timing(d, { toValue: 0.3, duration: 400, useNativeDriver: true }),
            ])
          )
        )
      );
      stagger.start();
      dotLoops.current = stagger;

      return () => {
        orbLoop.current?.stop();
        orbScale.setValue(1);
        stagger.stop();
        dots.forEach(d => d.setValue(0.3));
      };
    } else {
      // idle — resetear todo
      ring1Scale.setValue(1); ring1Opacity.setValue(1);
      ring2Scale.setValue(1); ring2Opacity.setValue(1);
      orbScale.setValue(1);
      barAnims.forEach(a => a.setValue(0.4));
      dots.forEach(d => d.setValue(0.3));
    }
  }, [estado]);

  // ── Actualizar barras según volumen ──
  useEffect(() => {
    if (estado === 'grabando') {
      const variaciones = [1.0, 1.4, 2.0, 1.4, 1.0, 1.6, 0.8];
      barAnims.forEach((anim, i) => {
        const targetScale = 0.3 + volumen * variaciones[i] * 0.7;
        Animated.spring(anim, {
          toValue: Math.min(targetScale, 1),
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [volumen, estado]);

  // ── Limpieza al desmontar ──
  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      estaGrabando.current = false;
      if (recorderRef.current) {
        recorderRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // ── Iniciar grabación ──
  const handlePressIn = async () => {
    // Doble guardia: estado React + ref síncrono para evitar doble disparo en Android
    if (estado !== 'idle' || estaGrabando.current) return;
    estaGrabando.current = true;

    const permiso = await AudioModule.requestRecordingPermissionsAsync();
    if (!permiso.granted) {
      estaGrabando.current = false;
      Alert.alert('Error', 'Necesitamos permiso de micrófono.');
      return;
    }
    try {
      hap.guardar();

      // Reutilizar la instancia existente o crear una nueva
      let recorder = recorderRef.current;
      if (!recorder) {
        recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
        recorder.onRecordingStatusUpdate = (status) => {
          if (status.metering !== undefined) {
            const db = status.metering;
            const level = Math.max(0, (db + 60) / 50);
            setVolumen(level);
          }
        };
        recorderRef.current = recorder;
      }

      await recorder.prepareToRecordAsync({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
      await recorder.record();
      setEstado('grabando');
      recordingTimeoutRef.current = setTimeout(() => handlePressOut(), 30000);
    } catch (error) {
      console.error('Error al iniciar recorder:', error);
      estaGrabando.current = false;
      setEstado('idle');
    }
  };

  // ── Detener y procesar ──
  const handlePressOut = async () => {
    if (!estaGrabando.current || !recorderRef.current) return;
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    estaGrabando.current = false;
    try {
      hap.suave();
      setEstado('procesando');
      setVolumen(0);
      const recorder = recorderRef.current;
      await recorder.stop();
      const audioUri = recorder.uri;
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
  const orbTamaño = esGrande ? 160 : 100;

  // Colores del orb según estado
  const coloresOrb = estado === 'procesando'
    ? ['#67E8F9', '#22D3EE', '#0891B2']
    : ['#A78BFA', '#6C63FF', '#4B3FCC'];

  return (
    <View style={estilos.contenedor}>
      <Animated.View style={{ transform: [{ scale: orbScale }] }}>
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={estado === 'procesando'}>
          {/* Anillo ripple 1 */}
          {estado === 'grabando' && (
            <Animated.View style={[
              estilos.rippleRing,
              {
                width: orbTamaño,
                height: orbTamaño,
                borderRadius: orbTamaño / 2,
                top: 0, left: 0, right: 0, bottom: 0,
                transform: [{ scale: ring1Scale }],
                opacity: ring1Opacity,
              },
            ]} />
          )}
          {/* Anillo ripple 2 */}
          {estado === 'grabando' && (
            <Animated.View style={[
              estilos.rippleRing,
              {
                width: orbTamaño,
                height: orbTamaño,
                borderRadius: orbTamaño / 2,
                top: 0, left: 0, right: 0, bottom: 0,
                transform: [{ scale: ring2Scale }],
                opacity: ring2Opacity,
              },
            ]} />
          )}

          {/* Orb principal */}
          <LinearGradient
            colors={coloresOrb}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[estilos.orb, { width: orbTamaño, height: orbTamaño, borderRadius: orbTamaño / 2 }]}
          >
            {estado === 'procesando' ? (
              // Puntos de carga
              <View style={estilos.puntosRow}>
                {dots.map((dot, i) => (
                  <Animated.View
                    key={i}
                    style={[estilos.puntoProcesando, { opacity: dot }]}
                  />
                ))}
              </View>
            ) : estado === 'grabando' ? (
              // Barras de audio
              <View style={estilos.barrasRow}>
                {barAnims.map((anim, i) => (
                  <Animated.View
                    key={i}
                    style={[estilos.barraAudio, { transform: [{ scaleY: anim }] }]}
                  />
                ))}
              </View>
            ) : (
              // Ícono de micrófono en idle
              <Text style={[estilos.micIcono, { fontSize: esGrande ? 52 : 36 }]}>🎙️</Text>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>

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
  rippleRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(108,99,255,0.5)',
    backgroundColor: COLORS.transparent,
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  barrasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
  },
  barraAudio: {
    width: 3,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 2,
  },
  puntosRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  puntoProcesando: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },
  micIcono: {
    textAlign: 'center',
  },
  instruccion: {
    marginTop: 20,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
});
