// app/(tabs)/perfil.jsx
// Pantalla de perfil — diseño Soft Dark Luxury

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
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../constants/colors';
import { formatMXN } from '../../utils/formato';

// Genera días válidos 1-28
const DIAS_CORTE = Array.from({ length: 28 }, (_, i) => {
  const dia = i + 1;
  let etiqueta = `Día ${dia}`;
  if (dia === 1) etiqueta = 'Día 1 — inicio de mes';
  if (dia === 15) etiqueta = 'Día 15 — quincena';
  return { dia, etiqueta };
});

// ─── FILA DE CONFIGURACIÓN ────────────────────────────────
function FilaConfig({ emoji, label, valor, onPress, peligro = false }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.filaConfig, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <Text style={styles.filaEmoji}>{emoji}</Text>
      <Text style={[styles.filaLabel, peligro && { color: COLORS.error }]}>{label}</Text>
      {valor && <Text style={styles.filaValor} numberOfLines={1}>{valor}</Text>}
      {!peligro && (
        <Text style={styles.filaChevron}>›</Text>
      )}
    </Pressable>
  );
}

// ─── PANTALLA PRINCIPAL ───────────────────────────────────
export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  // Datos del usuario
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [ingreso, setIngreso] = useState(0);
  const [isr, setIsr] = useState(0);
  const [imss, setImss] = useState(0);
  const [iva, setIva] = useState(0);
  const [vales, setVales] = useState(0);
  const [fondoAhorro, setFondoAhorro] = useState(0);
  const [frecuencia, setFrecuencia] = useState('mensual');
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
  const [isrInput, setIsrInput] = useState('');
  const [imssInput, setImssInput] = useState('');
  const [ivaInput, setIvaInput] = useState('');
  const [valesInput, setValesInput] = useState('');
  const [fondoInput, setFondoInput] = useState('');

  // ── Cargar perfil desde Supabase ──
  async function cargarPerfil() {
    try {
      setCargando(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || '');

      const { data: perfil } = await supabase
        .from('users')
        .select('nombre, ingreso_mensual, dia_corte, isr, imss, iva, vales_despensa, frecuencia_pago, fondo_ahorro')
        .eq('id', user.id)
        .single();

      setNombre(perfil?.nombre || user.email?.split('@')[0] || 'Usuario');
      setIngreso(perfil?.ingreso_mensual || 0);
      setDiaCorte(perfil?.dia_corte || 1);
      setIsr(perfil?.isr || 0);
      setImss(perfil?.imss || 0);
      setIva(perfil?.iva || 0);
      setVales(perfil?.vales_despensa || 0);
      setFrecuencia(perfil?.frecuencia_pago || 'mensual');
      setFondoAhorro(perfil?.fondo_ahorro || 0);
    } catch (e) {
      console.error('Error cargando perfil:', e);
    } finally {
      setCargando(false);
    }
  }

  useFocusEffect(useCallback(() => { cargarPerfil(); }, []));

  // ── Guardar nombre ──
  async function handleGuardarNombre() {
    const nuevoNombre = nombreInput.trim();
    if (!nuevoNombre) { Alert.alert('Nombre inválido', 'El nombre no puede estar vacío.'); return; }
    try {
      setGuardando(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('users')
        .upsert({ id: user.id, nombre: nuevoNombre, email: user.email });
      if (error) throw error;
      setNombre(nuevoNombre);
      setModalNombreVisible(false);
    } catch (e) { Alert.alert('Error', 'No se pudo guardar el nombre.'); }
    finally { setGuardando(false); }
  }

  // ── Guardar ingreso y deducciones ──
  async function handleGuardarIngreso() {
    const nIngreso = parseFloat(ingresoInput) || 0;
    const nIsr = parseFloat(isrInput) || 0;
    const nImss = parseFloat(imssInput) || 0;
    const nIva = parseFloat(ivaInput) || 0;
    const nVales = parseFloat(valesInput) || 0;
    const nFondo = parseFloat(fondoInput) || 0;

    if (nIngreso <= 0) { Alert.alert('Monto inválido', 'Ingresa tu sueldo base'); return; }
    try {
      setGuardando(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('users').upsert({
        id: user.id,
        email: user.email,
        ingreso_mensual: nIngreso,
        isr: nIsr,
        imss: nImss,
        iva: nIva,
        vales_despensa: nVales,
        frecuencia_pago: frecuencia,
        fondo_ahorro: nFondo,
      });
      if (error) throw error;
      setIngreso(nIngreso);
      setIsr(nIsr); setImss(nImss); setIva(nIva);
      setVales(nVales); setFondoAhorro(nFondo);
      setModalIngresoVisible(false);
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar.');
    } finally { setGuardando(false); }
  }

  // ── Guardar día de corte ──
  async function handleGuardarDiaCorte(nuevoDia) {
    try {
      setGuardando(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('users')
        .upsert({ id: user.id, email: user.email, dia_corte: nuevoDia });
      if (error) throw error;
      setDiaCorte(nuevoDia);
      setModalCorteVisible(false);
    } catch (e) { Alert.alert('Error', 'No se pudo guardar el día de corte.'); }
    finally { setGuardando(false); }
  }

  function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => {
        try { await logout(); } catch (e) { Alert.alert('Error', 'No se pudo cerrar sesión'); }
      }},
    ]);
  }

  const factor = frecuencia === 'quincenal' ? 2 : 1;
  const netoMensual = (ingreso - isr - imss - iva - fondoAhorro + vales) * factor;
  const tasaAhorro = netoMensual > 0 ? ((netoMensual - (netoMensual * 0.3)) / netoMensual * 100).toFixed(1) : 0;
  const iniciales = nombre.substring(0, 2).toUpperCase();

  return (
    <View style={[styles.contenedor, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {cargando ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 80 }} />
        ) : (
          <>
            {/* ── HERO: Avatar + nombre + email ── */}
            <View style={styles.hero}>
              <LinearGradient
                colors={['#6C63FF', '#A78BFA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarTexto}>{iniciales}</Text>
              </LinearGradient>
              <Text style={styles.nombreTexto}>{nombre}</Text>
              <Text style={styles.emailTexto}>{email}</Text>
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeTexto}>PLAN GRATUITO</Text>
              </View>
            </View>

            {/* ── CARD INGRESO MENSUAL ── */}
            <View style={styles.cardIngreso}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ingresoLabel}>INGRESO MENSUAL</Text>
                <Text style={styles.ingresoMonto}>{formatMXN(netoMensual)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                  <Text style={styles.tasaLabel}>▲</Text>
                  <Text style={styles.tasaLabel}>Tasa de ahorro estimada</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.btnEditar}
                onPress={() => {
                  setIngresoInput(String(ingreso));
                  setIsrInput(String(isr));
                  setImssInput(String(imss));
                  setIvaInput(String(iva));
                  setValesInput(String(vales));
                  setFondoInput(String(fondoAhorro));
                  setModalIngresoVisible(true);
                }}
              >
                <Ionicons name="pencil-outline" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            {/* ── SECCIÓN: CUENTA ── */}
            <Text style={styles.seccionLabel}>CUENTA</Text>
            <View style={styles.grupoConfig}>
              <FilaConfig
                emoji="👤"
                label="Editar perfil"
                valor={nombre}
                onPress={() => { setNombreInput(nombre); setModalNombreVisible(true); }}
              />
              <View style={styles.separador} />
              <FilaConfig emoji="✉️" label="Email" valor={email} onPress={() => {}} />
            </View>

            {/* ── SECCIÓN: PREFERENCIAS ── */}
            <Text style={styles.seccionLabel}>PREFERENCIAS</Text>
            <View style={styles.grupoConfig}>
              <FilaConfig emoji="💱" label="Moneda" valor="MXN $" onPress={() => {}} />
              <View style={styles.separador} />
              <FilaConfig emoji="🌙" label="Apariencia" valor="Oscuro" onPress={() => {}} />
              <View style={styles.separador} />
              <FilaConfig
                emoji="📅"
                label="Día de corte"
                valor={diaCorte === 1 ? 'Día 1' : diaCorte === 15 ? 'Día 15' : `Día ${diaCorte}`}
                onPress={() => setModalCorteVisible(true)}
              />
            </View>

            {/* ── SECCIÓN: DATOS ── */}
            <Text style={styles.seccionLabel}>DATOS</Text>
            <View style={styles.grupoConfig}>
              <FilaConfig emoji="📊" label="Exportar reporte PDF" onPress={() => {}} />
              <View style={styles.separador} />
              <FilaConfig emoji="🗑️" label="Limpiar historial" onPress={() => {}} />
            </View>

            {/* ── SECCIÓN: SOPORTE ── */}
            <Text style={styles.seccionLabel}>SOPORTE</Text>
            <View style={styles.grupoConfig}>
              <FilaConfig emoji="💬" label="Ayuda" onPress={() => {}} />
              <View style={styles.separador} />
              <FilaConfig emoji="⭐" label="Calificar app" onPress={() => {}} />
            </View>

            {/* ── BOTÓN CERRAR SESIÓN ── */}
            <TouchableOpacity style={styles.btnCerrarSesion} onPress={handleLogout}>
              <Text style={styles.btnCerrarSesionTexto}>Cerrar sesión</Text>
            </TouchableOpacity>

            <View style={{ height: 110 }} />
          </>
        )}
      </ScrollView>

      {/* ── MODALES ── */}

      {/* Modal: Editar nombre */}
      <Modal visible={modalNombreVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setModalNombreVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={styles.modalContenido} onPress={() => {}}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitulo}>Editar nombre</Text>
              <TextInput
                style={styles.inputTexto}
                value={nombreInput}
                onChangeText={setNombreInput}
                autoFocus
              />
              <View style={styles.modalBotones}>
                <Pressable style={styles.botonCancelar} onPress={() => setModalNombreVisible(false)}>
                  <Text style={styles.botonCancelarTexto}>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.botonGuardar} onPress={handleGuardarNombre}>
                  <Text style={styles.botonGuardarTexto}>Guardar</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Modal: Configurar ingreso */}
      <Modal visible={modalIngresoVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setModalIngresoVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <Pressable style={styles.modalContenidoScroll} onPress={() => {}}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitulo}>Configurar Ingreso</Text>

              {/* Tab frecuencia */}
              <View style={styles.tabFrecuencia}>
                <Pressable style={[styles.tabBtn, frecuencia === 'mensual' && styles.tabBtnActivo]} onPress={() => setFrecuencia('mensual')}>
                  <Text style={[styles.tabBtnTexto, frecuencia === 'mensual' && styles.tabBtnTextoActivo]}>Mensual</Text>
                </Pressable>
                <Pressable style={[styles.tabBtn, frecuencia === 'quincenal' && styles.tabBtnActivo]} onPress={() => setFrecuencia('quincenal')}>
                  <Text style={[styles.tabBtnTexto, frecuencia === 'quincenal' && styles.tabBtnTextoActivo]}>Quincenal</Text>
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                <Text style={styles.labelInput}>Sueldo base ({frecuencia})</Text>
                <View style={styles.inputMontoContenedor}>
                  <Text style={styles.inputPrefijo}>$</Text>
                  <TextInput style={styles.inputMonto} value={ingresoInput} onChangeText={setIngresoInput} placeholder="0" keyboardType="numeric" />
                </View>

                <View style={styles.rowInputs}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labelInput}>ISR</Text>
                    <View style={styles.inputMontoContenedor}>
                      <Text style={styles.inputPrefijo}>$</Text>
                      <TextInput style={styles.inputMonto} value={isrInput} onChangeText={setIsrInput} placeholder="0" keyboardType="numeric" />
                    </View>
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labelInput}>IMSS</Text>
                    <View style={styles.inputMontoContenedor}>
                      <Text style={styles.inputPrefijo}>$</Text>
                      <TextInput style={styles.inputMonto} value={imssInput} onChangeText={setImssInput} placeholder="0" keyboardType="numeric" />
                    </View>
                  </View>
                </View>

                <View style={styles.rowInputs}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labelInput}>IVA / Otros</Text>
                    <View style={styles.inputMontoContenedor}>
                      <Text style={styles.inputPrefijo}>$</Text>
                      <TextInput style={styles.inputMonto} value={ivaInput} onChangeText={setIvaInput} placeholder="0" keyboardType="numeric" />
                    </View>
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labelInput}>Vales (+)</Text>
                    <View style={styles.inputMontoContenedor}>
                      <Text style={styles.inputPrefijo}>$</Text>
                      <TextInput style={styles.inputMonto} value={valesInput} onChangeText={setValesInput} placeholder="0" keyboardType="numeric" />
                    </View>
                  </View>
                </View>

                <Text style={styles.labelInput}>Fondo de ahorro</Text>
                <View style={styles.inputMontoContenedor}>
                  <Text style={styles.inputPrefijo}>$</Text>
                  <TextInput style={styles.inputMonto} value={fondoInput} onChangeText={setFondoInput} placeholder="0" keyboardType="numeric" />
                </View>

                <View style={styles.resumenNeto}>
                  <Text style={styles.resumenNetoLabel}>Neto mensual proyectado:</Text>
                  <Text style={styles.resumenNetoValor}>
                    {formatMXN(((parseFloat(ingresoInput)||0) - (parseFloat(isrInput)||0) - (parseFloat(imssInput)||0) - (parseFloat(ivaInput)||0) - (parseFloat(fondoInput)||0) + (parseFloat(valesInput)||0)) * (frecuencia === 'quincenal' ? 2 : 1))}
                  </Text>
                </View>
              </ScrollView>

              <View style={[styles.modalBotones, { marginTop: 20 }]}>
                <Pressable style={styles.botonCancelar} onPress={() => setModalIngresoVisible(false)}>
                  <Text style={styles.botonCancelarTexto}>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.botonGuardar} onPress={handleGuardarIngreso} disabled={guardando}>
                  {guardando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.botonGuardarTexto}>Guardar</Text>}
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Modal: Día de corte */}
      <Modal visible={modalCorteVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setModalCorteVisible(false)}>
          <View style={[styles.modalContenido, { paddingBottom: 0 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Día de corte</Text>
            <FlatList
              data={DIAS_CORTE}
              keyExtractor={(item) => String(item.dia)}
              style={{ maxHeight: 340 }}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.diaItem, item.dia === diaCorte && styles.diaItemActivo]}
                  onPress={() => handleGuardarDiaCorte(item.dia)}
                >
                  <Text style={[styles.diaEtiqueta, item.dia === diaCorte && { color: COLORS.primary, fontWeight: '600' }]}>
                    {item.etiqueta}
                  </Text>
                  {item.dia === diaCorte && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                </Pressable>
              )}
            />
            <Pressable
              style={[styles.botonCancelar, { margin: 16 }]}
              onPress={() => setModalCorteVisible(false)}
            >
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORS.background },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarTexto: { fontSize: 24, fontWeight: '600', color: COLORS.white },
  nombreTexto: { fontSize: 22, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 4 },
  emailTexto: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 },
  planBadge: {
    backgroundColor: 'rgba(108,99,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  planBadgeTexto: {
    fontSize: 11,
    color: COLORS.primaryLight,
    fontWeight: '600',
    letterSpacing: 1.2,
  },

  // Card ingreso
  cardIngreso: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ingresoLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  ingresoMonto: {
    fontSize: 28,
    fontWeight: '300',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  tasaLabel: { fontSize: 13, color: COLORS.success },
  btnEditar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Secciones de configuración
  seccionLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    fontWeight: '600',
  },
  grupoConfig: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 4,
  },
  separador: { height: 0.5, backgroundColor: COLORS.border, marginLeft: 52 },
  filaConfig: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
  },
  filaEmoji: { fontSize: 20, width: 24, textAlign: 'center' },
  filaLabel: { flex: 1, fontSize: 15, color: COLORS.textPrimary, fontWeight: '400' },
  filaValor: { fontSize: 14, color: COLORS.textSecondary, maxWidth: 120 },
  filaChevron: { fontSize: 20, color: COLORS.textMuted },

  // Botón cerrar sesión (ghost)
  btnCerrarSesion: {
    marginTop: 32,
    marginBottom: 8,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  btnCerrarSesionTexto: { fontSize: 16, color: COLORS.error, fontWeight: '500' },

  // Modales
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContenido: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalContenidoScroll: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12, textAlign: 'center' },
  tabFrecuencia: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabBtnActivo: { backgroundColor: COLORS.surface },
  tabBtnTexto: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  tabBtnTextoActivo: { color: COLORS.primary, fontWeight: '700' },
  labelInput: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginLeft: 4 },
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
  inputMontoContenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputPrefijo: { fontSize: 16, color: COLORS.textSecondary, marginRight: 4 },
  inputMonto: { flex: 1, fontSize: 18, fontWeight: '600', color: COLORS.textPrimary, paddingVertical: 10 },
  rowInputs: { flexDirection: 'row' },
  resumenNeto: {
    backgroundColor: COLORS.primary + '10',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  resumenNetoLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  resumenNetoValor: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  diaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  diaItemActivo: { backgroundColor: COLORS.primary + '12' },
  diaEtiqueta: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  modalBotones: { flexDirection: 'row', gap: 10 },
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
  botonCancelarTexto: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '500' },
  botonGuardar: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  botonGuardarTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
