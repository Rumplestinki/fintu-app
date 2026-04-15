// /app/(tabs)/gastos.jsx
import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { CATEGORIAS, getCategoriaByDbId } from '../../constants/categorias';
import { useAuth } from '../../hooks/useAuth';
import { obtenerTodosLosGastos, eliminarGasto, actualizarGasto } from '../../services/gastos';
import GastoCard from '../../components/GastoCard';

// ──────────────────────────────────────────
// Categorías para el filtro de chips
// ──────────────────────────────────────────
const CATEGORIAS_FILTER = [
  { id: 'todos', nombre: 'Todos', icono: '🗂️' },
  ...CATEGORIAS.map((c) => ({ id: c.id, nombre: c.nombre, icono: c.icono })),
];

// ──────────────────────────────────────────
// Opciones de filtro por fecha
// ──────────────────────────────────────────
const FILTROS_FECHA = [
  { id: 'mes', label: 'Este mes' },
  { id: 'anterior', label: 'Mes anterior' },
  { id: 'todo', label: 'Todo' },
];

// ──────────────────────────────────────────
// Helpers de fecha
// ──────────────────────────────────────────
function etiquetaDeFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const soloFecha = (d) => d.toDateString();
  if (soloFecha(fecha) === soloFecha(hoy)) return 'Hoy';
  if (soloFecha(fecha) === soloFecha(ayer)) return 'Ayer';
  return fecha.toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function agruparPorFecha(gastos) {
  const grupos = {};
  for (const gasto of gastos) {
    const clave = etiquetaDeFecha(gasto.fecha);
    if (!grupos[clave]) grupos[clave] = [];
    grupos[clave].push(gasto);
  }
  return Object.entries(grupos).map(([title, data]) => ({
    title,
    // dentro del mismo día, el más reciente registrado va primero
    data: [...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  }));
}

function filtrarPorFecha(gastos, filtro) {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  const finMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
  return gastos.filter((g) => {
    const fecha = new Date(g.fecha);
    if (filtro === 'mes') return fecha >= inicioMes;
    if (filtro === 'anterior') return fecha >= inicioMesAnterior && fecha <= finMesAnterior;
    return true;
  });
}

const formatearFechaISO = (date) => new Date(date).toISOString().split('T')[0];

const formatearFechaLegible = (fechaISO) => {
  const [año, mes, dia] = fechaISO.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${dia} ${meses[parseInt(mes) - 1]} ${año}`;
};

// ──────────────────────────────────────────
// Pantalla principal: Historial de gastos
// ──────────────────────────────────────────
export default function HistorialScreen() {
  const insets = useSafeAreaInsets();
  const { usuario } = useAuth();

  // Estado de datos
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Estado de filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('mes');
  const [categoriaActiva, setCategoriaActiva] = useState('todos');

  // Estado del modal de edición
  const [modalVisible, setModalVisible] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);
  const [montoInput, setMontoInput] = useState('');
  const [categoriaInput, setCategoriaInput] = useState(null);
  const [descripcionInput, setDescripcionInput] = useState('');
  const [fechaInput, setFechaInput] = useState('');
  const [guardando, setGuardando] = useState(false);

  // ──────────────────────────────────────────
  // Cargar gastos desde Supabase
  // ──────────────────────────────────────────
    async function cargarGastos() {
    try {
        setCargando(true);
        setError(null);
        const data = await obtenerTodosLosGastos(usuario.id);
        // Supabase ya los trae ordenados, pero re-ordenamos en cliente
        // por si hay gastos en caché o estado local desincronizado
        const ordenados = [...data].sort((a, b) => {
        if (b.fecha !== a.fecha) return b.fecha.localeCompare(a.fecha);
        return new Date(b.created_at) - new Date(a.created_at);
        });
        setGastos(ordenados);
    } catch (e) {
      setError('No se pudieron cargar los gastos.');
      console.error('Error cargando gastos:', e);
    } finally {
      setCargando(false);
    }
  }

  // Recargar cada vez que el usuario entra a esta pantalla
  useFocusEffect(
    useCallback(() => {
      if (usuario) cargarGastos();
    }, [usuario])
  );

  // ──────────────────────────────────────────
  // Abrir modal con los datos del gasto
  // ──────────────────────────────────────────
  function abrirEdicion(gasto) {
    const categoria = getCategoriaByDbId(gasto.categoria_id);
    setGastoEditando(gasto);
    setMontoInput(String(gasto.monto));
    setCategoriaInput(categoria);
    setDescripcionInput(gasto.descripcion || '');
    setFechaInput(gasto.fecha);
    setModalVisible(true);
  }

  // ──────────────────────────────────────────
  // Guardar cambios del gasto editado
  // ──────────────────────────────────────────
  async function handleGuardarEdicion() {
    const monto = parseFloat(montoInput);
    if (!montoInput || isNaN(monto) || monto <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a $0');
      return;
    }
    if (!categoriaInput) {
      Alert.alert('Categoría requerida', 'Selecciona una categoría');
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
      setGastos((prev) =>
        prev.map((g) =>
          g.id === gastoEditando.id ? { ...g, ...actualizado } : g
        )
      );
      setModalVisible(false);
    } catch (e) {
      console.error('Error actualizando gasto:', e);
      Alert.alert('Error', 'No se pudo actualizar el gasto.');
    } finally {
      setGuardando(false);
    }
  }

  // ──────────────────────────────────────────
  // Eliminar gasto con confirmación
  // ──────────────────────────────────────────
  function confirmarEliminacion(gastoId) {
    Alert.alert(
      'Eliminar gasto',
      '¿Estás seguro de que quieres eliminar este gasto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarGasto(gastoId);
              setGastos((prev) => prev.filter((g) => g.id !== gastoId));
              setModalVisible(false);
            } catch (e) {
              Alert.alert('Error', 'No se pudo eliminar el gasto.');
            }
          },
        },
      ]
    );
  }

  // ──────────────────────────────────────────
  // Filtrado en tiempo real
  // ──────────────────────────────────────────
  const gastosFiltrados = useMemo(() => {
    let resultado = filtrarPorFecha(gastos, filtroFecha);
    if (categoriaActiva !== 'todos') {
      resultado = resultado.filter(
        (g) => getCategoriaByDbId(g.categoria_id)?.id === categoriaActiva
      );
    }
    if (busqueda.trim()) {
      const termino = busqueda.toLowerCase();
      resultado = resultado.filter(
        (g) =>
          g.descripcion?.toLowerCase().includes(termino) ||
          getCategoriaByDbId(g.categoria_id)?.nombre?.toLowerCase().includes(termino)
      );
    }
    return resultado;
  }, [gastos, filtroFecha, categoriaActiva, busqueda]);

  const secciones = useMemo(() => agruparPorFecha(gastosFiltrados), [gastosFiltrados]);

  // ──────────────────────────────────────────
  // Renders — definidos como const ANTES del return
  // ──────────────────────────────────────────

  const renderEncabezado = ({ section }) => (
    <View style={styles.encabezadoSeccion}>
      <Text style={styles.textoEncabezado}>{section.title}</Text>
      <View style={styles.lineaDivisora} />
    </View>
  );

  const renderGasto = ({ item }) => (
    <GastoCard
      gasto={item}
      onPress={() => abrirEdicion(item)}
      onDelete={() => confirmarEliminacion(item.id)}
    />
  );

  const EstadoVacio = () => {
    const mensaje = busqueda.trim()
      ? `Sin resultados para "${busqueda}"`
      : filtroFecha === 'mes'
        ? 'Sin gastos este mes'
        : filtroFecha === 'anterior'
          ? 'Sin gastos el mes anterior'
          : 'Aún no tienes gastos registrados';
    return (
      <View style={styles.contenedorVacio}>
        <Text style={styles.iconoVacio}>🔍</Text>
        <Text style={styles.textoVacio}>{mensaje}</Text>
        <Text style={styles.subTextoVacio}>
          {busqueda ? 'Intenta con otra búsqueda' : 'Agrega tu primer gasto con el botón +'}
        </Text>
      </View>
    );
  };

  const Encabezado = () => (
    <View>
      {/* Filtros fecha */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.contenedorChips}
      >
        {FILTROS_FECHA.map((filtro) => (
          <Pressable
            key={filtro.id}
            onPress={() => setFiltroFecha(filtro.id)}
            style={[styles.chip, filtroFecha === filtro.id && styles.chipActivo]}
          >
            <Text style={[
              styles.textoChip,
              filtroFecha === filtro.id && styles.textoChipActivo,
            ]}>
              {filtro.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Filtros categoría */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.contenedorChips}
      >
        {CATEGORIAS_FILTER.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => setCategoriaActiva(cat.id)}
            style={[styles.chip, categoriaActiva === cat.id && styles.chipActivo]}
          >
            <Text style={styles.emojiChip}>{cat.icono}</Text>
            <Text style={[
              styles.textoChip,
              categoriaActiva === cat.id && styles.textoChipActivo,
            ]}>
              {cat.nombre}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Resumen del período */}
      {!cargando && gastosFiltrados.length > 0 && (
        <View style={styles.resumenPeriodo}>
          <Text style={styles.textoResumen}>
            {gastosFiltrados.length} gasto{gastosFiltrados.length !== 1 ? 's' : ''} · Total{' '}
            <Text style={styles.totalPeriodo}>
              ${gastosFiltrados
                .reduce((s, g) => s + Number(g.monto), 0)
                .toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Text>
          </Text>
        </View>
      )}
    </View>
  );

  // ──────────────────────────────────────────
  // Render principal
  // ──────────────────────────────────────────
  return (
    <View style={[styles.contenedor, { paddingTop: insets.top }]}>

      {/* Título */}
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>Historial</Text>
        <Pressable onPress={cargarGastos}>
          <Ionicons name="refresh-outline" size={22} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      {/* Buscador — fuera del SectionList para que el teclado no se cierre */}
      <View style={styles.contenedorBusqueda}>
        <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.inputBusqueda}
          placeholder="Buscar gasto..."
          placeholderTextColor={COLORS.textSecondary}
          value={busqueda}
          onChangeText={setBusqueda}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {busqueda.length > 0 && (
          <Pressable onPress={() => setBusqueda('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </Pressable>
        )}
      </View>

      {cargando ? (
        <View style={styles.contenedorCarga}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.contenedorVacio}>
          <Text style={styles.iconoVacio}>⚠️</Text>
          <Text style={styles.textoVacio}>{error}</Text>
          <Pressable style={styles.botonReintentar} onPress={cargarGastos}>
            <Text style={styles.textoBotonReintentar}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={secciones}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          renderItem={renderGasto}
          renderSectionHeader={renderEncabezado}
          ListHeaderComponent={<Encabezado />}
          ListEmptyComponent={<EstadoVacio />}
          contentContainerStyle={styles.contenidoLista}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── MODAL DE EDICIÓN ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={styles.modalContenido}>

              <View style={styles.modalHandle} />

              {/* Header del modal */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitulo}>Editar gasto</Text>
                <Pressable
                  style={styles.botonEliminarHeader}
                  onPress={() => confirmarEliminacion(gastoEditando?.id)}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                </Pressable>
              </View>

              {/* Monto */}
              <Text style={styles.modalLabel}>Monto</Text>
              <View style={styles.inputMontoContenedor}>
                <Text style={styles.inputPrefijo}>$</Text>
                <TextInput
                  style={styles.inputMonto}
                  value={montoInput}
                  onChangeText={setMontoInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              {/* Categorías */}
              <Text style={styles.modalLabel}>Categoría</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriasScroll}
              >
                {CATEGORIAS.map((cat) => {
                  const seleccionada = categoriaInput?.id === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoriaChip,
                        seleccionada && {
                          backgroundColor: cat.color + '30',
                          borderColor: cat.color,
                        },
                      ]}
                      onPress={() => setCategoriaInput(cat)}
                    >
                      <Text style={styles.categoriaChipIcono}>{cat.icono}</Text>
                      <Text style={[
                        styles.categoriaChipTexto,
                        seleccionada && { color: cat.color },
                      ]}>
                        {cat.nombre}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Descripción */}
              <Text style={styles.modalLabel}>Descripción</Text>
              <TextInput
                style={styles.inputDescripcion}
                value={descripcionInput}
                onChangeText={setDescripcionInput}
                placeholder="Opcional"
                placeholderTextColor={COLORS.textSecondary}
                maxLength={100}
              />

              {/* Fecha */}
              <Text style={styles.modalLabel}>Fecha</Text>
              <View style={styles.fechaRow}>
                <Pressable
                  style={[
                    styles.fechaBtn,
                    fechaInput === formatearFechaISO(new Date(Date.now() - 86400000)) && styles.fechaBtnActivo,
                  ]}
                  onPress={() => setFechaInput(formatearFechaISO(new Date(Date.now() - 86400000)))}
                >
                  <Text style={styles.fechaBtnTexto}>Ayer</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.fechaBtn,
                    fechaInput === formatearFechaISO(new Date()) && styles.fechaBtnActivo,
                  ]}
                  onPress={() => setFechaInput(formatearFechaISO(new Date()))}
                >
                  <Text style={styles.fechaBtnTexto}>Hoy</Text>
                </Pressable>
                <View style={styles.fechaDisplay}>
                  <Text style={styles.fechaDisplayTexto}>
                    📅 {fechaInput ? formatearFechaLegible(fechaInput) : ''}
                  </Text>
                </View>
              </View>

              {/* Botones */}
              <View style={styles.modalBotones}>
                <Pressable style={styles.botonCancelar} onPress={() => setModalVisible(false)}>
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
                    <Text style={styles.botonGuardarTexto}>Guardar cambios</Text>
                  )}
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
  cabecera: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
  },
  titulo: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '700' },
  contenedorCarga: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Buscador
  contenedorBusqueda: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 12, marginHorizontal: 20, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 10, gap: 8,
  },
  inputBusqueda: { flex: 1, color: COLORS.textPrimary, fontSize: 15 },

  // Chips
  contenedorChips: { paddingHorizontal: 20, paddingBottom: 10, gap: 8, flexDirection: 'row' },
  chip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 4,
  },
  chipActivo: { backgroundColor: COLORS.primary },
  emojiChip: { fontSize: 14 },
  textoChip: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  textoChipActivo: { color: '#fff' },

  // Resumen
  resumenPeriodo: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginHorizontal: 20, marginTop: 4, marginBottom: 12,
  },
  textoResumen: { color: COLORS.textSecondary, fontSize: 13 },
  totalPeriodo: { color: COLORS.primary, fontWeight: '700' },
  montoResumen: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },

  // Lista
  contenidoLista: { paddingHorizontal: 20, paddingBottom: 20 },
  encabezadoSeccion: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 16, marginBottom: 8, gap: 10,
  },
  textoEncabezado: {
    color: COLORS.textSecondary, fontSize: 13, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  lineaDivisora: { flex: 1, height: 1, backgroundColor: COLORS.border },

  // Estado vacío
  contenedorVacio: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 60, paddingHorizontal: 40,
  },
  iconoVacio: { fontSize: 48, marginBottom: 16 },
  textoVacio: {
    color: COLORS.textPrimary, fontSize: 17, fontWeight: '600',
    textAlign: 'center', marginBottom: 8,
  },
  subTextoVacio: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' },
  botonReintentar: {
    marginTop: 16, backgroundColor: COLORS.primary,
    borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10,
  },
  textoBotonReintentar: { color: '#fff', fontWeight: '600' },

  // Modal
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
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitulo: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '600' },
  botonEliminarHeader: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.error + '20',
    justifyContent: 'center', alignItems: 'center',
  },
  modalLabel: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 8 },

  // Input monto
  inputMontoContenedor: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 12,
    paddingHorizontal: 16, marginBottom: 20,
  },
  inputPrefijo: { color: COLORS.textSecondary, fontSize: 24, marginRight: 4 },
  inputMonto: {
    flex: 1, color: COLORS.textPrimary, fontSize: 32,
    fontWeight: '600', paddingVertical: 12,
  },

  // Categorías en modal
  categoriasScroll: { gap: 8, paddingBottom: 16 },
  categoriaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: COLORS.background, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  categoriaChipIcono: { fontSize: 18 },
  categoriaChipTexto: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },

  // Descripción
  inputDescripcion: {
    backgroundColor: COLORS.background, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    color: COLORS.textPrimary, fontSize: 15, marginBottom: 16,
  },

  // Fecha
  fechaRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  fechaBtn: {
    paddingVertical: 10, paddingHorizontal: 16, backgroundColor: COLORS.background,
    borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border,
  },
  fechaBtnActivo: { backgroundColor: COLORS.primary + '25', borderColor: COLORS.primary },
  fechaBtnTexto: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500' },
  fechaDisplay: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: COLORS.background, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center',
  },
  fechaDisplayTexto: { color: COLORS.textPrimary, fontSize: 13 },

  // Botones modal
  modalBotones: { flexDirection: 'row', gap: 10 },
  botonCancelar: {
    flex: 1, height: 48, borderRadius: 12, backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center',
  },
  botonCancelarTexto: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '500' },
  botonGuardar: {
    flex: 2, height: 48, borderRadius: 12,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  botonGuardarTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
