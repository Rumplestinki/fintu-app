// /app/(tabs)/perfil.jsx
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';

// ──────────────────────────────────────────
// Formatea número a pesos mexicanos
// ──────────────────────────────────────────
function formatMXN(monto) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(monto || 0);
}

// ──────────────────────────────────────────
// Fila de opción del perfil
// ──────────────────────────────────────────
function FilaOpcion({ icono, label, valor, onPress, peligro }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.filaOpcion,
        pressed && styles.filaOpcionPresionada,
      ]}
      onPress={onPress}
    >
      <View style={[styles.filaIcono, peligro && styles.filaIconoPeligro]}>
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
        <Text style={styles.filaValor} numberOfLines={1}>{valor}</Text>
      ) : null}
      {!peligro && (
        <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
      )}
    </Pressable>
  );
}

// ──────────────────────────────────────────
// Pantalla de perfil
// ──────────────────────────────────────────
export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  // Estado del usuario
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [ingreso, setIngreso] = useState(0);
  const [cargando, setCargando] = useState(true);

  // Modal editar nombre
  const [modalNombreVisible, setModalNombreVisible] = useState(false);
  const [nombreInput, setNombreInput] = useState('');

  // Modal editar ingreso
  const [modalIngresoVisible, setModalIngresoVisible] = useState(false);
  const [ingresoInput, setIngresoInput] = useState('');

  const [guardando, setGuardando] = useState(false);

  // ──────────────────────────────────────────
  // Cargar datos del usuario
  // ──────────────────────────────────────────
  async function cargarPerfil() {
    try {
      setCargando(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email || '');

      const { data: perfil } = await supabase
        .from('users')
        .select('nombre, ingreso_mensual')
        .eq('id', user.id)
        .single();

      setNombre(perfil?.nombre || user.email?.split('@')[0] || 'Usuario');
      setIngreso(perfil?.ingreso_mensual || 0);
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
            {/* Avatar */}
            <View style={styles.avatarSeccion}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTexto}>{inicial}</Text>
              </View>
              <Text style={styles.nombre}>{nombre}</Text>
              <Text style={styles.email}>{email}</Text>
            </View>

            {/* Sección cuenta */}
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

            {/* Sección finanzas */}
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
            </View>

            {/* Sección app */}
            <Text style={styles.seccionTitulo}>App</Text>
            <View style={styles.grupo}>
              <FilaOpcion
                icono="moon-outline"
                label="Modo oscuro"
                valor="Activado"
                onPress={() => {}}
              />
              <View style={styles.separador} />
              <FilaOpcion
                icono="cash-outline"
                label="Moneda"
                valor="MXN"
                onPress={() => {}}
              />
            </View>

            {/* Sesión */}
            <Text style={styles.seccionTitulo}>Sesión</Text>
            <View style={styles.grupo}>
              <FilaOpcion
                icono="log-out-outline"
                label="Cerrar sesión"
                peligro
                onPress={handleLogout}
              />
            </View>

            <Text style={styles.version}>Fintú v1.0.0 — MVP</Text>
            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      {/* ── MODAL EDITAR NOMBRE ── */}
      <Modal
        visible={modalNombreVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalNombreVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalNombreVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={styles.modalContenido}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitulo}>Editar nombre</Text>
              <TextInput
                style={styles.input}
                value={nombreInput}
                onChangeText={setNombreInput}
                placeholder="Tu nombre"
                placeholderTextColor={COLORS.textSecondary}
                autoFocus
                maxLength={40}
              />
              <View style={styles.modalBotones}>
                <Pressable style={styles.botonCancelar} onPress={() => setModalNombreVisible(false)}>
                  <Text style={styles.botonCancelarTexto}>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.botonGuardar} onPress={handleGuardarNombre} disabled={guardando}>
                  {guardando
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.botonGuardarTexto}>Guardar</Text>
                  }
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ── MODAL EDITAR INGRESO ── */}
      <Modal
        visible={modalIngresoVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalIngresoVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalIngresoVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={styles.modalContenido}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitulo}>Ingreso mensual</Text>
              <Text style={styles.modalSubtitulo}>
                Este número se usa para calcular cuánto tienes disponible cada mes
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
                <Pressable style={styles.botonCancelar} onPress={() => setModalIngresoVisible(false)}>
                  <Text style={styles.botonCancelarTexto}>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.botonGuardar} onPress={handleGuardarIngreso} disabled={guardando}>
                  {guardando
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.botonGuardarTexto}>Guardar</Text>
                  }
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

    </View>
  );
}

// ──────────────────────────────────────────
// Estilos
// ──────────────────────────────────────────
const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORS.background },
  cabecera: { paddingHorizontal: 20, paddingVertical: 16 },
  titulo: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '700' },

  avatarSeccion: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarTexto: { fontSize: 32, fontWeight: '700', color: '#fff' },
  nombre: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '600', marginBottom: 4 },
  email: { color: COLORS.textSecondary, fontSize: 14 },

  seccionTitulo: {
    color: COLORS.textSecondary, fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginHorizontal: 20, marginTop: 24, marginBottom: 8,
  },
  grupo: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    marginHorizontal: 20, overflow: 'hidden',
  },
  separador: { height: 1, backgroundColor: COLORS.border, marginLeft: 56 },

  filaOpcion: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  filaOpcionPresionada: { backgroundColor: COLORS.surfaceLight },
  filaIcono: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center', alignItems: 'center',
  },
  filaIconoPeligro: { backgroundColor: COLORS.error + '20' },
  filaLabel: { color: COLORS.textPrimary, fontSize: 15, flex: 1 },
  filaValor: {
    color: COLORS.textSecondary, fontSize: 14,
    maxWidth: 140, textAlign: 'right', marginRight: 4,
  },

  version: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginTop: 32 },

  // Modales
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  modalContenido: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: COLORS.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  modalTitulo: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '600', marginBottom: 6 },
  modalSubtitulo: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 16 },

  input: {
    backgroundColor: COLORS.background, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    color: COLORS.textPrimary, fontSize: 16, marginBottom: 20,
  },
  inputMontoContenedor: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 12,
    paddingHorizontal: 16, marginBottom: 24,
  },
  inputPrefijo: { color: COLORS.textSecondary, fontSize: 24, marginRight: 4 },
  inputMonto: {
    flex: 1, color: COLORS.textPrimary, fontSize: 32,
    fontWeight: '600', paddingVertical: 16,
  },

  modalBotones: { flexDirection: 'row', gap: 10 },
  botonCancelar: {
    flex: 1, height: 48, borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center',
  },
  botonCancelarTexto: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '500' },
  botonGuardar: {
    flex: 2, height: 48, borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  botonGuardarTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
});