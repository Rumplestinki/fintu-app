// app/(tabs)/gastos.jsx
// Historial de gastos con filtros y búsqueda — diseño Soft Dark Luxury

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
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS } from '../../constants/colors';
import { CATEGORIAS, getCategoriaByDbId } from '../../constants/categorias';
import { NOMBRES_MESES } from '../../utils/fecha';
import { formatMXN, hexToRgba } from '../../utils/formato';
import Toast from '../../components/Toast';
import GastoCard from '../../components/GastoCard';
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
  { id: 'todas', dbId: 'todas', nombre: 'Todos', icono: '📋' },
  ...CATEGORIAS,
];

const PERIODOS_RAPIDOS = [
  { id: 'actual',   label: 'Este mes' },
  { id: 'anterior', label: 'Anterior' },
  { id: 'todo',     label: 'Todo' },
];

// ─── CHIP DE FILTRO ──────────────────────────────────────
function FilterChip({ cat, activa, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[estilos.chip, activa && estilos.chipActivo]}
    >
      <Text style={estilos.chipEmoji}>{cat.icono}</Text>
      <Text style={[estilos.chipTexto, activa && estilos.chipTextoActivo]}>
        {cat.nombre}
      </Text>
    </Pressable>
  );
}

// ─── PANTALLA PRINCIPAL ──────────────────────────────────
export default function HistorialScreen() {
  const insets = useSafeAreaInsets();

  // Datos
  const [gastosRaw, setGastosRaw] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [diaCorte, setDiaCorte] = useState(1);

  // Filtros
  const [periodoActivoId, setPeriodoActivoId] = useState('actual');
  const [categoriaActiva, setCategoriaActiva] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaVisible, setBusquedaVisible] = useState(false);
  const busquedaRef = useRef(null);

  // Animación de la barra de búsqueda (height 0→56)
  const busquedaAltura = useRef(new Animated.Value(0)).current;

  // UI edición
  const [modalPeriodoVisible, setModalPeriodoVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);
  const [montoInput, setMontoInput] = useState('');
  const [categoriaInput, setCategoriaInput] = useState(null);
  const [descripcionInput, setDescripcionInput] = useState('');
  const [fechaInput, setFechaInput] = useState('');
  const [mostrarPickerFecha, setMostrarPickerFecha] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Eliminación
  const [modalEliminarVisible, setModalEliminarVisible] = useState(false);
  const [gastoAEliminar, setGastoAEliminar] = useState(null);

  // Toast
  const [toastMensaje, setToastMensaje] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTipo, setToastTipo] = useState('exito');

  // Toast dentro del modal
  const [toastModalMensaje, setToastModalMensaje] = useState('');
  const [toastModalVisible, setToastModalVisible] = useState(false);
  const [toastModalTipo, setToastModalTipo] = useState('error');
  const toastModalOpacity = useRef(new Animated.Value(0)).current;

  // ── Toggle de barra de búsqueda ──
  const toggleBusqueda = () => {
    const mostrar = !busquedaVisible;
    setBusquedaVisible(mostrar);
    Animated.timing(busquedaAltura, {
      toValue: mostrar ? 56 : 0,
      duration: 280,
      useNativeDriver: false,
    }).start(() => {
      if (mostrar) busquedaRef.current?.focus();
    });
    if (!mostrar) {
      setBusqueda('');
    }
  };

  // ── Cargar gastos ──
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

  // ── Filtrado y agrupación ──
  const secciones = useMemo(() => {
    const filtrados = gastosRaw.filter((g) => {
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

  const totalFiltrado = useMemo(
    () => secciones.reduce((sum, s) => sum + s.data.reduce((a, g) => a + parseFloat(g.monto), 0), 0),
    [secciones]
  );
  const cantidadFiltrada = useMemo(
    () => secciones.reduce((sum, s) => sum + s.data.length, 0),
    [secciones]
  );

  // ── Acciones de gasto ──
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
      setTimeout(() => mostrarToastGlobal('Gasto actualizado correctamente'), 300);
    } catch (e) {
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
      setTimeout(() => mostrarToastGlobal('Gasto eliminado'), 300);
    } catch (e) {
      setModalEliminarVisible(false);
      setTimeout(() => mostrarToastGlobal('No se pudo eliminar', 'error'), 300);
    }
  }

  // ── Header de sección (grupo por fecha) ──
  const renderHeaderSeccion = ({ section: { title } }) => {
    const hoy  = new Date().toISOString().split('T')[0];
    const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let label = title;
    if (title === hoy) label = 'HOY';
    else if (title === ayer) label = 'AYER';
    else {
      const [y, m, d] = title.split('-');
      const nombreDia = new Date(title + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long' });
      label = `${nombreDia.toUpperCase()} ${parseInt(d)} ${NOMBRES_MESES[parseInt(m) - 1].substring(0, 3).toUpperCase()}`;
    }
    return (
      <View style={estilos.headerSeccion}>
        <Text style={estilos.textoHeaderSeccion}>{label}</Text>
      </View>
    );
  };

  return (
    <View style={[estilos.contenedor, { paddingTop: insets.top }]}>
      <Toast visible={toastVisible} mensaje={toastMensaje} tipo={toastTipo} />

      {/* ── Cabecera ── */}
      <View style={estilos.cabecera}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.titulo}>Historial</Text>
          <Pressable
            style={estilos.selectorPeriodo}
            onPress={() => { hap.suave(); setModalPeriodoVisible(true); }}
          >
            <Text style={estilos.periodoActivo}>
              {periodoActivoId === 'actual' ? 'Este mes' :
               periodoActivoId === 'anterior' ? 'Mes anterior' : 'Todo el historial'}
            </Text>
            <Ionicons name="chevron-down" size={13} color={COLORS.primary} />
          </Pressable>
        </View>
        {/* Botones: búsqueda + refresh */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={[estilos.iconBtn, busquedaVisible && { backgroundColor: COLORS.primary + '20' }]}
            onPress={toggleBusqueda}
          >
            <Ionicons name="search-outline" size={22} color={busquedaVisible ? COLORS.primary : COLORS.textSecondary} />
          </Pressable>
          <Pressable
            style={estilos.iconBtn}
            onPress={() => { hap.suave(); cargarGastos(); }}
          >
            <Ionicons name="refresh-outline" size={22} color={COLORS.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* ── Barra de búsqueda colapsable ── */}
      <Animated.View style={[estilos.busquedaWrap, { height: busquedaAltura, overflow: 'hidden' }]}>
        <View style={estilos.barraBusqueda}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            ref={busquedaRef}
            style={estilos.inputBusqueda}
            placeholder="Buscar gasto..."
            placeholderTextColor={COLORS.textMuted}
            value={busqueda}
            onChangeText={setBusqueda}
          />
          {busqueda !== '' && (
            <Pressable onPress={() => setBusqueda('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* ── Chips de filtro por categoría ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={estilos.chipsContainer}
      >
        {CATEGORIAS_FILTER.map((cat) => (
          <FilterChip
            key={cat.id}
            cat={cat}
            activa={String(categoriaActiva) === String(cat.dbId || cat.id)}
            onPress={() => { hap.suave(); setCategoriaActiva(cat.dbId || cat.id); }}
          />
        ))}
      </ScrollView>

      {/* ── Resumen del período ── */}
      {!cargando && (
        <View style={estilos.resumenRow}>
          <Text style={estilos.resumenCantidad}>{cantidadFiltrada} gastos</Text>
          <Text style={estilos.resumenTotal}>−{formatMXN(totalFiltrado)}</Text>
        </View>
      )}

      {/* ── Lista agrupada ── */}
      {cargando && gastosRaw.length === 0 ? (
        <View style={estilos.contenedorCarga}>
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
          contentContainerStyle={estilos.lista}
          ListEmptyComponent={
            <View style={estilos.estadoVacio}>
              <Text style={estilos.emojiVacio}>🤷‍♂️</Text>
              <Text style={estilos.tituloVacio}>No hay gastos</Text>
              <Text style={estilos.subVacio}>Intenta con otros filtros o registra uno nuevo.</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}

      {/* ── Modal selector de periodo ── */}
      <Modal visible={modalPeriodoVisible} transparent animationType="fade">
        <Pressable style={estilos.overlay} onPress={() => setModalPeriodoVisible(false)}>
          <View style={estilos.modalPeriodo}>
            <Text style={estilos.modalTitulo}>Ver periodo</Text>
            <View style={{ gap: 10 }}>
              {PERIODOS_RAPIDOS.map(p => (
                <Pressable
                  key={p.id}
                  style={[estilos.btnRapido, periodoActivoId === p.id && estilos.btnRapidoActivo]}
                  onPress={() => { hap.suave(); setPeriodoActivoId(p.id); setModalPeriodoVisible(false); }}
                >
                  <Text style={[estilos.btnRapidoTxt, periodoActivoId === p.id && estilos.btnRapidoTxtActivo]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Modal de edición ── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={estilos.overlayEdicion}
        >
          <View style={estilos.modalEdicion}>
            <View style={estilos.modalManija} />

            <View style={estilos.modalHeader}>
              <Text style={estilos.modalTituloEdicion}>Editar gasto</Text>
              <Pressable
                onPress={() => confirmarEliminacion(gastoEditando?.id)}
                style={estilos.modalBtnEliminar}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={22} color={COLORS.error} />
              </Pressable>
            </View>

            {categoriaInput && (
              <View style={estilos.categoriaActivaFila}>
                <Text>{categoriaInput.icono}</Text>
                <Text style={[estilos.categoriaActivaNombre, { color: categoriaInput.color }]}>
                  {categoriaInput.nombre}
                </Text>
              </View>
            )}

            {gastoEditando && (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={estilos.label}>Monto</Text>
                <View style={estilos.inputMontoRow}>
                  <Text style={estilos.prefijoMonto}>$</Text>
                  <TextInput
                    style={estilos.inputMonto}
                    keyboardType="numeric"
                    value={montoInput}
                    onChangeText={setMontoInput}
                  />
                </View>

                <Text style={estilos.label}>Descripción</Text>
                <TextInput
                  style={estilos.inputDesc}
                  value={descripcionInput}
                  onChangeText={setDescripcionInput}
                  placeholder="Sin descripción"
                  placeholderTextColor={COLORS.textMuted}
                />

                <Text style={estilos.label}>Fecha</Text>
                <Pressable
                  style={estilos.fechaSelector}
                  onPress={() => { hap.suave(); setMostrarPickerFecha(true); }}
                >
                  <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={estilos.fechaSelectorTexto}>{fechaInput || 'Seleccionar fecha'}</Text>
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
                      if (fechaSeleccionada) { setFechaInput(toLocalISO(fechaSeleccionada)); hap.suave(); }
                    }}
                  />
                )}

                <Text style={estilos.label}>Categoría</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={estilos.categoriasModalScroll}
                  keyboardShouldPersistTaps="handled"
                >
                  {CATEGORIAS.map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => { hap.suave(); setCategoriaInput(cat); }}
                      style={[
                        estilos.categoriaChipModal,
                        categoriaInput?.id === cat.id && {
                          backgroundColor: cat.color + '25',
                          borderColor: cat.color,
                        },
                      ]}
                    >
                      <Text>{cat.icono}</Text>
                      <Text style={[
                        estilos.categoriaChipModalTexto,
                        categoriaInput?.id === cat.id && { color: cat.color, fontWeight: '600' },
                      ]}>
                        {cat.nombre}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <View style={estilos.modalBotones}>
                  <Pressable style={estilos.botonCancelar} onPress={() => setModalVisible(false)}>
                    <Text style={estilos.botonCancelarTexto}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={estilos.botonGuardar} onPress={handleGuardarEdicion} disabled={guardando}>
                    {guardando ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={estilos.botonGuardarTexto}>Guardar</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </View>

          {toastModalVisible && (
            <Animated.View style={[
              estilos.toastModal,
              toastModalTipo === 'error'
                ? { borderColor: COLORS.error, backgroundColor: '#2A1515' }
                : { borderColor: COLORS.success, backgroundColor: '#1A2A1A' },
              { opacity: toastModalOpacity },
            ]}>
              <Text style={{ fontSize: 16 }}>{toastModalTipo === 'error' ? '❌' : '✅'}</Text>
              <Text style={estilos.toastModalTexto}>{toastModalMensaje}</Text>
            </Animated.View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal confirmación eliminación ── */}
      <Modal
        visible={modalEliminarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalEliminarVisible(false)}
      >
        <Pressable style={estilos.modalEliminarOverlay} onPress={() => setModalEliminarVisible(false)}>
          <Pressable style={estilos.modalEliminarContenedor} onPress={() => {}}>
            <View style={estilos.modalEliminarIcono}>
              <Text style={{ fontSize: 32 }}>🗑️</Text>
            </View>
            <Text style={estilos.modalEliminarTitulo}>Eliminar gasto</Text>
            <Text style={estilos.modalEliminarMensaje}>
              Esta acción no se puede deshacer.{'\n'}¿Confirmas que quieres eliminarlo?
            </Text>
            <View style={estilos.modalEliminarBotones}>
              <Pressable
                style={estilos.modalEliminarBtnCancelar}
                onPress={() => { hap.suave(); setModalEliminarVisible(false); }}
              >
                <Text style={estilos.modalEliminarBtnCancelarTxt}>Cancelar</Text>
              </Pressable>
              <Pressable style={estilos.modalEliminarBtnConfirmar} onPress={ejecutarEliminacion}>
                <Text style={estilos.modalEliminarBtnConfirmarTxt}>Eliminar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORS.background },

  // Cabecera
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  titulo: { fontSize: 22, fontWeight: '600', color: COLORS.textPrimary },
  selectorPeriodo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  periodoActivo: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Búsqueda colapsable
  busquedaWrap: { paddingHorizontal: 20, marginBottom: 4 },
  barraBusqueda: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputBusqueda: { flex: 1, color: COLORS.textPrimary, fontSize: 15 },

  // Chips de filtro
  chipsContainer: { paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  chipActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipEmoji: { fontSize: 14 },
  chipTexto: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  chipTextoActivo: { color: COLORS.white, fontWeight: '600' },

  // Resumen del período
  resumenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  resumenCantidad: { fontSize: 13, color: COLORS.textSecondary },
  resumenTotal: { fontSize: 13, color: COLORS.coral, fontVariant: ['tabular-nums'] },

  // Lista agrupada
  headerSeccion: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.background,
  },
  textoHeaderSeccion: {
    fontSize: 11,
    letterSpacing: 1.4,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  lista: { paddingHorizontal: 16, paddingBottom: 20 },

  contenedorCarga: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  estadoVacio: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emojiVacio: { fontSize: 50, marginBottom: 20 },
  tituloVacio: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  subVacio: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Modal periodo
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalPeriodo: { backgroundColor: COLORS.surface, width: '85%', borderRadius: 20, padding: 25 },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 20, textAlign: 'center' },
  btnRapido: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnRapidoActivo: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  btnRapidoTxt: { color: COLORS.textSecondary, fontWeight: '500' },
  btnRapidoTxtActivo: { color: COLORS.primary, fontWeight: '700' },

  // Modal edición
  overlayEdicion: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalEdicion: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '95%',
  },
  modalManija: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTituloEdicion: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  modalBtnEliminar: {
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
  categoriaActivaNombre: { fontSize: 13, fontWeight: '600' },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  inputMontoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  prefijoMonto: { fontSize: 30, fontWeight: '700', color: COLORS.textPrimary, marginRight: 5 },
  inputMonto: { fontSize: 40, fontWeight: '700', color: COLORS.primary, flex: 1 },
  inputDesc: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 15,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
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
  fechaSelectorTexto: { color: COLORS.textPrimary, fontSize: 15 },
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
  categoriaChipModalTexto: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  modalBotones: { flexDirection: 'row', gap: 12, marginTop: 30 },
  botonCancelar: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.transparent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  botonCancelarTexto: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600' },
  botonGuardar: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  botonGuardarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },

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
  },
  toastModalTexto: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '500', flex: 1 },

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
  modalEliminarMensaje: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
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
