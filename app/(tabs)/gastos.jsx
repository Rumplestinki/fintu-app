// /app/(tabs)/gastos.jsx
// Pantalla de historial de gastos con filtros por periodo y categoría

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS } from '../../constants/colors';
import { CATEGORIAS, getCategoriaByDbId } from '../../constants/categorias';
import { NOMBRES_MESES } from '../../utils/fecha';
import { formatMXN } from '../../utils/formato';
import GastoCard from '../../components/GastoCard';
import Toast from '../../components/Toast';
import {
  obtenerGastosMes,
  obtenerTodosLosGastos,
  eliminarGasto,
  actualizarGasto,
  calcularPeriodo,
} from '../../services/gastos';
import { supabase } from '../../services/supabase';
import { hap } from '../../services/haptics';
import { toLocalISO } from '../../utils/fecha';

// ─── CONSTANTES ──────────────────────────────────────────

const CATEGORIAS_FILTER = [
  { id: 'todas', dbId: 'todas', nombre: 'Todo', icono: '📱' },
  ...CATEGORIAS,
];

const PERIODOS_RAPIDOS = [
  { id: 'actual', label: 'Este mes' },
  { id: 'anterior', label: 'Anterior' },
  { id: 'todo', label: 'Todo' },
];

// ─── COMPONENTES AUXILIARES ──────────────────────────────

function CategoriaChip({ cat, activa, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true, speed: 50, bounciness: 6 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 3 }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], paddingVertical: 8 }}>
      <Pressable
        onPress={handlePress}
        style={[styles.chip, activa && styles.chipActivo]}
      >
        <Text style={styles.emojiChip}>{cat.icono}</Text>
        <Text style={[styles.textoChip, activa && styles.textoChipActivo]}>
          {cat.nombre}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── PANTALLA PRINCIPAL ──────────────────────────────────

export default function HistorialScreen() {
  const insets = useSafeAreaInsets();

  // Estados de datos
  const [gastosRaw, setGastosRaw] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [diaCorte, setDiaCorte] = useState(1);

  // Estados de filtros
  const [periodoActivoId, setPeriodoActivoId] = useState('actual');
  const [categoriaActiva, setCategoriaActiva] = useState('todas');
  const [busqueda, setBusqueda] = useState('');

  // Estados de UI
  const [modalPeriodoVisible, setModalPeriodoVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);

  // Estados de inputs edición
  const [montoInput, setMontoInput] = useState('');
  const [categoriaInput, setCategoriaInput] = useState(null);
  const [descripcionInput, setDescripcionInput] = useState('');
  const [fechaInput, setFechaInput] = useState('');
  const [mostrarPickerFecha, setMostrarPickerFecha] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Estados de eliminación
  const [modalEliminarVisible, setModalEliminarVisible] = useState(false);
  const [gastoAEliminar, setGastoAEliminar] = useState(null);

  // Toast global
  const [toastMensaje, setToastMensaje] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTipo, setToastTipo] = useState('exito');

  // Toast dentro del modal de edición
  const [toastModalMensaje, setToastModalMensaje] = useState('');
  const [toastModalVisible, setToastModalVisible] = useState(false);
  const [toastModalTipo, setToastModalTipo] = useState('error');
  const toastModalOpacity = useRef(new Animated.Value(0)).current;

  // ── Cargar Gastos desde Supabase ──
  async function cargarGastos() {
    try {
      setCargando(true);
      const { data: { user } } = await supabase.auth.getUser();

      const { data: perfil } = await supabase
        .from('users')
        .select('dia_corte')
        .eq('id', user.id)
        .single();

      const corte = perfil?.dia_corte || 1;
      setDiaCorte(corte);

      let data = [];
      if (periodoActivoId === 'todo') {
        data = await obtenerTodosLosGastos(user.id);
      } else {
        // CRÍTICO CORREGIDO: offset = 1 para "anterior" (no -1)
        const offset = periodoActivoId === 'anterior' ? 1 : 0;
        const { inicio } = calcularPeriodo(corte, offset);
        const [año, mes] = inicio.split('-').map(Number);
        data = await obtenerGastosMes(mes, año, corte);
      }

      setGastosRaw(data || []);
    } catch (e) {
      console.error('Error cargando historial:', e);
    } finally {
      setCargando(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      cargarGastos();
    }, [periodoActivoId])
  );

  // ── Filtrado y Agrupación ──
  const secciones = useMemo(() => {
    let filtrados = gastosRaw.filter((g) => {
      const matchCat = categoriaActiva === 'todas' || Number(g.categoria_id) === Number(categoriaActiva);
      const matchBusqueda = !busqueda ||
        (g.descripcion || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        getCategoriaByDbId(g.categoria_id).nombre.toLowerCase().includes(busqueda.toLowerCase());
      return matchCat && matchBusqueda;
    });

    const grupos = filtrados.reduce((acc, g) => {
      const fecha = g.fecha;
      if (!acc[fecha]) acc[fecha] = [];
      acc[fecha].push(g);
      return acc;
    }, {});

    return Object.keys(grupos)
      .sort((a, b) => b.localeCompare(a))
      .map((fecha) => ({ title: fecha, data: grupos[fecha] }));
  }, [gastosRaw, categoriaActiva, busqueda]);

  // ── Acciones de Gasto ──
  function abrirEdicion(gasto) {
    hap.suave();
    setGastoEditando(gasto);
    setMontoInput(String(gasto.monto));
    setCategoriaInput(getCategoriaByDbId(gasto.categoria_id));
    setDescripcionInput(gasto.descripcion || '');
    setFechaInput(gasto.fecha);
    setModalVisible(true);
  }

  const mostrarToastModal = (mensaje, tipo = 'error') => {
    setToastModalMensaje(mensaje);
    setToastModalTipo(tipo);
    toastModalOpacity.setValue(0);
    setToastModalVisible(true);
    Animated.sequence([
      Animated.timing(toastModalOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastModalOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastModalVisible(false));
  };

  const mostrarToastGlobal = (mensaje, tipo = 'exito') => {
    setToastMensaje(mensaje);
    setToastTipo(tipo);
    setToastVisible(false);
    setTimeout(() => setToastVisible(true), 50);
  };

  async function handleGuardarEdicion() {
    const monto = parseFloat(montoInput);
    if (!montoInput || isNaN(monto) || monto <= 0) {
      hap.error();
      mostrarToastModal('El monto debe ser mayor a $0');
      return;
    }
    if (!categoriaInput) {
      hap.error();
      mostrarToastModal('Selecciona una categoría');
      return;
    }
    try {
      setGuardando(true);
      const actualizado = await actualizarGasto(gastoEditando.id, {
        monto,
        categoria_id: categoriaInput.dbId,
        descripcion: descripcionInput,
        fecha: fechaInput,
      });
      setGastosRaw((prev) =>
        prev.map((g) => g.id === gastoEditando.id ? { ...g, ...actualizado } : g)
      );
      hap.logro();
      setModalVisible(false);
      setTimeout(() => mostrarToastGlobal('Gasto actualizado correctamente', 'exito'), 300);
    } catch (e) {
      console.error('Error actualizando gasto:', e);
      hap.error();
      mostrarToastModal('No se pudo actualizar el gasto');
    } finally {
      setGuardando(false);
    }
  }

  function confirmarEliminacion(gastoId) {
    hap.advertencia();
    setGastoAEliminar(gastoId);
    setModalEliminarVisible(true);
  }

  async function ejecutarEliminacion() {
    if (!gastoAEliminar) return;
    try {
      hap.error();
      await eliminarGasto(gastoAEliminar);
      setGastosRaw((prev) => prev.filter((g) => g.id !== gastoAEliminar));
      setModalEliminarVisible(false);
      setModalVisible(false);
      setGastoAEliminar(null);
      setTimeout(() => mostrarToastGlobal('Gasto eliminado', 'exito'), 300);
    } catch (e) {
      // CORREGIDO: cerrar modal de confirmación aunque falle
      setModalEliminarVisible(false);
      setTimeout(() => mostrarToastGlobal('No se pudo eliminar el gasto', 'error'), 300);
    }
  }

  // ── Render Helpers ──
  const renderHeaderSeccion = ({ section: { title } }) => {
    const hoy = new Date().toISOString().split('T')[0];
    const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let label = title;
    if (title === hoy) label = 'Hoy';
    else if (title === ayer) label = 'Ayer';
    else {
      const [y, m, d] = title.split('-');
      label = `${d} ${NOMBRES_MESES[parseInt(m) - 1].substring(0, 3)}`;
    }

    return (
      <View style={styles.headerSeccion}>
        <Text style={styles.textoHeaderSeccion}>{label}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.contenedor, { paddingTop: insets.top }]}>

      {/* ── Toast Global ── */}
      <Toast visible={toastVisible} mensaje={toastMensaje} tipo={toastTipo} />

      {/* ── Cabecera ── */}
      <View style={styles.cabecera}>
        <View>
          <Text style={styles.titulo}>Gastos</Text>
          <Pressable
            style={styles.selectorPeriodo}
            onPress={() => { hap.suave(); setModalPeriodoVisible(true); }}
          >
            <Text style={styles.periodoActivo}>
              {periodoActivoId === 'actual' ? 'Este mes' :
               periodoActivoId === 'anterior' ? 'Mes anterior' : 'Todo el historial'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={COLORS.primary} />
          </Pressable>
        </View>
        <Pressable onPress={() => { hap.suave(); cargarGastos(); }}>
          <Ionicons name="refresh-outline" size={24} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      {/* ── Filtros ── */}
      <View style={styles.filtros}>
        <View style={styles.barraBusqueda}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.inputBusqueda}
            placeholder="Buscar por descripción..."
            placeholderTextColor={COLORS.textMuted}
            value={busqueda}
            onChangeText={setBusqueda}
          />
          {busqueda !== '' && (
            <Pressable onPress={() => setBusqueda('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollCategorias}
        >
          {CATEGORIAS_FILTER.map((cat) => (
            <CategoriaChip
              key={cat.id}
              cat={cat}
              activa={String(categoriaActiva) === String(cat.dbId || cat.id)}
              onPress={() => { hap.suave(); setCategoriaActiva(cat.dbId || cat.id); }}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Lista de Gastos ── */}
      {cargando && gastosRaw.length === 0 ? (
        <View style={styles.contenedorCarga}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <SectionList
          sections={secciones}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GastoCard
              gasto={item}
              onPress={() => abrirEdicion(item)}
              onDelete={() => confirmarEliminacion(item.id)}
            />
          )}
          renderSectionHeader={renderHeaderSeccion}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={
            <View style={styles.estadoVacio}>
              <Text style={styles.emojiVacio}>🤷‍♂️</Text>
              <Text style={styles.tituloVacio}>No hay gastos</Text>
              <Text style={styles.subVacio}>Intenta con otros filtros o registra uno nuevo.</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}

      {/* ── Modal Selector de Periodo ── */}
      <Modal visible={modalPeriodoVisible} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setModalPeriodoVisible(false)}>
          <View style={styles.modalPeriodo}>
            <Text style={styles.modalTitulo}>Ver periodo</Text>
            <View style={styles.accesoRapidoFila}>
              {PERIODOS_RAPIDOS.map(p => (
                <Pressable
                  key={p.id}
                  style={[styles.btnRapido, periodoActivoId === p.id && styles.btnRapidoActivo]}
                  onPress={() => { hap.suave(); setPeriodoActivoId(p.id); setModalPeriodoVisible(false); }}
                >
                  <Text style={[styles.btnRapidoTxt, periodoActivoId === p.id && styles.btnRapidoTxtActivo]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Modal de Edición ── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlayEdicion}
        >
          <View style={styles.modalEdicion}>
            <View style={styles.modalManija} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTituloEdicion}>Editar gasto</Text>
              <Pressable
                onPress={() => confirmarEliminacion(gastoEditando?.id)}
                style={styles.modalBtnEliminarHeader}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={22} color={COLORS.error} />
              </Pressable>
            </View>

            {categoriaInput && (
              <View style={styles.categoriaActivaFila}>
                <Text style={styles.categoriaActivaEmoji}>{categoriaInput.icono}</Text>
                <Text style={[styles.categoriaActivaNombre, { color: categoriaInput.color }]}>
                  {categoriaInput.nombre}
                </Text>
              </View>
            )}

            {gastoEditando && (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Monto</Text>
                <View style={styles.inputMontoRow}>
                  <Text style={styles.prefijoMonto}>$</Text>
                  <TextInput
                    style={styles.inputMonto}
                    keyboardType="numeric"
                    value={montoInput}
                    onChangeText={setMontoInput}
                  />
                </View>

                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={styles.inputDesc}
                  value={descripcionInput}
                  onChangeText={setDescripcionInput}
                  placeholder="Sin descripción"
                  placeholderTextColor={COLORS.textMuted}
                />

                {/* NUEVO: Selector de fecha en edición */}
                <Text style={styles.label}>Fecha</Text>
                <Pressable
                  style={styles.fechaSelector}
                  onPress={() => { hap.suave(); setMostrarPickerFecha(true); }}
                >
                  <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={styles.fechaSelectorTexto}>
                    {fechaInput ? fechaInput : 'Seleccionar fecha'}
                  </Text>
                </Pressable>

                {mostrarPickerFecha && (
                  <DateTimePicker
                    value={new Date(fechaInput + 'T12:00:00')}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(evento, fechaSeleccionada) => {
                      setMostrarPickerFecha(false);
                      if (evento.type === 'dismissed') return;
                      if (fechaSeleccionada) {
                        setFechaInput(toLocalISO(fechaSeleccionada));
                        hap.suave();
                      }
                    }}
                  />
                )}

                <Text style={styles.label}>Seleccionar categoría</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoriasModalScroll}
                  keyboardShouldPersistTaps="handled"
                >
                  {CATEGORIAS.map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => { hap.suave(); setCategoriaInput(cat); }}
                      style={[
                        styles.categoriaChipModal,
                        categoriaInput?.id === cat.id && {
                          backgroundColor: cat.color + '25',
                          borderColor: cat.color,
                        },
                      ]}
                    >
                      <Text style={styles.categoriaChipModalEmoji}>{cat.icono}</Text>
                      <Text style={[
                        styles.categoriaChipModalTexto,
                        categoriaInput?.id === cat.id && { color: cat.color, fontWeight: '600' },
                      ]}>
                        {cat.nombre}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <View style={styles.modalBotones}>
                  <Pressable
                    style={styles.botonCancelar}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.botonCancelarTexto}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={styles.botonGuardar}
                    onPress={handleGuardarEdicion}
                    disabled={guardando}
                  >
                    {guardando ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.botonGuardarTexto}>Guardar</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </View>

          {/* Toast dentro del modal — CORREGIDO: usa top relativo al contenedor */}
          {toastModalVisible && (
            <Animated.View style={[
              styles.toastModal,
              toastModalTipo === 'error'
                ? { borderColor: COLORS.error, backgroundColor: '#2A1515' }
                : { borderColor: COLORS.success, backgroundColor: '#1A2A1A' },
              { opacity: toastModalOpacity },
            ]}>
              <Text style={{ fontSize: 16 }}>
                {toastModalTipo === 'error' ? '❌' : '✅'}
              </Text>
              <Text style={styles.toastModalTexto}>{toastModalMensaje}</Text>
            </Animated.View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal Confirmación Eliminación ── */}
      <Modal
        visible={modalEliminarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalEliminarVisible(false)}
      >
        <Pressable
          style={styles.modalEliminarOverlay}
          onPress={() => setModalEliminarVisible(false)}
        >
          <Pressable style={styles.modalEliminarContenedor} onPress={() => {}}>
            <View style={styles.modalEliminarIcono}>
              <Text style={{ fontSize: 32 }}>🗑️</Text>
            </View>
            <Text style={styles.modalEliminarTitulo}>Eliminar gasto</Text>
            <Text style={styles.modalEliminarMensaje}>
              Esta acción no se puede deshacer.{'\n'}¿Confirmas que quieres eliminarlo?
            </Text>
            <View style={styles.modalEliminarBotones}>
              <Pressable
                style={styles.modalEliminarBtnCancelar}
                onPress={() => { hap.suave(); setModalEliminarVisible(false); }}
              >
                <Text style={styles.modalEliminarBtnCancelarTxt}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.modalEliminarBtnConfirmar}
                onPress={ejecutarEliminacion}
              >
                <Text style={styles.modalEliminarBtnConfirmarTxt}>Eliminar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORS.background },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  titulo: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary },
  selectorPeriodo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  periodoActivo: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  filtros: { borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 5 },
  barraBusqueda: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputBusqueda: { flex: 1, marginLeft: 8, color: COLORS.textPrimary, fontSize: 15 },

  scrollCategorias: { paddingLeft: 20, paddingRight: 10, paddingVertical: 5 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActivo: { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary },
  emojiChip: { fontSize: 16, marginRight: 6 },
  textoChip: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  textoChipActivo: { color: COLORS.primary, fontWeight: '600' },

  headerSeccion: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 10,
  },
  textoHeaderSeccion: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase' },
  lista: { paddingHorizontal: 16, paddingBottom: 20 },

  contenedorCarga: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  estadoVacio: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emojiVacio: { fontSize: 50, marginBottom: 20 },
  tituloVacio: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  subVacio: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalPeriodo: { backgroundColor: COLORS.surface, width: '85%', borderRadius: 20, padding: 25 },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 20, textAlign: 'center' },
  accesoRapidoFila: { gap: 10 },
  btnRapido: { paddingVertical: 15, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  btnRapidoActivo: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  btnRapidoTxt: { color: COLORS.textSecondary, fontWeight: '500' },
  btnRapidoTxtActivo: { color: COLORS.primary, fontWeight: '700' },

  overlayEdicion: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalEdicion: { backgroundColor: COLORS.surface, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, paddingBottom: 40, maxHeight: '95%' },
  modalManija: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTituloEdicion: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  modalBtnEliminarHeader: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },

  categoriaActivaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  categoriaActivaEmoji: { fontSize: 14 },
  categoriaActivaNombre: { fontSize: 13, fontWeight: '600' },

  label: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 10, textTransform: 'uppercase', marginTop: 10 },
  inputMontoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  prefijoMonto: { fontSize: 30, fontWeight: '700', color: COLORS.textPrimary, marginRight: 5 },
  inputMonto: { fontSize: 40, fontWeight: '700', color: COLORS.primary, flex: 1 },
  inputDesc: { backgroundColor: COLORS.background, borderRadius: 12, padding: 15, color: COLORS.textPrimary, fontSize: 16, marginBottom: 20, borderWidth: 1.5, borderColor: COLORS.border },

  // Selector de fecha en edición
  fechaSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  fechaSelectorTexto: {
    color: COLORS.textPrimary,
    fontSize: 15,
  },

  categoriasModalScroll: { paddingBottom: 12, paddingRight: 8, gap: 8 },
  categoriaChipModal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  categoriaChipModalEmoji: { fontSize: 16 },
  categoriaChipModalTexto: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },

  modalBotones: { flexDirection: 'row', gap: 12, marginTop: 30 },
  botonCancelar: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  botonCancelarTexto: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600' },
  botonGuardar: { flex: 2, height: 48, borderRadius: 12, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  botonGuardarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Toast modal — CORREGIDO: posición relativa al contenedor, no hardcoded
  toastModal: {
    position: 'absolute',
    top: 24,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    zIndex: 999,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  toastModalTexto: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '500', flex: 1 },

  // Eliminación
  modalEliminarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalEliminarContenedor: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  modalEliminarIcono: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalEliminarTitulo: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  modalEliminarMensaje: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalEliminarBotones: { flexDirection: 'row', gap: 12, width: '100%' },
  modalEliminarBtnCancelar: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEliminarBtnCancelarTxt: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  modalEliminarBtnConfirmar: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEliminarBtnConfirmarTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
