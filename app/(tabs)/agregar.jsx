// app/(tabs)/agregar.jsx
// Pantalla para registrar un nuevo gasto manualmente

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
import { Ionicons } from '@expo/vector-icons';
import { hap } from '../../services/haptics';
import { COLORS } from '../../constants/colors';
import { CATEGORIAS } from '../../constants/categorias';
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
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.12, useNativeDriver: true, speed: 50, bounciness: 8 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={[estilos.catOpt, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        <View
          style={[
            estilos.catCirculo,
            {
              backgroundColor: seleccionada ? cat.color + '35' : cat.color + '2E',
              borderColor: seleccionada ? cat.color : 'transparent',
              borderWidth: 2,
            },
          ]}
        >
          <Text style={{ fontSize: 20 }}>{cat.icono}</Text>
        </View>
        <Text style={[estilos.catNombre, seleccionada && { color: COLORS.textPrimary }]}>
          {cat.nombre}
        </Text>
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

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMensaje, setToastMensaje] = useState('');
  const [toastTipo, setToastTipo] = useState('exito');

  // Reset completo al enfocar la pantalla
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
    hap.suave();
    if (tecla === '⌫') {
      setMonto((prev) => prev.slice(0, -1));
      return;
    }
    if (tecla === '.' && monto.includes('.')) return;
    if (tecla === '.' && monto === '') return;
    // Limitar 2 decimales
    if (monto.includes('.')) {
      const dec = monto.split('.')[1] || '';
      if (dec.length >= 2) return;
    }
    if (monto.length < 10) setMonto((prev) => prev + tecla);
  };

  // ── Seleccionar categoría ──
  const handleCategoria = (cat) => {
    hap.suave();
    setCategoriaSeleccionada(cat);
  };

  // ── Guardar gasto ──
  const handleGuardar = async () => {
    if (!monto || parseFloat(monto) === 0) {
      hap.error();
      mostrarToast('Escribe el monto primero', 'error');
      return;
    }
    if (!categoriaSeleccionada) {
      hap.error();
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
      const alertaCritica = alertas?.find(
        (a) => a.tipo === 'error' || a.tipo === 'advertencia'
      );

      hap.logro();

      if (alertaCritica) {
        mostrarToast(`⚠️ ${alertaCritica.mensaje}`, 'error');
      } else {
        mostrarToast(`$${monto} en ${categoriaSeleccionada.nombre} guardado`);
      }

      setGuardando(false);
      setTimeout(() => { router.replace('/(tabs)/'); }, 2200);

    } catch (error) {
      console.error('Error al guardar gasto:', error);
      mostrarToast('No se pudo guardar. Intenta de nuevo.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={estilos.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Toast visible={toastVisible} mensaje={toastMensaje} tipo={toastTipo} />

      <ScrollView
        contentContainerStyle={estilos.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={[estilos.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={estilos.btnVolver} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={estilos.titulo}>Nuevo gasto</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Display del monto ── */}
        <View style={estilos.montoContainer}>
          <Text style={estilos.montoPrefix}>$</Text>
          <Text style={[estilos.montoDisplay, !monto && estilos.montoPlaceholder]}>
            {monto || '0.00'}
          </Text>
          <View style={estilos.montoCaret} />
        </View>

        {/* ── Teclado numérico ── */}
        <View style={estilos.teclado}>
          {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map((tecla) => (
            <TouchableOpacity
              key={tecla}
              style={[estilos.tecla, tecla === '⌫' && estilos.teclaBorrar]}
              onPress={() => handleTecla(tecla)}
              activeOpacity={0.7}
            >
              <Text style={[estilos.teclaTxt, tecla === '⌫' && estilos.teclaBorrarTxt]}>
                {tecla}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Categorías — grid 4 columnas ── */}
        <View style={estilos.catGrid}>
          {CATEGORIAS.map((cat) => (
            <CategoriaAnimada
              key={cat.id}
              cat={cat}
              seleccionada={categoriaSeleccionada?.id === cat.id}
              onPress={() => handleCategoria(cat)}
            />
          ))}
        </View>

        {/* ── Descripción — estilo underline ── */}
        <TextInput
          style={estilos.inputDescripcion}
          placeholder="¿En qué gastaste?"
          placeholderTextColor={COLORS.textMuted}
          value={descripcion}
          onChangeText={setDescripcion}
          maxLength={100}
          returnKeyType="done"
        />

        {/* ── Chips de fecha ── */}
        <View style={estilos.fechaChips}>
          <TouchableOpacity
            style={[
              estilos.chip,
              fecha === formatearFechaISO(new Date()) && estilos.chipActivo,
            ]}
            onPress={() => { hap.suave(); setFecha(formatearFechaISO(new Date())); }}
          >
            <Text style={[
              estilos.chipTxt,
              fecha === formatearFechaISO(new Date()) && estilos.chipTxtActivo,
            ]}>
              Hoy
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              estilos.chip,
              fecha === formatearFechaISO(new Date(Date.now() - 86400000)) && estilos.chipActivo,
            ]}
            onPress={() => { hap.suave(); setFecha(formatearFechaISO(new Date(Date.now() - 86400000))); }}
          >
            <Text style={[
              estilos.chipTxt,
              fecha === formatearFechaISO(new Date(Date.now() - 86400000)) && estilos.chipTxtActivo,
            ]}>
              Ayer
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              estilos.chip,
              fecha !== formatearFechaISO(new Date()) &&
              fecha !== formatearFechaISO(new Date(Date.now() - 86400000)) &&
              estilos.chipActivo,
            ]}
            onPress={() => { hap.suave(); setMostrarPicker(true); }}
          >
            <Ionicons
              name="calendar-outline"
              size={13}
              color={
                fecha !== formatearFechaISO(new Date()) &&
                fecha !== formatearFechaISO(new Date(Date.now() - 86400000))
                  ? '#fff'
                  : COLORS.textSecondary
              }
            />
            <Text style={[
              estilos.chipTxt,
              fecha !== formatearFechaISO(new Date()) &&
              fecha !== formatearFechaISO(new Date(Date.now() - 86400000)) &&
              estilos.chipTxtActivo,
            ]}>
              Fecha
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
                hap.suave();
              }
            }}
          />
        )}

        {/* ── Botón guardar ── */}
        <TouchableOpacity
          style={[
            estilos.btnGuardar,
            (!monto || !categoriaSeleccionada || guardando) && estilos.btnGuardarDeshabilitado,
          ]}
          onPress={handleGuardar}
          disabled={!monto || !categoriaSeleccionada || guardando}
          activeOpacity={0.85}
        >
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={estilos.btnGuardarTxt}>
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 80,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  btnVolver: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },

  // Display del monto
  montoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  montoPrefix: {
    fontSize: 20,
    color: COLORS.textSecondary,
    fontVariant: ['tabular-nums'],
    marginRight: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  montoDisplay: {
    fontSize: 56,
    fontWeight: '300',
    color: COLORS.textPrimary,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
    lineHeight: 64,
  },
  montoPlaceholder: {
    color: COLORS.textMuted,
  },
  montoCaret: {
    width: 2,
    height: 40,
    backgroundColor: COLORS.primary,
    marginLeft: 4,
    alignSelf: 'center',
  },

  // Teclado numérico — grid 3 columnas
  teclado: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 6,
    justifyContent: 'center',
    marginBottom: 20,
  },
  tecla: {
    width: '28%',
    height: 56,
    borderRadius: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teclaBorrar: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
  },
  teclaTxt: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '500',
  },
  teclaBorrarTxt: {
    color: COLORS.textSecondary,
    fontSize: 18,
  },

  // Grid de categorías — 4 columnas
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  catOpt: {
    width: '22%',
    alignItems: 'center',
  },
  catCirculo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  catNombre: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Input descripción — estilo underline
  inputDescripcion: {
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  // Chips de fecha — pill shape
  fechaChips: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActivo: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipTxt: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  chipTxtActivo: {
    color: '#fff',
  },

  // Botón guardar — ancho completo, 56px, border-radius 16
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
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  btnGuardarDeshabilitado: {
    opacity: 0.35,
    shadowOpacity: 0,
    elevation: 0,
  },
  btnGuardarTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});
