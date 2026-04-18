// components/BotonVoz.jsx
// Botón de micrófono reutilizable — orb con gradiente, ripple, barras reactivas
// Usa expo-audio (SDK 54+)

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  Animated, Alert, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { hap } from '../services/haptics';
import { AudioModule, RecordingPresets } from 'expo-audio';
import { COLORS } from '../constants/colors';
import { CATEGORIAS, getCategoriaById } from '../constants/categorias';
import { procesarAudioConGemini } from '../services/voz';
import { formatMXN } from '../utils/formato';

// Estados posibles: idle | grabando | procesando | resultado
export default function BotonVoz({ onResultado, tamaño = 'normal' }) {
  const [estado, setEstado] = useState('idle');
  const [volumen, setVolumen] = useState(0);
  const [datosResultado, setDatosResultado] = useState(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const orbScaleAnim = useRef(new Animated.Value(1)).current;

  // 3 puntos animados para el estado procesando
  const dot1Anim = useRef(new Animated.Value(0.3)).current;
  const dot2Anim = useRef(new Animated.Value(0.3)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;

  const recorderRef = useRef(null);
  const recordingTimeoutRef = useRef(null);

  // 7 barras de onda de audio — un solo useRef para cumplir Rules of Hooks
  const barAnims = useRef(Array.from({ length: 7 }, () => new Animated.Value(1))).current;

  // ── Efecto de pulso, anillos y escala del orb ──
  useEffect(() => {
    if (estado === 'grabando') {
      // Pulso suave del orb
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();

      // Anillo 1 — ripple
      Animated.loop(
        Animated.sequence([
          Animated.timing(ring1Anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(ring1Anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();

      // Anillo 2 — ripple con delay para alternancia
      const ring2Timeout = setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(ring2Anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
            Animated.timing(ring2Anim, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        ).start();
      }, 600);

      // Orb a tamaño completo
      Animated.spring(orbScaleAnim, { toValue: 1, useNativeDriver: true }).start();

      return () => clearTimeout(ring2Timeout);

    } else if (estado === 'procesando') {
      // Pulso suave cian
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.98, duration: 500, useNativeDriver: true }),
        ])
      ).start();
      ring1Anim.setValue(0);
      ring2Anim.setValue(0);

      // 3 puntos animados en secuencia
      const animDots = () => Animated.loop(
        Animated.sequence([
          Animated.timing(dot1Anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot2Anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot3Anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(dot1Anim, { toValue: 0.3, duration: 200, useNativeDriver: true }),
            Animated.timing(dot2Anim, { toValue: 0.3, duration: 200, useNativeDriver: true }),
            Animated.timing(dot3Anim, { toValue: 0.3, duration: 200, useNativeDriver: true }),
          ]),
        ])
      ).start();
      animDots();

    } else if (estado === 'resultado') {
      // Orb se achica para dar espacio a la card
      Animated.spring(orbScaleAnim, { toValue: 0.6, useNativeDriver: true }).start();
      pulseAnim.setValue(1);
      ring1Anim.setValue(0);
      ring2Anim.setValue(0);

    } else {
      // idle: reset todo
      pulseAnim.setValue(1);
      ring1Anim.setValue(0);
      ring2Anim.setValue(0);
      orbScaleAnim.setValue(1);
      dot1Anim.setValue(0.3);
      dot2Anim.setValue(0.3);
      dot3Anim.setValue(0.3);
    }
  }, [estado]);

  // ── Actualizar altura de barras según volumen ──
  useEffect(() => {
    if (estado === 'grabando') {
      // Variación fija por posición para look orgánico y determinístico
      const variaciones = [1.0, 1.2, 1.8, 2.2, 1.8, 1.2, 1.0];
      barAnims.forEach((anim, i) => {
        const targetScale = 1 + (volumen * variaciones[i] * 2.5);
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
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
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

      recorder.onRecordingStatusUpdate = (status) => {
        if (status.metering !== undefined) {
          const db = status.metering;
          const level = Math.max(0, (db + 60) / 50);
          setVolumen(level);
        }
      };

      recorderRef.current = recorder;

      await recorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });

      await recorder.record();
      setEstado('grabando');

      // Auto-stop después de 30 segundos
      recordingTimeoutRef.current = setTimeout(() => handlePressOut(), 30000);
    } catch (error) {
      console.error('Error al iniciar recorder:', error);
      setEstado('idle');
    }
  };

  // ── Detener y procesar ──
  const handlePressOut = async () => {
    if (estado !== 'grabando' || !recorderRef.current) return;

    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    try {
      hap.suave();
      setEstado('procesando');
      setVolumen(0);

      const recorder = recorderRef.current;
      await recorder.stop();
      const audioUri = recorder.uri;
      recorderRef.current = null;

      const datos = await procesarAudioConGemini(audioUri);

      // Mostrar card de revisión antes de guardar
      setDatosResultado(datos);
      setEstado('resultado');

    } catch (error) {
      setEstado('idle');
      if (error.message !== 'NO_ES_GASTO') {
        Alert.alert('Error', 'No pude procesar el audio. Habla más claro.');
      }
    }
  };

  // ── Guardar el resultado confirmado ──
  const handleGuardar = () => {
    hap.guardar();
    onResultado(datosResultado);
    setDatosResultado(null);
    setEstado('idle');
  };

  // ── Descartar resultado y volver a idle ──
  const handleDescartar = () => {
    hap.suave();
    setDatosResultado(null);
    setEstado('idle');
  };

  const esGrande = tamaño === 'grande';
  const tamañoOrb = esGrande ? 120 : 60;

  // Color del orb según estado
  const gradientesOrb = {
    idle: [COLORS.primary, COLORS.primaryDark],
    grabando: ['#FF5252', '#CC2222'],
    procesando: [COLORS.success, '#009B7D'],
    resultado: [COLORS.primary, COLORS.primaryDark],
  };
  const gradiente = gradientesOrb[estado] || gradientesOrb.idle;

  // Categoría del resultado para mostrar ícono
  const categoriaResultado = datosResultado
    ? getCategoriaById(datosResultado.categoriaId || 'otros')
    : null;

  return (
    <View style={estilos.contenedor}>

      {/* Barras de onda de audio — visibles al grabar */}
      <View style={estilos.ondaContenedor}>
        {barAnims.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              estilos.barraOnda,
              {
                transform: [{ scaleY: anim }],
                opacity: estado === 'grabando' ? 1 : 0.2,
              }
            ]}
          />
        ))}
      </View>

      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {/* Anillos ripple — solo al grabar */}
        {estado === 'grabando' && (
          <>
            <Animated.View style={[
              estilos.anillo,
              {
                width: tamañoOrb + 50,
                height: tamañoOrb + 50,
                borderRadius: (tamañoOrb + 50) / 2,
                opacity: ring1Anim.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0.5, 0.25, 0],
                }),
                transform: [{
                  scale: ring1Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.7],
                  }),
                }],
              },
            ]} />
            <Animated.View style={[
              estilos.anillo,
              {
                width: tamañoOrb + 50,
                height: tamañoOrb + 50,
                borderRadius: (tamañoOrb + 50) / 2,
                opacity: ring2Anim.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0.5, 0.25, 0],
                }),
                transform: [{
                  scale: ring2Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.7],
                  }),
                }],
              },
            ]} />
          </>
        )}

        {/* Orb principal con gradiente */}
        <Animated.View style={{
          transform: [
            { scale: pulseAnim },
            { scale: orbScaleAnim },
          ],
        }}>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={estado === 'procesando' || estado === 'resultado'}
            style={{ borderRadius: tamañoOrb / 2 }}
          >
            <LinearGradient
              colors={gradiente}
              style={[estilos.orb, { width: tamañoOrb, height: tamañoOrb, borderRadius: tamañoOrb / 2 }]}
            >
              {estado === 'procesando' ? (
                // 3 puntos animados en cian
                <View style={estilos.dotsContenedor}>
                  {[dot1Anim, dot2Anim, dot3Anim].map((anim, i) => (
                    <Animated.View key={i} style={[estilos.dot, { opacity: anim }]} />
                  ))}
                </View>
              ) : estado === 'grabando' ? (
                // Ícono de stop (cuadrado)
                <View style={{
                  width: esGrande ? 24 : 16,
                  height: esGrande ? 24 : 16,
                  borderRadius: 4,
                  backgroundColor: '#fff',
                }} />
              ) : (
                // Ícono de micrófono
                <Ionicons
                  name="mic"
                  size={esGrande ? 40 : 26}
                  color="#fff"
                />
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      {/* Instrucción de estado */}
      {estado !== 'resultado' && (
        <Text style={estilos.instruccion}>
          {estado === 'idle' ? 'Mantén presionado para hablar' :
           estado === 'grabando' ? 'Suelta para finalizar' :
           'Analizando tu gasto...'}
        </Text>
      )}

      {/* Card de revisión del resultado */}
      {estado === 'resultado' && datosResultado && (
        <View style={estilos.cardResultado}>
          <Text style={estilos.cardTitulo}>¿Guardamos este gasto?</Text>

          <View style={estilos.cardFila}>
            <Text style={estilos.cardIcono}>{categoriaResultado?.icono ?? '📦'}</Text>
            <View style={estilos.cardTextos}>
              <Text style={estilos.cardDescripcion} numberOfLines={2}>
                {datosResultado.descripcion || 'Sin descripción'}
              </Text>
              <Text style={estilos.cardCategoria}>
                {categoriaResultado?.nombre ?? 'Otros'}
              </Text>
            </View>
            <Text style={estilos.cardMonto}>
              {formatMXN(datosResultado.monto ?? 0)}
            </Text>
          </View>

          <View style={estilos.cardBotones}>
            <Pressable style={estilos.btnDescartar} onPress={handleDescartar}>
              <Text style={estilos.btnDescartarTexto}>Cancelar</Text>
            </Pressable>
            <Pressable style={estilos.btnGuardar} onPress={handleGuardar}>
              <Text style={estilos.btnGuardarTexto}>Guardar</Text>
            </Pressable>
          </View>
        </View>
      )}
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
    marginBottom: 20,
  },
  barraOnda: {
    width: 4,
    height: 22,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  anillo: {
    position: 'absolute',
    backgroundColor: COLORS.primary,
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  dotsContenedor: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  instruccion: {
    marginTop: 22,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  // ── Card de resultado ──
  cardResultado: {
    marginTop: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitulo: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 14,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  cardIcono: {
    fontSize: 32,
  },
  cardTextos: {
    flex: 1,
  },
  cardDescripcion: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: 3,
  },
  cardCategoria: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  cardMonto: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.coral,
  },
  cardBotones: {
    flexDirection: 'row',
    gap: 10,
  },
  btnDescartar: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDescartarTexto: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  btnGuardar: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGuardarTexto: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
