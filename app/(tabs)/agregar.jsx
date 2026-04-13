// app/(tabs)/agregar.jsx
// Pantalla para registrar un nuevo gasto manualmente
// Flujo: monto → categoría → descripción → fecha → guardar

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants/colors';
import { CATEGORIAS } from '../../constants/categorias';
import { crearGasto } from '../../services/gastos';

// ─── HELPERS ──────────────────────────────────────────────

// Formatea la fecha como "YYYY-MM-DD" para guardar en Supabase
const formatearFechaISO = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

// Muestra la fecha en formato legible para el usuario
const formatearFechaLegible = (fechaISO) => {
  const [año, mes, dia] = fechaISO.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dia} ${meses[parseInt(mes) - 1]} ${año}`;
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────

export default function AgregarGasto() {
  // ── Estado del formulario ──
  const [monto, setMonto] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(formatearFechaISO(new Date()));
  const [guardando, setGuardando] = useState(false);

  // ── Manejo del teclado numérico ──
  const handleTecla = (tecla) => {
    // Vibración leve en cada tecla
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
    // Vibración de selección al elegir categoría
    Haptics.selectionAsync();
    setCategoriaSeleccionada(cat);
  };

  // ── Guardar gasto ──
  const handleGuardar = async () => {
    // Vibración media al presionar guardar
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!monto || parseFloat(monto) === 0) {
      Alert.alert('Falta el monto', 'Escribe cuánto gastaste primero.');
      return;
    }
    if (!categoriaSeleccionada) {
      Alert.alert('Falta la categoría', '¿En qué gastaste? Elige una categoría.');
      return;
    }

    setGuardando(true);
    try {
      await crearGasto({
        monto: parseFloat(monto),
        categoria_id: categoriaSeleccionada.dbId, // número entero para Supabase
        descripcion,
        fecha,
        origen: 'manual',
      });

      Alert.alert('✅ Gasto guardado', `$${monto} en ${categoriaSeleccionada.nombre}`, [
        { text: 'OK', onPress: () => router.replace('/(tabs)/') },
      ]);
    } catch (error) {
      console.error('Error al guardar gasto:', error);
      Alert.alert('Error', 'No se pudo guardar el gasto. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.btnCancelar}
            onPress={() => router.back()}
          >
            <Text style={styles.txtCancelar}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.titulo}>Nuevo gasto</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Display del monto ── */}
        <View style={styles.montoContainer}>
          <Text style={styles.montoLabel}>¿Cuánto gastaste?</Text>
          <Text style={[styles.montoDisplay, !monto && styles.montoPlaceholder]}>
            {monto ? `$${monto}` : '$0'}
          </Text>
          <Text style={styles.monedaLabel}>MXN</Text>
        </View>

        {/* ── Teclado numérico personalizado ── */}
        <View style={styles.teclado}>
          {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map((tecla) => (
            <TouchableOpacity
              key={tecla}
              style={[styles.tecla, tecla === '⌫' && styles.teclaBorrar]}
              onPress={() => handleTecla(tecla)}
              activeOpacity={0.7}
            >
              <Text style={[styles.teclaTxt, tecla === '⌫' && styles.teclaBorrarTxt]}>
                {tecla}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Selector de categorías ── */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Categoría</Text>
          <View style={styles.categoriasGrid}>
            {CATEGORIAS.map((cat) => {
              const seleccionada = categoriaSeleccionada?.id === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoriaBtn,
                    seleccionada && {
                      backgroundColor: cat.color + '30',
                      borderColor: cat.color,
                    },
                  ]}
                  onPress={() => handleCategoria(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.categoriaIcono}>{cat.icono}</Text>
                  <Text style={[
                    styles.categoriaNombre,
                    seleccionada && { color: cat.color },
                  ]}>
                    {cat.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Campo de descripción ── */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>
            Descripción <Text style={styles.opcional}>(opcional)</Text>
          </Text>
          <TextInput
            style={styles.inputDescripcion}
            placeholder="Ej: tacos de canasta, Uber al trabajo…"
            placeholderTextColor={COLORS.textMuted}
            value={descripcion}
            onChangeText={setDescripcion}
            maxLength={100}
            returnKeyType="done"
          />
        </View>

        {/* ── Selector de fecha ── */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Fecha</Text>
          <View style={styles.fechaRow}>
            {/* Botón: Ayer */}
            <TouchableOpacity
              style={[
                styles.fechaBtn,
                fecha === formatearFechaISO(new Date(Date.now() - 86400000)) && styles.fechaBtnActivo,
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setFecha(formatearFechaISO(new Date(Date.now() - 86400000)));
              }}
            >
              <Text style={styles.fechaBtnTxt}>Ayer</Text>
            </TouchableOpacity>

            {/* Botón: Hoy */}
            <TouchableOpacity
              style={[
                styles.fechaBtn,
                fecha === formatearFechaISO(new Date()) && styles.fechaBtnActivo,
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setFecha(formatearFechaISO(new Date()));
              }}
            >
              <Text style={styles.fechaBtnTxt}>Hoy</Text>
            </TouchableOpacity>

            {/* Muestra la fecha seleccionada */}
            <View style={styles.fechaDisplay}>
              <Text style={styles.fechaDisplayTxt}>
                📅 {formatearFechaLegible(fecha)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Botón Guardar ── */}
        <TouchableOpacity
          style={[
            styles.btnGuardar,
            (!monto || !categoriaSeleccionada) && styles.btnGuardarDeshabilitado,
          ]}
          onPress={handleGuardar}
          disabled={guardando || !monto || !categoriaSeleccionada}
          activeOpacity={0.85}
        >
          {guardando ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.btnGuardarTxt}>
              {monto && categoriaSeleccionada
                ? `Guardar $${monto}`
                : 'Guardar gasto'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 20,
  },
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