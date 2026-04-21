// app/(tabs)/agregar.jsx
// Pantalla para registrar un nuevo gasto — diseño Soft Dark Luxury

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants/colors';
import { CATEGORIAS } from '../../constants/categorias';
import { hexToRgba } from '../../utils/formato';
import { registrarGasto as crearGasto } from '../../services/gastos';
import { useAuth } from '../../hooks/useAuth';
import DateTimePicker from '@react-native-community/datetimepicker';
import { verificarPresupuestos } from '../../services/notificaciones';
import Toast from '../../components/Toast';
import { formatearFechaISO, formatearFechaLegible } from '../../utils/fecha';

// ─── COMPONENTE: CATEGORÍA ANIMADA ────────────────────────
function CategoriaAnimada({ cat, seleccionada, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.spring(scaleAnim, {
      toValue: 1.08,
      useNativeDriver: true,
      friction: 4,
      tension: 80,
    }).start(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
      }).start();
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Animated.View style={[estilos.categoriaWrap, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={estilos.categoriaBtn}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        {/* Círculo del ícono */}
        <View style={[
          estilos.categoriaCirculo,
          seleccionada
            ? { backgroundColor: hexToRgba('#6C63FF', 0.2), borderWidth: 2, borderColor: COLORS.primary }
            : { backgroundColor: hexToRgba(cat.color, 0.18) },
        ]}>
          <Text style={estilos.categoriaEmoji}>{cat.icono}</Text>
        </View>
        {/* Label */}
        <Text style={[estilos.categoriaNombre, seleccionada && { color: COLORS.primary, fontWeight: '500' }]}>
          {cat.nombre}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── COMPONENTE: TECLA DEL TECLADO ───────────────────────
function Tecla({ tecla, onPress }) {
  const bgAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.timing(bgAnim, { toValue: 1, duration: 80, useNativeDriver: false }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const handlePressOut = () => {
    Animated.timing(bgAnim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
    onPress(tecla);
  };

  const bgColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.surface, COLORS.surfaceLight],
  });

  return (
    <Animated.View style={[estilos.tecla, { backgroundColor: bgColor }]}>
      <TouchableOpacity
        style={estilos.teclaInner}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {tecla === '⌫' ? (
          <Text style={estilos.teclaBorrarTxt}>⌫</Text>
        ) : (
          <Text style={estilos.teclaTxt}>{tecla}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────
export default function AgregarGasto() {
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();
  const [monto, setMonto] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(formatearFechaISO(new Date()));
  const [guardando, setGuardando] = useState(false);
  const [mostrarPicker, setMostrarPicker] = useState(false);

  // Animación del borde del input descripción al enfocar
  const borderColorAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMensaje, setToastMensaje] = useState('');
  const [toastTipo, setToastTipo] = useState('exito');

  // ── Reset completo al enfocar la pantalla ──
  useFocusEffect(
    useCallback(() => {
      setMonto('');
      setCategoriaSeleccionada(null);
      setDescripcion('');
      setFecha(formatearFechaISO(new Date()));
      setGuardando(false);
    }, [])
  );

  const mostrarToast = (mensaje, tipo = 'exito') => {
    setToastMensaje(mensaje);
    setToastTipo(tipo);
    setToastVisible(false);
    setTimeout(() => setToastVisible(true), 50);
  };

  // ── Teclado numérico ──
  const handleTecla = (tecla) => {
    if (tecla === '⌫') {
      setMonto((prev) => prev.slice(0, -1));
      return;
    }
    if (tecla === '.' && monto.includes('.')) return;
    if (tecla === '.' && monto === '') return;
    const partes = monto.split('.');
    if (partes[1] && partes[1].length >= 2) return;
    if (monto.replace('.', '').length >= 10) return;
    setMonto((prev) => prev + tecla);
  };

  // ── Animación del borde al enfocar descripción ──
  const handleFocusInput = () => {
    Animated.timing(borderColorAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const handleBlurInput = () => {
    Animated.timing(borderColorAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = borderColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.border, COLORS.primary],
  });

  // ── Guardar gasto ──
  const handleGuardar = async () => {
    if (!monto || parseFloat(monto) === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      mostrarToast('Escribe el monto primero', 'error');
      return;
    }
    if (!categoriaSeleccionada) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      mostrarToast('Elige una categoría', 'error');
      return;
    }

    setGuardando(true);
    try {
      await crearGasto({
        userId: usuario?.id,
        monto: parseFloat(monto),
        categoriaId: categoriaSeleccionada.dbId,
        descripcion,
        fecha,
        origen: 'manual',
      });

      const alertas = await verificarPresupuestos();
      const alertaCritica = alertas?.find(a => a.tipo === 'error' || a.tipo === 'advertencia');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (alertaCritica) {
        mostrarToast(`⚠️ ${alertaCritica.mensaje}`, 'error');
      } else {
        mostrarToast(`$${monto} en ${categoriaSeleccionada.nombre} guardado`);
      }

      setGuardando(false);
      setTimeout(() => router.replace('/(tabs)/'), 2200);
    } catch (error) {
      console.error('Error al guardar gasto:', error);
      mostrarToast('No se pudo guardar. Intenta de nuevo.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const hayFecha = fecha !== formatearFechaISO(new Date()) &&
                   fecha !== formatearFechaISO(new Date(Date.now() - 86400000));

  return (
    <KeyboardAvoidingView
      style={estilos.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Toast visible={toastVisible} mensaje={toastMensaje} tipo={toastTipo} />

      <ScrollView
        contentContainerStyle={[estilos.scrollContent, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={estilos.header}>
          <TouchableOpacity style={estilos.btnBack} onPress={() => router.back()}>
            <Text style={estilos.btnBackTxt}>←</Text>
          </TouchableOpacity>
          <Text style={estilos.titulo}>Nuevo gasto</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Display del monto ── */}
        <View style={estilos.montoContainer}>
          <Text style={[estilos.montoDisplay, !monto && estilos.montoPlaceholder]}>
            <Text style={estilos.montoSimbolo}>$</Text>
            {monto || '0.00'}
          </Text>
        </View>

        {/* ── Teclado numérico ── */}
        <View style={estilos.teclado}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((tecla) => (
            <Tecla key={tecla} tecla={tecla} onPress={handleTecla} />
          ))}
        </View>

        {/* ── Selector de categoría (4 columnas) ── */}
        <View style={estilos.categoriasGrid}>
          {CATEGORIAS.map((cat) => (
            <CategoriaAnimada
              key={cat.id}
              cat={cat}
              seleccionada={categoriaSeleccionada?.id === cat.id}
              onPress={() => setCategoriaSeleccionada(cat)}
            />
          ))}
        </View>

        {/* ── Input descripción ── */}
        <View style={estilos.descripcionWrap}>
          <Animated.View style={[estilos.inputBorder, { borderBottomColor: borderColor }]}>
            <TextInput
              ref={inputRef}
              style={estilos.inputDescripcion}
              placeholder="¿En qué gastaste?"
              placeholderTextColor={COLORS.textMuted}
              value={descripcion}
              onChangeText={setDescripcion}
              onFocus={handleFocusInput}
              onBlur={handleBlurInput}
              maxLength={100}
              returnKeyType="done"
            />
          </Animated.View>
        </View>

        {/* ── Chips de fecha ── */}
        <View style={estilos.fechaRow}>
          {/* Hoy */}
          <TouchableOpacity
            style={[estilos.fechaChip, fecha === formatearFechaISO(new Date()) && estilos.fechaChipActivo]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFecha(formatearFechaISO(new Date())); }}
          >
            <Text style={[estilos.fechaChipTxt, fecha === formatearFechaISO(new Date()) && estilos.fechaChipTxtActivo]}>
              Hoy
            </Text>
          </TouchableOpacity>

          {/* Ayer */}
          <TouchableOpacity
            style={[estilos.fechaChip, fecha === formatearFechaISO(new Date(Date.now() - 86400000)) && estilos.fechaChipActivo]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFecha(formatearFechaISO(new Date(Date.now() - 86400000))); }}
          >
            <Text style={[estilos.fechaChipTxt, fecha === formatearFechaISO(new Date(Date.now() - 86400000)) && estilos.fechaChipTxtActivo]}>
              Ayer
            </Text>
          </TouchableOpacity>

          {/* Fecha personalizada */}
          <TouchableOpacity
            style={[estilos.fechaChip, estilos.fechaChipFlex, hayFecha && estilos.fechaChipActivo]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMostrarPicker(true); }}
          >
            <Text style={[estilos.fechaChipTxt, hayFecha && estilos.fechaChipTxtActivo]}>
              📅 {hayFecha ? formatearFechaLegible(fecha) : 'Fecha'}
            </Text>
          </TouchableOpacity>
        </View>

        {mostrarPicker && (
          <DateTimePicker
            value={new Date(fecha + 'T12:00:00')}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={(evento, fechaSeleccionada) => {
              setMostrarPicker(false);
              if (evento.type === 'dismissed') return;
              if (fechaSeleccionada) {
                setFecha(formatearFechaISO(fechaSeleccionada));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
          />
        )}

        {/* ── Botón Guardar ── */}
        <TouchableOpacity
          style={[
            estilos.btnGuardar,
            (!monto || !categoriaSeleccionada) && estilos.btnGuardarDeshabilitado,
          ]}
          onPress={handleGuardar}
          disabled={!monto || !categoriaSeleccionada || guardando}
          activeOpacity={0.85}
        >
          {guardando ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={[
              estilos.btnGuardarTxt,
              (!monto || !categoriaSeleccionada) && estilos.btnGuardarTxtDeshabilitado,
            ]}>
              {monto && categoriaSeleccionada ? `Guardar $${monto}` : 'Guardar gasto'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────
const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 80 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  btnBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBackTxt: { fontSize: 20, color: COLORS.textSecondary },
  titulo: { fontSize: 20, fontWeight: '600', color: COLORS.textPrimary },

  // Monto
  montoContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  montoSimbolo: { fontSize: 28, fontWeight: '300', color: COLORS.textPrimary },
  montoDisplay: {
    fontSize: 48,
    fontWeight: '300',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  montoPlaceholder: { color: COLORS.textMuted },

  // Teclado numérico
  teclado: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 20,
  },
  tecla: {
    width: '30%',
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    flexGrow: 1,
  },
  teclaInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teclaTxt: {
    fontSize: 26,
    fontWeight: '400',
    color: COLORS.textPrimary,
  },
  teclaBorrarTxt: {
    fontSize: 22,
    color: COLORS.textSecondary,
  },

  // Categorías (4 columnas)
  categoriasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 0,
    marginBottom: 16,
  },
  categoriaWrap: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  categoriaBtn: { alignItems: 'center', gap: 6 },
  categoriaCirculo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriaEmoji: { fontSize: 24 },
  categoriaNombre: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Descripción
  descripcionWrap: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  inputBorder: {
    borderBottomWidth: 1,
  },
  inputDescripcion: {
    color: COLORS.textPrimary,
    fontSize: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.transparent,
  },

  // Chips de fecha
  fechaRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 24,
  },
  fechaChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.transparent,
  },
  fechaChipFlex: { flex: 1, alignItems: 'center' },
  fechaChipActivo: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  fechaChipTxt: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  fechaChipTxtActivo: {
    color: COLORS.white,
  },

  // Botón guardar
  btnGuardar: {
    marginHorizontal: 20,
    marginTop: 8,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  btnGuardarDeshabilitado: {
    backgroundColor: COLORS.surfaceLight,
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.6,
  },
  btnGuardarTxt: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '600',
  },
  btnGuardarTxtDeshabilitado: {
    color: COLORS.textMuted,
  },
});
