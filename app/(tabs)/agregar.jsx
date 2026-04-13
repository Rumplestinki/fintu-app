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
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants/colors';
import { CATEGORIAS } from '../../constants/categorias';
import { crearGasto } from '../../services/gastos';

// ─── HELPERS ──────────────────────────────────────────────

const formatearFechaISO = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

const formatearFechaLegible = (fechaISO) => {
  const [año, mes, dia] = fechaISO.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dia} ${meses[parseInt(mes) - 1]} ${año}`;
};

// ─── COMPONENTE TOAST ─────────────────────────────────────
// Notificación visual dentro de la app, sin Alert nativo

function Toast({ visible, mensaje, tipo = 'exito' }) {
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[
      estilos.toast,
      tipo === 'exito' ? estilos.toastExito : estilos.toastError,
      { opacity },
    ]}>
      <Text style={estilos.toastEmoji}>{tipo === 'exito' ? '✅' : '❌'}</Text>
      <Text style={estilos.toastTexto}>{mensaje}</Text>
    </Animated.View>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────

export default function AgregarGasto() {
  const [monto, setMonto] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(formatearFechaISO(new Date()));
  const [guardando, setGuardando] = useState(false);

  // Estado del toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMensaje, setToastMensaje] = useState('');
  const [toastTipo, setToastTipo] = useState('exito');

  // ── Reset completo del formulario cada vez que se enfoca la pantalla ──
  // Esto resuelve que queden los datos al navegar entre tabs
  useFocusEffect(
    useCallback(() => {
      setMonto('');
      setCategoriaSeleccionada(null);
      setDescripcion('');
      setFecha(formatearFechaISO(new Date()));
      setGuardando(false);
    }, [])
  );

  // ── Mostrar toast ──
  const mostrarToast = (mensaje, tipo = 'exito') => {
    setToastMensaje(mensaje);
    setToastTipo(tipo);
    setToastVisible(false); // reset para re-trigger el useEffect del Toast
    setTimeout(() => setToastVisible(true), 50);
  };

  // ── Teclado numérico ──
  const handleTecla = (tecla) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (tecla === '⌫') {
      setMonto((prev) => prev.slice(0, -1));
      return;
    }
    if (tecla === '.' && monto.includes('.')) return;
    if (tecla === '.' && monto === '') return;
    if (monto.length >= 10) return;
    setMonto((prev) => prev + tecla);
  };

  // ── Seleccionar categoría ──
  const handleCategoria = (cat) => {
    Haptics.selectionAsync();
    setCategoriaSeleccionada(cat);
  };

  // ── Guardar gasto ──
  const handleGuardar = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!monto || parseFloat(monto) === 0) {
      mostrarToast('Escribe el monto primero', 'error');
      return;
    }
    if (!categoriaSeleccionada) {
      mostrarToast('Elige una categoría', 'error');
      return;
    }

    setGuardando(true);
    try {
      await crearGasto({
        monto: parseFloat(monto),
        categoria_id: categoriaSeleccionada.dbId,
        descripcion,
        fecha,
        origen: 'manual',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      mostrarToast(`$${monto} en ${categoriaSeleccionada.nombre} guardado`);

      // Esperar que el usuario vea el toast antes de navegar
      setTimeout(() => {
        router.replace('/(tabs)/');
      }, 2200);

    } catch (error) {
      console.error('Error al guardar gasto:', error);
      mostrarToast('No se pudo guardar. Intenta de nuevo.', 'error');
      setGuardando(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={estilos.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Toast flotante — aparece arriba de todo */}
      <Toast visible={toastVisible} mensaje={toastMensaje} tipo={toastTipo} />

      <ScrollView
        contentContainerStyle={estilos.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={estilos.header}>
          <TouchableOpacity style={estilos.btnCancelar} onPress={() => router.back()}>
            <Text style={estilos.txtCancelar}>✕</Text>
          </TouchableOpacity>
          <Text style={estilos.titulo}>Nuevo gasto</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Display del monto ── */}
        <View style={estilos.montoContainer}>
          <Text style={estilos.montoLabel}>¿Cuánto gastaste?</Text>
          <Text style={[estilos.montoDisplay, !monto && estilos.montoPlaceholder]}>
            {monto ? `$${monto}` : '$0'}
          </Text>
          <Text style={estilos.monedaLabel}>MXN</Text>
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

        {/* ── Categorías ── */}
        <View style={estilos.seccion}>
          <Text style={estilos.seccionTitulo}>Categoría</Text>
          <View style={estilos.categoriasGrid}>
            {CATEGORIAS.map((cat) => {
              const seleccionada = categoriaSeleccionada?.id === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    estilos.categoriaBtn,
                    seleccionada && {
                      backgroundColor: cat.color + '30',
                      borderColor: cat.color,
                    },
                  ]}
                  onPress={() => handleCategoria(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={estilos.categoriaIcono}>{cat.icono}</Text>
                  <Text style={[estilos.categoriaNombre, seleccionada && { color: cat.color }]}>
                    {cat.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Descripción ── */}
        <View style={estilos.seccion}>
          <Text style={estilos.seccionTitulo}>
            Descripción <Text style={estilos.opcional}>(opcional)</Text>
          </Text>
          <TextInput
            style={estilos.inputDescripcion}
            placeholder="Ej: tacos de canasta, Uber al trabajo…"
            placeholderTextColor={COLORS.textMuted}
            value={descripcion}
            onChangeText={setDescripcion}
            maxLength={100}
            returnKeyType="done"
          />
        </View>

        {/* ── Fecha ── */}
        <View style={estilos.seccion}>
          <Text style={estilos.seccionTitulo}>Fecha</Text>
          <View style={estilos.fechaRow}>
            <TouchableOpacity
              style={[
                estilos.fechaBtn,
                fecha === formatearFechaISO(new Date(Date.now() - 86400000)) && estilos.fechaBtnActivo,
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setFecha(formatearFechaISO(new Date(Date.now() - 86400000)));
              }}
            >
              <Text style={estilos.fechaBtnTxt}>Ayer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                estilos.fechaBtn,
                fecha === formatearFechaISO(new Date()) && estilos.fechaBtnActivo,
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setFecha(formatearFechaISO(new Date()));
              }}
            >
              <Text style={estilos.fechaBtnTxt}>Hoy</Text>
            </TouchableOpacity>

            <View style={estilos.fechaDisplay}>
              <Text style={estilos.fechaDisplayTxt}>
                📅 {formatearFechaLegible(fecha)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Botón Guardar ── */}
        <TouchableOpacity
          style={[
            estilos.btnGuardar,
            (!monto || !categoriaSeleccionada) && estilos.btnGuardarDeshabilitado,
          ]}
          onPress={handleGuardar}
          disabled={guardando || !monto || !categoriaSeleccionada}
          activeOpacity={0.85}
        >
          {guardando ? (
            <ActivityIndicator color={COLORS.white} />
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
    paddingBottom: 20,
  },

  // Toast
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
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
  toastEmoji: {
    fontSize: 18,
  },
  toastTexto: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  btnCancelar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txtCancelar: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  titulo: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },

  // Monto
  montoContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  montoLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  montoDisplay: {
    color: COLORS.textPrimary,
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: -2,
  },
  montoPlaceholder: {
    color: COLORS.textMuted,
  },
  monedaLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
  },

  // Teclado
  teclado: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 32,
    gap: 12,
    justifyContent: 'center',
    marginBottom: 24,
  },
  tecla: {
    width: '28%',
    aspectRatio: 1.8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teclaBorrar: {
    backgroundColor: COLORS.surfaceLight,
  },
  teclaTxt: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '500',
  },
  teclaBorrarTxt: {
    color: COLORS.textSecondary,
    fontSize: 20,
  },

  // Secciones
  seccion: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  seccionTitulo: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  opcional: {
    color: COLORS.textMuted,
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
  },

  // Categorías
  categoriasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoriaBtn: {
    width: '30%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  categoriaIcono: {
    fontSize: 24,
    marginBottom: 4,
  },
  categoriaNombre: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Descripción
  inputDescripcion: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 15,
  },

  // Fecha
  fechaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fechaBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  fechaBtnActivo: {
    backgroundColor: COLORS.primary + '25',
    borderColor: COLORS.primary,
  },
  fechaBtnTxt: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  fechaDisplay: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  fechaDisplayTxt: {
    color: COLORS.textPrimary,
    fontSize: 13,
  },

  // Botón guardar
  btnGuardar: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 18,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    alignItems: 'center',
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
  },
  btnGuardarTxt: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
});