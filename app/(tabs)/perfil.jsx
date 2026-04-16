// /app/(tabs)/perfil.jsx
// Pantalla de perfil del usuario — incluye configuración de día de corte mensual

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../constants/colors';

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────
const formatMXN = (n) =>
  `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

// Genera días válidos 1-28 con descripción
const DIAS_CORTE = Array.from({ length: 28 }, (_, i) => {
  const dia = i + 1;
  let etiqueta = `Día ${dia}`;
  if (dia === 1) etiqueta = 'Día 1 — inicio de mes';
  if (dia === 15) etiqueta = 'Día 15 — quincena';
  return { dia, etiqueta };
});

// ──────────────────────────────────────────
// Sub-componente: fila de opción de perfil
// ──────────────────────────────────────────
function FilaOpcion({ icono, label, valor, onPress, peligro = false }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.filaOpcion,
        pressed && { opacity: 0.7 },
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.filaIcono,
          { backgroundColor: peligro ? COLORS.error + '20' : COLORS.primary + '15' },
        ]}
      >
        <Ionicons
          name={icono}
          size={18}
          color={peligro ? COLORS.error : COLORS.primary}
        />
      </View>
      <Text style={[styles.filaLabel, peligro && { color: COLORS.error }]}>
        {label}
      </Text>
      {valor ? (
        <Text style={styles.filaValor} numberOfLines={1}>
          {valor}
        </Text>
      ) : null}
      {!peligro && (
        <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
      )}
    </Pressable>
  );
}

// ──────────────────────────────────────────
// Pantalla principal
// ──────────────────────────────────────────
export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  // Estado del usuario
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [ingreso, setIngreso] = useState(0);
  const [diaCorte, setDiaCorte] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Modales
  const [modalNombreVisible, setModalNombreVisible] = useState(false);
  const [modalIngresoVisible, setModalIngresoVisible] = useState(false);
  const [modalCorteVisible, setModalCorteVisible] = useState(false);

  // Inputs temporales
  const [nombreInput, setNombreInput] = useState('');
  const [ingresoInput, setIngresoInput] = useState('');

  // ──────────────────────────────────────────
  // Cargar datos del usuario desde Supabase
  // ──────────────────────────────────────────
  async function cargarPerfil() {
    try {
      setCargando(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email || '');

      const { data: perfil } = await supabase
        .from('users')
        .select('nombre, ingreso_mensual, dia_corte')
        .eq('id', user.id)
        .single();

      setNombre(perfil?.nombre || user.email?.split('@')[0] || 'Usuario');
      setIngreso(perfil?.ingreso_mensual || 0);
      setDiaCorte(perfil?.dia_corte || 1);
    } catch (e) {
      console.error('Error cargando perfil:', e);
    } finally {
      setCargando(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      cargarPerfil();
    }, [])
  );

  // ──────────────────────────────────────────
  // Guardar nombre
  // ──────────────────────────────────────────
  async function handleGuardarNombre() {
    const nuevoNombre = nombreInput.trim();
    if (!nuevoNombre) {
      Alert.alert('Nombre inválido', 'El nombre no puede estar vacío.');
      return;
    }
    try {
      setGuardando(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('users')
        .upsert({ id: user.id, nombre: nuevoNombre, email: user.email });
      if (error) throw error;
      setNombre(nuevoNombre);
      setModalNombreVisible(false);
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el nombre.');
    } finally {
      setGuardando(false);
    }
  }

  // ──────────────────────────────────────────
  // Guardar ingreso mensual
  // ──────────────────────────────────────────
  async function handleGuardarIngreso() {
    const nuevoIngreso = parseFloat(ingresoInput);
    if (!ingresoInput || isNaN(nuevoIngreso) || nuevoIngreso <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a $0');
      return;
    }
    try {
      setGuardando(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          ingreso_mensual: nuevoIngreso,
        });
      if (error) throw error;
      setIngreso(nuevoIngreso);
      setModalIngresoVisible(false);
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el ingreso.');
    } finally {
      setGuardando(false);
    }
  }

  // ──────────────────────────────────────────
  // Guardar día de corte
  // ──────────────────────────────────────────
  async function handleGuardarDiaCorte(nuevoDia) {
    try {
      setGuardando(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          dia_corte: nuevoDia,
        });
      if (error) throw error;
      setDiaCorte(nuevoDia);
      setModalCorteVisible(false);
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el día de corte.');
    } finally {
      setGuardando(false);
    }
  }

  // ──────────────────────────────────────────
  // Cerrar sesión
  // ──────────────────────────────────────────
  function handleLogout() {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (e) {
              Alert.alert('Error', 'No se pudo cerrar la sesión.');
            }
          },
        },
      ]
    );
  }

  const inicial = nombre.charAt(0).toUpperCase() || '?';

  // Texto descriptivo del corte para mostrar en la fila
  const textoCorte =
    diaCorte === 1
      ? 'Día 1 — inicio de mes'
      : diaCorte === 15
      ? 'Día 15 — quincena'
      : `Día ${diaCorte} de cada mes`;

  // ──────────────────────────────────────────
  // Render principal
  // ──────────────────────────────────────────
  return (
    <View style={[styles.contenedor, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.cabecera}>
          <Text style={styles.titulo}>Perfil</Text>
        </View>

        {cargando ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* ── Avatar ── */}
            <View style={styles.avatarSeccion}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTexto}>{inicial}</Text>
              </View>
              <Text style={styles.nombreTexto}>{nombre}</Text>
              <Text style={styles.emailTexto}>{email}</Text>
            </View>

            {/* ── Sección: Cuenta ── */}
            <Text style={styles.seccionTitulo}>Cuenta</Text>
            <View style={styles.grupo}>
              <FilaOpcion
                icono="person-outline"
                label="Nombre"
                valor={nombre}
                onPress={() => {
                  setNombreInput(nombre);
                  setModalNombreVisible(true);
                }}
              />
              <View style={styles.separador} />
              <FilaOpcion
                icono="mail-outline"
                label="Email"
                valor={email}
                onPress={() => {}}
              />
            </View>

            {/* ── Sección: Finanzas ── */}
            <Text style={styles.seccionTitulo}>Finanzas</Text>
            <View style={styles.grupo}>
              <FilaOpcion
                icono="wallet-outline"
                label="Ingreso mensual"
                valor={ingreso > 0 ? formatMXN(ingreso) : 'Sin configurar'}
                onPress={() => {
                  setIngresoInput(ingreso > 0 ? String(ingreso) : '');
                  setModalIngresoVisible(true);
                }}
              />
              <View style={styles.separador} />
              {/* Nueva opción: día de corte */}
              <FilaOpcion
                icono="calendar-outline"
                label="Día de corte"
                valor={textoCorte}
                onPress={() => setModalCorteVisible(true)}
              />
            </View>

            {/* Explicación breve del día de corte */}
            <Text style={styles.notaExplicacion}>
              📅 El día de corte define cuándo empieza tu mes financiero. Si cobras el 15,
              ponlo en 15 y tus gastos se agruparán del 15 al 14 del siguiente mes.
            </Text>

            {/* ── Sección: Sesión ── */}
            <Text style={styles.seccionTitulo}>Sesión</Text>
            <View style={styles.grupo}>
              <FilaOpcion
                icono="log-out-outline"
                label="Cerrar sesión"
                onPress={handleLogout}
                peligro
              />
            </View>

            <View style={{ height: 60 }} />
          </>
        )}
      </ScrollView>

      {/* ══════════════════════════════════════
          MODAL: Editar nombre
      ══════════════════════════════════════ */}
      <Modal
        visible={modalNombreVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalNombreVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalNombreVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Pressable style={styles.modalContenido} onPress={() => {}}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitulo}>Nombre</Text>
              <TextInput
                style={styles.inputTexto}
                value={nombreInput}
                onChangeText={setNombreInput}
                placeholder="Tu nombre"
                placeholderTextColor={COLORS.textSecondary}
                autoFocus
                maxLength={40}
              />
              <View style={styles.modalBotones}>
                <Pressable
                  style={styles.botonCancelar}
                  onPress={() => setModalNombreVisible(false)}
                >
                  <Text style={styles.botonCancelarTexto}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={styles.botonGuardar}
                  onPress={handleGuardarNombre}
                  disabled={guardando}
                >
                  {guardando ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.botonGuardarTexto}>Guardar</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ══════════════════════════════════════
          MODAL: Editar ingreso mensual
      ══════════════════════════════════════ */}
      <Modal
        visible={modalIngresoVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalIngresoVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalIngresoVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Pressable style={styles.modalContenido} onPress={() => {}}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitulo}>Ingreso mensual</Text>
              <Text style={styles.modalSubtitulo}>
                Se usa para calcular cuánto tienes disponible cada mes
              </Text>
              <View style={styles.inputMontoContenedor}>
                <Text style={styles.inputPrefijo}>$</Text>
                <TextInput
                  style={styles.inputMonto}
                  value={ingresoInput}
                  onChangeText={setIngresoInput}
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  autoFocus
                />
              </View>
              <View style={styles.modalBotones}>
                <Pressable
                  style={styles.botonCancelar}
                  onPress={() => setModalIngresoVisible(false)}
                >
                  <Text style={styles.botonCancelarTexto}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={styles.botonGuardar}
                  onPress={handleGuardarIngreso}
                  disabled={guardando}
                >
                  {guardando ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.botonGuardarTexto}>Guardar</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ══════════════════════════════════════
          MODAL: Selector de día de corte
          Lista de días del 1 al 28
      ══════════════════════════════════════ */}
      <Modal
        visible={modalCorteVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalCorteVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalCorteVisible(false)}
        >
          <Pressable style={[styles.modalContenido, { paddingBottom: 0 }]} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Día de corte</Text>
            <Text style={styles.modalSubtitulo}>
              ¿Qué día del mes empieza tu periodo financiero?
            </Text>

            {/* Lista de días con FlatList para scroll interno */}
            <FlatList
              data={DIAS_CORTE}
              keyExtractor={(item) => String(item.dia)}
              style={{ maxHeight: 340 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const seleccionado = item.dia === diaCorte;
                return (
                  <Pressable
                    style={[
                      styles.diaItem,
                      seleccionado && styles.diaItemActivo,
                    ]}
                    onPress={() => handleGuardarDiaCorte(item.dia)}
                  >
                    {/* Número grande del día */}
                    <View
                      style={[
                        styles.diaNumero,
                        seleccionado && styles.diaNumeroActivo,
                      ]}
                    >
                      <Text
                        style={[
                          styles.diaNumeroTexto,
                          seleccionado && styles.diaNumeroTextoActivo,
                        ]}
                      >
                        {item.dia}
                      </Text>
                    </View>

                    {/* Etiqueta descriptiva */}
                    <Text
                      style={[
                        styles.diaEtiqueta,
                        seleccionado && { color: COLORS.primary, fontWeight: '600' },
                      ]}
                    >
                      {item.etiqueta}
                    </Text>

                    {/* Checkmark si está seleccionado */}
                    {seleccionado && (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                    )}
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separador} />}
            />

            {/* Botón cancelar */}
            <Pressable
              style={[styles.botonCancelar, { margin: 16 }]}
              onPress={() => setModalCorteVisible(false)}
            >
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ──────────────────────────────────────────
// Estilos
// ──────────────────────────────────────────
const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  cabecera: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // ── Avatar ──
  avatarSeccion: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarTexto: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
  },
  nombreTexto: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emailTexto: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // ── Secciones ──
  seccionTitulo: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  grupo: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  separador: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 56,
  },

  // ── Fila de opción ──
  filaOpcion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  filaIcono: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filaLabel: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  filaValor: {
    fontSize: 14,
    color: COLORS.textSecondary,
    maxWidth: 140,
    textAlign: 'right',
  },

  // ── Nota de explicación ──
  notaExplicacion: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginHorizontal: 20,
    marginTop: 10,
    lineHeight: 19,
  },

  // ── Modal base ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContenido: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitulo: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 19,
  },

  // ── Input de texto ──
  inputTexto: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // ── Input de monto ──
  inputMontoContenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  inputPrefijo: {
    fontSize: 24,
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  inputMonto: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingVertical: 12,
  },

  // ── Selector de día de corte ──
  diaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 12,
  },
  diaItemActivo: {
    backgroundColor: COLORS.primary + '12',
  },
  diaNumero: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  diaNumeroActivo: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  diaNumeroTexto: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  diaNumeroTextoActivo: {
    color: '#fff',
  },
  diaEtiqueta: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
  },

  // ── Botones ──
  modalBotones: {
    flexDirection: 'row',
    gap: 10,
  },
  botonCancelar: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  botonCancelarTexto: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  botonGuardar: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  botonGuardarTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
