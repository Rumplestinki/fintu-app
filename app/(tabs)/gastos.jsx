// /app/(tabs)/gastos.jsx
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
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/colors';
import { CATEGORIAS, getCategoriaByDbId } from '../../constants/categorias';
import { useAuth } from '../../hooks/useAuth';
import { obtenerTodosLosGastos, eliminarGasto, actualizarGasto } from '../../services/gastos';
import GastoCard from '../../components/GastoCard';

// ──────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────
const CATEGORIAS_FILTER = [
  { id: 'todos', nombre: 'Todos', icono: '🗂️' },
  ...CATEGORIAS.map((c) => ({ id: c.id, nombre: c.nombre, icono: c.icono })),
];

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ──────────────────────────────────────────
// Helper: calcular inicio y fin de un periodo
// dado el dia_corte del usuario y un offset
// offset 0 = periodo actual, offset 1 = anterior, etc.
//
// Ejemplo dia_corte=15, hoy=20 abr:
//   offset 0 → inicio: 15 abr | fin: 14 may
//   offset 1 → inicio: 15 mar | fin: 14 abr
//
// Ejemplo dia_corte=1 (comportamiento clásico):
//   offset 0 → inicio: 1 abr  | fin: 30 abr
//   offset 1 → inicio: 1 mar  | fin: 31 mar
// ──────────────────────────────────────────
function calcularRangoPeriodo(diaCorte, offset = 0) {
  const hoy = new Date();
  const diaActual = hoy.getDate();

  // ¿En qué mes empezó el periodo actual?
  let mesBase, anioBase;
  if (diaActual >= diaCorte) {
    mesBase = hoy.getMonth();      // 0-indexed
    anioBase = hoy.getFullYear();
  } else {
    const pasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    mesBase = pasado.getMonth();
    anioBase = pasado.getFullYear();
  }

  // Aplicar offset hacia atrás en el tiempo
  const inicioDate = new Date(anioBase, mesBase - offset, diaCorte);
  // El fin es el día anterior al próximo corte
  const finDate = new Date(anioBase, mesBase - offset + 1, diaCorte - 1);

  const toISO = (d) => d.toISOString().split('T')[0];
  return { inicio: toISO(inicioDate), fin: toISO(finDate) };
}

// ──────────────────────────────────────────
// Genera la lista de periodos disponibles (24 periodos)
// Recibe diaCorte para calcular rangos correctos
// ──────────────────────────────────────────
function generarPeriodos(diaCorte = 1) {
  const periodos = [
    { id: 'todo', label: 'Todo el historial', inicio: null, fin: null },
  ];

  for (let offset = 0; offset < 24; offset++) {
    const { inicio, fin } = calcularRangoPeriodo(diaCorte, offset);

    const [anioStr, mesStr] = inicio.split('-');
    const anio = parseInt(anioStr);
    const mes = parseInt(mesStr); // 1-indexed
    const nombreMes = NOMBRES_MESES[mes - 1];

    let label;
    if (offset === 0) label = `Este mes · ${nombreMes}`;
    else if (offset === 1) label = `Mes anterior · ${nombreMes}`;
    else label = `${nombreMes} ${anio}`;

    // Si hay corte distinto de 1, mostrar el rango exacto en los primeros periodos
    if (diaCorte > 1 && offset <= 1) {
      const diaFin = fin.split('-')[2];
      const mesFin = NOMBRES_MESES[parseInt(fin.split('-')[1]) - 1].substring(0, 3);
      const diaIni = String(diaCorte).padStart(2, '0');
      const mesIni = nombreMes.substring(0, 3);
      label += `  (${diaIni} ${mesIni} – ${diaFin} ${mesFin})`;
    }

    periodos.push({
      id: `${anio}-${mes}-${offset}`,
      label,
      inicio,
      fin,
      mes,
      anio,
    });
  }

  return periodos;
}

// ──────────────────────────────────────────
// Filtra gastos por rango de fechas del periodo
// Usa comparación de strings ISO (más rápido que Date)
// ──────────────────────────────────────────
function filtrarPorPeriodo(gastos, periodo) {
  if (!periodo || periodo.id === 'todo' || !periodo.inicio) return gastos;
  return gastos.filter((g) => g.fecha >= periodo.inicio && g.fecha <= periodo.fin);
}

// ──────────────────────────────────────────
// Helpers de fecha para etiquetas en la lista
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
    data: [...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  }));
}

const formatearFechaISO = (date) => new Date(date).toISOString().split('T')[0];

const formatearFechaLegible = (fechaISO) => {
  const [año, mes, dia] = fechaISO.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${dia} ${meses[parseInt(mes) - 1]} ${año}`;
};

// ──────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────
export default function HistorialScreen() {
  const insets = useSafeAreaInsets();
  const { usuario } = useAuth();

  // Datos
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Día de corte del usuario (se carga junto con los gastos)
  const [diaCorte, setDiaCorte] = useState(1);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [periodoActivoId, setPeriodoActivoId] = useState(null); // null = pendiente de init
  const [categoriaActiva, setCategoriaActiva] = useState('todos');

  // Modal selector de periodo
  const [modalPeriodoVisible, setModalPeriodoVisible] = useState(false);
  const [anioSelector, setAnioSelector] = useState(new Date().getFullYear());

  // Modal edición de gasto
  const [modalVisible, setModalVisible] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);
  const [montoInput, setMontoInput] = useState('');
  const [categoriaInput, setCategoriaInput] = useState(null);
  const [descripcionInput, setDescripcionInput] = useState('');
  const [fechaInput, setFechaInput] = useState('');
  const [guardando, setGuardando] = useState(false);

  const scrollCategoriasRef = useRef(null);

  // ──────────────────────────────────────────
  // Años disponibles basados en los gastos
  // ──────────────────────────────────────────
  const aniosDisponibles = useMemo(() => {
    const años = new Set([new Date().getFullYear()]);
    gastos.forEach((g) => {
      if (g.fecha) años.add(new Date(g.fecha).getFullYear());
    });
    return Array.from(años).sort((a, b) => b - a);
  }, [gastos]);

  // ──────────────────────────────────────────
  // Periodos calculados con el dia_corte actual
  // ──────────────────────────────────────────
  const periodos = useMemo(() => generarPeriodos(diaCorte), [diaCorte]);

  // Objeto completo del periodo activo (soporta predefinidos y personalizados)
  const periodoActivo = useMemo(() => {
    // 1. Buscar en predefinidos (Todo, Este mes, Ant, etc)
    const predefinido = periodos.find((p) => p.id === periodoActivoId);
    if (predefinido) return predefinido;

    // 2. Si es personalizado (formato: custom-anio-mes)
    if (periodoActivoId?.startsWith('custom-')) {
      const [, anioStr, mesStr] = periodoActivoId.split('-');
      const anio = parseInt(anioStr);
      const mes = parseInt(mesStr);
      
      // Calculamos el rango exacto para ese mes/año usando el diaCorte
      const inicioDate = new Date(anio, mes - 1, diaCorte);
      const finDate = new Date(anio, mes, diaCorte - 1);
      const toISO = (d) => d.toISOString().split('T')[0];

      return {
        id: periodoActivoId,
        label: `${NOMBRES_MESES[mes - 1]} ${anio}`,
        inicio: toISO(inicioDate),
        fin: toISO(finDate),
        mes,
        anio,
      };
    }

    // 3. Fallback a "Este mes" si aún no hay ID o no se encuentra
    return periodos[1];
  }, [periodos, periodoActivoId, diaCorte]);

  // ──────────────────────────────────────────
  // Carga de datos: gastos + dia_corte del usuario
  // ──────────────────────────────────────────
  async function cargarGastos() {
    try {
      setCargando(true);
      setError(null);

      // Leer dia_corte del perfil del usuario
      const { data: perfil } = await supabase
        .from('users')
        .select('dia_corte')
        .eq('id', usuario.id)
        .single();

      const corte = perfil?.dia_corte ?? 1;
      setDiaCorte(corte);

      // Inicializar el periodo activo en "Este mes" solo la primera vez
      if (periodoActivoId === null) {
        const periodosIniciales = generarPeriodos(corte);
        setPeriodoActivoId(periodosIniciales[1].id);
      }

      // Cargar todos los gastos (el filtrado ocurre en el cliente via useMemo)
      const data = await obtenerTodosLosGastos(usuario.id);
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

  useFocusEffect(
    useCallback(() => {
      if (usuario) cargarGastos();
    }, [usuario])
  );

  // ──────────────────────────────────────────
  // Edición de gasto
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
        prev.map((g) => g.id === gastoEditando.id ? { ...g, ...actualizado } : g)
      );
      setModalVisible(false);
    } catch (e) {
      console.error('Error actualizando gasto:', e);
      Alert.alert('Error', 'No se pudo actualizar el gasto.');
    } finally {
      setGuardando(false);
    }
  }

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
  // Filtrado y agrupación (memoizado)
  // ──────────────────────────────────────────
  const gastosFiltrados = useMemo(() => {
    let resultado = filtrarPorPeriodo(gastos, periodoActivo);

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
  }, [gastos, periodoActivo, categoriaActiva, busqueda]);

  const secciones = useMemo(() => agruparPorFecha(gastosFiltrados), [gastosFiltrados]);

  // Texto corto para el botón del selector de periodo
  const textoBotónPeriodo = useMemo(() => {
    if (!periodoActivo) return 'Periodo';
    if (periodoActivo.id === 'todo') return 'Todo';
    return `${NOMBRES_MESES[(periodoActivo.mes ?? 1) - 1]}`;
  }, [periodoActivo]);

  // ──────────────────────────────────────────
  // Renders
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

  const EstadoVacio = () => (
    <View style={styles.contenedorVacio}>
      <Text style={styles.iconoVacio}>🔍</Text>
      <Text style={styles.textoVacio}>
        {busqueda.trim()
          ? `Sin resultados para "${busqueda}"`
          : periodoActivo?.id === 'todo'
            ? 'Aún no tienes gastos registrados'
            : 'Sin gastos en este periodo'}
      </Text>
      <Text style={styles.subTextoVacio}>
        {busqueda ? 'Intenta con otra búsqueda' : 'Agrega tu primer gasto con el botón +'}
      </Text>
    </View>
  );

  const ResumenPeriodo = () => {
    if (cargando || gastosFiltrados.length === 0) return null;
    const total = gastosFiltrados.reduce((s, g) => s + Number(g.monto), 0);

    // Mostrar rango de fechas exacto cuando el corte es distinto de 1
    const rangoTexto =
      periodoActivo?.inicio && diaCorte > 1
        ? `${formatearFechaLegible(periodoActivo.inicio)} – ${formatearFechaLegible(periodoActivo.fin)}`
        : null;

    return (
      <View style={styles.resumenPeriodo}>
        <Text style={styles.textoResumen}>
          {gastosFiltrados.length} gasto{gastosFiltrados.length !== 1 ? 's' : ''} ·{' '}
          <Text style={styles.totalPeriodo}>
            ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </Text>
        </Text>
        {rangoTexto && (
          <Text style={styles.rangoTexto}>{rangoTexto}</Text>
        )}
      </View>
    );
  };

  // ──────────────────────────────────────────
  // Modal selector de periodo
  // ──────────────────────────────────────────
  const ModalPeriodo = () => (
    <Modal
      visible={modalPeriodoVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setModalPeriodoVisible(false)}
    >
      <Pressable
        style={styles.modalPeriodoOverlay}
        onPress={() => setModalPeriodoVisible(false)}
      >
        <Pressable style={styles.modalPeriodoContenedor} onPress={() => {}}>
          <View style={styles.modalManija} />
          <Text style={styles.modalPeriodoTitulo}>Seleccionar periodo</Text>

          {/* Aviso del corte si es distinto de 1 */}
          {diaCorte > 1 && (
            <Text style={styles.modalPeriodoAviso}>
              📅 Corte el día {diaCorte} · Los periodos se ajustan solos
            </Text>
          )}

          {/* Selector de año */}
          <View style={styles.selectorAnioContenedor}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scrollAnios}
            >
              {aniosDisponibles.map((anio) => (
                <Pressable
                  key={anio}
                  onPress={() => setAnioSelector(anio)}
                  style={[styles.chipAnio, anioSelector === anio && styles.chipAnioActivo]}
                >
                  <Text
                    style={[
                      styles.textoChipAnio,
                      anioSelector === anio && styles.textoChipAnioActivo,
                    ]}
                  >
                    {anio}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Cuadrícula de meses */}
          <View style={styles.cuadriculaMeses}>
            {NOMBRES_MESES.map((mesNombre, index) => {
              const mesNum = index + 1;
              const idPeriodoCustom = `custom-${anioSelector}-${mesNum}`;
              const esActivo =
                periodoActivo.mes === mesNum &&
                periodoActivo.anio === anioSelector &&
                periodoActivo.id !== 'todo';

              return (
                <Pressable
                  key={mesNombre}
                  style={[styles.itemMes, esActivo && styles.itemMesActivo]}
                  onPress={() => {
                    setPeriodoActivoId(idPeriodoCustom);
                    setModalPeriodoVisible(false);
                  }}
                >
                  <Text style={[styles.textoItemMes, esActivo && styles.textoItemMesActivo]}>
                    {mesNombre.substring(0, 3)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.modalPeriodoSeparador} />

          {/* Opción: Todo el historial */}
          <Pressable
            style={[
              styles.modalPeriodoItem,
              periodoActivo.id === 'todo' && styles.modalPeriodoItemActivo,
              { marginHorizontal: 16 },
            ]}
            onPress={() => {
              setPeriodoActivoId('todo');
              setModalPeriodoVisible(false);
            }}
          >
            <Text
              style={[
                styles.modalPeriodoItemTexto,
                periodoActivo.id === 'todo' && styles.modalPeriodoItemTextoActivo,
              ]}
            >
              🗂️ Ver todo el historial
            </Text>
            {periodoActivo.id === 'todo' && (
              <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // ──────────────────────────────────────────
  // Render principal
  // ──────────────────────────────────────────
  return (
    <View style={[styles.contenedor, { paddingTop: insets.top }]}>

      {/* ── Cabecera ── */}
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>Historial</Text>
        <Pressable onPress={cargarGastos}>
          <Ionicons name="refresh-outline" size={22} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      {/* ── Buscador ── */}
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

      {/* ── Selector de periodo + accesos rápidos ── */}
      <View style={styles.filtroPeriodoFila}>
        <Pressable
          style={styles.botonPeriodo}
          onPress={() => setModalPeriodoVisible(true)}
        >
          <Ionicons name="calendar-outline" size={15} color={COLORS.primary} />
          <Text style={styles.botonPeriodoTexto}>{textoBotónPeriodo}</Text>
          <Ionicons name="chevron-down" size={14} color={COLORS.primary} />
        </Pressable>

        <View style={styles.accesoRapidoFila}>
          {[periodos[1], periodos[2], periodos[0]].map((p) => (
            <Pressable
              key={p.id}
              style={[
                styles.chipRapido,
                periodoActivo?.id === p.id && styles.chipRapidoActivo,
              ]}
              onPress={() => setPeriodoActivoId(p.id)}
            >
              <Text
                style={[
                  styles.chipRapidoTexto,
                  periodoActivo?.id === p.id && styles.chipRapidoTextoActivo,
                ]}
              >
                {p.id === 'todo' ? 'Todo' : p === periodos[1] ? 'Este mes' : 'Ant.'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Filtros de categoría ── */}
      <View style={{ height: 42 }}>
        <ScrollView
          ref={scrollCategoriasRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filasChips}
          keyboardShouldPersistTaps="handled"
          alwaysBounceHorizontal={false}
        >
          {CATEGORIAS_FILTER.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => setCategoriaActiva(cat.id)}
              style={[styles.chip, categoriaActiva === cat.id && styles.chipActivo]}
            >
              <Text style={styles.emojiChip}>{cat.icono}</Text>
              <Text
                style={[
                  styles.textoChip,
                  categoriaActiva === cat.id && styles.textoChipActivo,
                ]}
              >
                {cat.nombre}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── Contenido ── */}
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
          ListHeaderComponent={<ResumenPeriodo />}
          ListEmptyComponent={<EstadoVacio />}
          contentContainerStyle={styles.contenidoLista}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ModalPeriodo />

      {/* ── Modal edición de gasto ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}
          >
            <Pressable style={styles.modalContenido} onPress={() => {}}>
              <View style={styles.modalManija} />
              <Text style={styles.modalTitulo}>Editar gasto</Text>

              <Text style={styles.modalLabel}>Monto</Text>
              <View style={styles.contenedorMonto}>
                <Text style={styles.signo}>$</Text>
                <TextInput
                  style={styles.inputMonto}
                  value={montoInput}
                  onChangeText={setMontoInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textSecondary}
                  autoFocus
                />
              </View>

              <Text style={styles.modalLabel}>Categoría</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriasScroll}
                keyboardShouldPersistTaps="handled"
              >
                {CATEGORIAS.map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => setCategoriaInput(cat)}
                    style={[
                      styles.categoriaChip,
                      categoriaInput?.id === cat.id && styles.categoriaChipActivo,
                    ]}
                  >
                    <Text style={styles.categoriaChipIcono}>{cat.icono}</Text>
                    <Text
                      style={[
                        styles.categoriaChipTexto,
                        categoriaInput?.id === cat.id && { color: COLORS.primary },
                      ]}
                    >
                      {cat.nombre}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Descripción</Text>
              <TextInput
                style={styles.inputDescripcion}
                value={descripcionInput}
                onChangeText={setDescripcionInput}
                placeholder="Opcional"
                placeholderTextColor={COLORS.textSecondary}
                maxLength={100}
              />

              <Text style={styles.modalLabel}>Fecha</Text>
              <View style={styles.fechaRow}>
                <Pressable
                  style={[
                    styles.fechaBtn,
                    fechaInput === formatearFechaISO(new Date(Date.now() - 86400000)) &&
                      styles.fechaBtnActivo,
                  ]}
                  onPress={() =>
                    setFechaInput(formatearFechaISO(new Date(Date.now() - 86400000)))
                  }
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

              <View style={styles.modalBotones}>
                <Pressable
                  style={styles.botonEliminar}
                  onPress={() => confirmarEliminacion(gastoEditando?.id)}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF5C5C" />
                </Pressable>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  titulo: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary },

  contenedorBusqueda: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    marginHorizontal: 16, marginBottom: 10, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  inputBusqueda: { flex: 1, color: COLORS.textPrimary, fontSize: 15 },

  filtroPeriodoFila: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 8, gap: 8,
  },
  botonPeriodo: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary + '18', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7, gap: 5,
    borderWidth: 1, borderColor: COLORS.primary + '40',
  },
  botonPeriodoTexto: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  accesoRapidoFila: { flexDirection: 'row', gap: 6, flex: 1, justifyContent: 'flex-end' },
  chipRapido: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  chipRapidoActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipRapidoTexto: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  chipRapidoTextoActivo: { color: '#fff', fontWeight: '600' },

  filasChips: {
    paddingHorizontal: 16, paddingVertical: 4, gap: 8, alignItems: 'center',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, gap: 4,
  },
  chipActivo: { backgroundColor: COLORS.primary + '20', borderColor: COLORS.primary },
  emojiChip: { fontSize: 14 },
  textoChip: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  textoChipActivo: { color: COLORS.primary, fontWeight: '600' },

  contenidoLista: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 6 },
  encabezadoSeccion: {
    flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8, gap: 10,
  },
  textoEncabezado: {
    fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'capitalize',
  },
  lineaDivisora: { flex: 1, height: 1, backgroundColor: COLORS.border },

  resumenPeriodo: { paddingVertical: 6, paddingHorizontal: 2 },
  textoResumen: { fontSize: 13, color: COLORS.textSecondary },
  totalPeriodo: { color: COLORS.primary, fontWeight: '700' },
  rangoTexto: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, opacity: 0.7 },

  contenedorCarga: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  contenedorVacio: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60, gap: 8,
  },
  iconoVacio: { fontSize: 40 },
  textoVacio: {
    color: COLORS.textPrimary, fontSize: 16, fontWeight: '600', textAlign: 'center',
  },
  subTextoVacio: {
    color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 32,
  },
  botonReintentar: {
    marginTop: 12, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: COLORS.primary, borderRadius: 10,
  },
  textoBotonReintentar: { color: '#fff', fontWeight: '600', fontSize: 15 },

  modalPeriodoOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalPeriodoContenedor: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingBottom: 40, maxHeight: '72%',
  },
  modalManija: {
    width: 40, height: 4, backgroundColor: COLORS.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  modalPeriodoTitulo: {
    fontSize: 17, fontWeight: '700', color: COLORS.textPrimary,
    textAlign: 'center', marginBottom: 4,
  },
  modalPeriodoAviso: {
    fontSize: 12, color: COLORS.primary, textAlign: 'center',
    marginBottom: 12, paddingHorizontal: 20,
  },
  modalPeriodoScroll: { paddingHorizontal: 16 },
  modalPeriodoSeparador: {
    height: 1, backgroundColor: COLORS.border, marginVertical: 8, marginHorizontal: 4,
  },
  modalPeriodoItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 8, borderRadius: 10,
  },
  modalPeriodoItemActivo: { backgroundColor: COLORS.primary + '15' },
  modalPeriodoItemTexto: { fontSize: 15, color: COLORS.textPrimary },
  modalPeriodoItemTextoActivo: { color: COLORS.primary, fontWeight: '600' },

  selectorAnioContenedor: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  scrollAnios: {
    paddingHorizontal: 20,
    gap: 10,
  },
  chipAnio: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipAnioActivo: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  textoChipAnio: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  textoChipAnioActivo: {
    color: '#fff',
  },
  cuadriculaMeses: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 10,
    justifyContent: 'center',
  },
  itemMes: {
    width: '30%',
    aspectRatio: 2.2,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemMesActivo: {
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
  },
  textoItemMes: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  textoItemMesActivo: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContenido: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
  },
  modalTitulo: {
    fontSize: 18, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: 16, textAlign: 'center',
  },
  modalLabel: {
    fontSize: 13, fontWeight: '600', color: COLORS.textSecondary,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  contenedorMonto: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
    borderRadius: 12, paddingHorizontal: 16, marginBottom: 16,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  signo: { fontSize: 22, color: COLORS.textSecondary, marginRight: 4 },
  inputMonto: {
    flex: 1, fontSize: 28, fontWeight: '700', color: COLORS.textPrimary, paddingVertical: 12,
  },
  categoriasScroll: { gap: 8, paddingBottom: 12, paddingRight: 8 },
  categoriaChip: {
    alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border, gap: 4,
  },
  categoriaChipActivo: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  categoriaChipIcono: { fontSize: 18 },
  categoriaChipTexto: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '500' },
  inputDescripcion: {
    backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 12, color: COLORS.textPrimary, fontSize: 15, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  fechaRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  fechaBtn: {
    paddingVertical: 10, paddingHorizontal: 16, backgroundColor: COLORS.background,
    borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border,
  },
  fechaBtnActivo: { backgroundColor: COLORS.primary + '25', borderColor: COLORS.primary },
  fechaBtnTexto: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500' },
  fechaDisplay: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: COLORS.background,
    borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center',
  },
  fechaDisplayTexto: { color: COLORS.textPrimary, fontSize: 13 },
  modalBotones: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  botonEliminar: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#FF5C5C18',
    borderWidth: 1, borderColor: '#FF5C5C40', justifyContent: 'center', alignItems: 'center',
  },
  botonCancelar: {
    flex: 1, height: 48, borderRadius: 12, backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  botonCancelarTexto: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '500' },
  botonGuardar: {
    flex: 2, height: 48, borderRadius: 12,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  botonGuardarTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
