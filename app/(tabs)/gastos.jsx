// /app/(tabs)/gastos.jsx
import { useState, useEffect, useMemo } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { obtenerTodosLosGastos, eliminarGasto } from '../../services/gastos';
import GastoCard from '../../components/GastoCard';

// ──────────────────────────────────────────
// Categorías disponibles para el chip-filter
// Deben coincidir con las de tu tabla categorias
// ──────────────────────────────────────────
const CATEGORIAS_FILTER = [
  { id: 'todos', nombre: 'Todos', icono: '🗂️' },
  { id: 'comida', nombre: 'Comida', icono: '🍽️' },
  { id: 'transporte', nombre: 'Transporte', icono: '🚗' },
  { id: 'renta', nombre: 'Renta', icono: '🏠' },
  { id: 'entretenimiento', nombre: 'Entretenimiento', icono: '🎬' },
  { id: 'salud', nombre: 'Salud', icono: '🏥' },
  { id: 'educacion', nombre: 'Educación', icono: '📚' },
  { id: 'servicios', nombre: 'Servicios', icono: '💡' },
  { id: 'suscripciones', nombre: 'Suscripciones', icono: '📱' },
  { id: 'otros', nombre: 'Otros', icono: '📦' },
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
// Convierte una fecha ISO a encabezado legible
// "Hoy", "Ayer", o "Lun 5 ene"
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
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// ──────────────────────────────────────────
// Agrupa un array de gastos por fecha
// Devuelve formato que espera SectionList:
// [{ title: 'Hoy', data: [...gastos] }, ...]
// ──────────────────────────────────────────
function agruparPorFecha(gastos) {
  const grupos = {};

  for (const gasto of gastos) {
    const clave = etiquetaDeFecha(gasto.fecha);
    if (!grupos[clave]) grupos[clave] = [];
    grupos[clave].push(gasto);
  }

  return Object.entries(grupos).map(([title, data]) => ({ title, data }));
}

// ──────────────────────────────────────────
// Filtra gastos según el periodo seleccionado
// ──────────────────────────────────────────
function filtrarPorFecha(gastos, filtro) {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  const finMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth(), 0);

  return gastos.filter((g) => {
    const fecha = new Date(g.fecha);
    if (filtro === 'mes') return fecha >= inicioMes;
    if (filtro === 'anterior') return fecha >= inicioMesAnterior && fecha <= finMesAnterior;
    return true; // 'todo'
  });
}

// ──────────────────────────────────────────
// Pantalla principal: Historial de gastos
// ──────────────────────────────────────────
export default function HistorialScreen() {
  const insets = useSafeAreaInsets();
  const { usuario } = useAuth();

  // Estado de carga y datos
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Estado de los filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('mes');
  const [categoriaActiva, setCategoriaActiva] = useState('todos');

  // ──────────────────────────────────────────
  // Carga los gastos desde Supabase al montar
  // ──────────────────────────────────────────
  async function cargarGastos() {
    try {
      setCargando(true);
      setError(null);
      const data = await obtenerTodosLosGastos(usuario.id);
      setGastos(data);
    } catch (e) {
      setError('No se pudieron cargar los gastos.');
      console.error('Error cargando gastos:', e);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (usuario) cargarGastos();
  }, [usuario]);

  // ──────────────────────────────────────────
  // Confirmar y eliminar un gasto
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
              // Actualizar lista local sin recargar todo
              setGastos((prev) => prev.filter((g) => g.id !== gastoId));
            } catch (e) {
              Alert.alert('Error', 'No se pudo eliminar el gasto.');
            }
          },
        },
      ]
    );
  }

  // ──────────────────────────────────────────
  // Filtra gastos en tiempo real usando los 3 filtros
  // useMemo para no recalcular en cada render
  // ──────────────────────────────────────────
  const gastosFiltrados = useMemo(() => {
    let resultado = gastos;

    // Filtro por fecha
    resultado = filtrarPorFecha(resultado, filtroFecha);

    // Filtro por categoría
    if (categoriaActiva !== 'todos') {
      resultado = resultado.filter(
        (g) => g.categorias?.nombre?.toLowerCase() === categoriaActiva
      );
    }

    // Filtro por búsqueda de texto
    if (busqueda.trim()) {
      const termino = busqueda.toLowerCase();
      resultado = resultado.filter(
        (g) =>
          g.descripcion?.toLowerCase().includes(termino) ||
          g.categorias?.nombre?.toLowerCase().includes(termino)
      );
    }

    return resultado;
  }, [gastos, filtroFecha, categoriaActiva, busqueda]);

  // Agrupa los gastos filtrados para SectionList
  const secciones = useMemo(() => agruparPorFecha(gastosFiltrados), [gastosFiltrados]);

  // ──────────────────────────────────────────
  // Total del periodo filtrado
  // ──────────────────────────────────────────
  const totalPeriodo = useMemo(
    () => gastosFiltrados.reduce((sum, g) => sum + Number(g.monto), 0),
    [gastosFiltrados]
  );

  // ──────────────────────────────────────────
  // Render del encabezado de sección (fecha)
  // ──────────────────────────────────────────
  function renderEncabezado({ section }) {
    return (
      <View style={styles.encabezadoSeccion}>
        <Text style={styles.textoEncabezado}>{section.title}</Text>
        <View style={styles.lineaDivisora} />
      </View>
    );
  }

  // ──────────────────────────────────────────
  // Render de cada gasto en la lista
  // ──────────────────────────────────────────
  function renderGasto({ item }) {
    return (
      <GastoCard
        gasto={item}
        onDelete={() => confirmarEliminacion(item.id)}
      />
    );
  }

  // ──────────────────────────────────────────
  // Estado vacío — sin gastos que mostrar
  // ──────────────────────────────────────────
  function EstadoVacio() {
    const mensaje =
      busqueda.trim()
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
  }

  // ──────────────────────────────────────────
  // Encabezado con buscador, filtros y totales
  // ──────────────────────────────────────────
  function Encabezado() {
    return (
      <View>
        {/* Barra de búsqueda */}
        <View style={styles.contenedorBusqueda}>
          <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.inputBusqueda}
            placeholder="Buscar gasto..."
            placeholderTextColor={COLORS.textSecondary}
            value={busqueda}
            onChangeText={setBusqueda}
          />
          {busqueda.length > 0 && (
            <Pressable onPress={() => setBusqueda('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Filtros por fecha */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.contenedorChips}
        >
          {FILTROS_FECHA.map((filtro) => (
            <Pressable
              key={filtro.id}
              onPress={() => setFiltroFecha(filtro.id)}
              style={[
                styles.chip,
                filtroFecha === filtro.id && styles.chipActivo,
              ]}
            >
              <Text
                style={[
                  styles.textoChip,
                  filtroFecha === filtro.id && styles.textoChipActivo,
                ]}
              >
                {filtro.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Filtros por categoría */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.contenedorChips}
        >
          {CATEGORIAS_FILTER.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => setCategoriaActiva(cat.id)}
              style={[
                styles.chip,
                categoriaActiva === cat.id && styles.chipActivo,
              ]}
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

        {/* Resumen del periodo */}
        {!cargando && gastosFiltrados.length > 0 && (
          <View style={styles.resumenPeriodo}>
            <Text style={styles.textoResumen}>
              {gastosFiltrados.length} gasto{gastosFiltrados.length !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.montoResumen}>
              {new Intl.NumberFormat('es-MX', {
                style: 'currency',
                currency: 'MXN',
                minimumFractionDigits: 0,
              }).format(totalPeriodo)}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ──────────────────────────────────────────
  // Render principal de la pantalla
  // ──────────────────────────────────────────
  return (
    <View style={[styles.contenedor, { paddingTop: insets.top }]}>
      {/* Título de la pantalla */}
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>Historial</Text>
        <Pressable onPress={cargarGastos}>
          <Ionicons name="refresh-outline" size={22} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      {/* Estado de carga */}
      {cargando ? (
        <View style={styles.contenedorCarga}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        /* Error al cargar */
        <View style={styles.contenedorVacio}>
          <Text style={styles.iconoVacio}>⚠️</Text>
          <Text style={styles.textoVacio}>{error}</Text>
          <Pressable style={styles.botonReintentar} onPress={cargarGastos}>
            <Text style={styles.textoBotonReintentar}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        /* Lista principal con secciones */
        <SectionList
          sections={secciones}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderGasto}
          renderSectionHeader={renderEncabezado}
          ListHeaderComponent={<Encabezado />}
          ListEmptyComponent={<EstadoVacio />}
          contentContainerStyle={styles.contenidoLista}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  titulo: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '700',
  },

  // Buscador
  contenedorBusqueda: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  inputBusqueda: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
  },

  // Chips de filtros
  contenedorChips: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  chipActivo: {
    backgroundColor: COLORS.primary,
  },
  emojiChip: {
    fontSize: 14,
  },
  textoChip: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  textoChipActivo: {
    color: '#fff',
  },

  // Resumen del periodo
  resumenPeriodo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
  },
  textoResumen: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  montoResumen: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },

  // Lista
  contenidoLista: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  // Encabezado de sección (fecha)
  encabezadoSeccion: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    gap: 10,
  },
  textoEncabezado: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lineaDivisora: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },

  // Estado vacío
  contenedorVacio: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  iconoVacio: {
    fontSize: 48,
    marginBottom: 16,
  },
  textoVacio: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  subTextoVacio: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },

  // Estado de carga
  contenedorCarga: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Botón reintentar
  botonReintentar: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  textoBotonReintentar: {
    color: '#fff',
    fontWeight: '600',
  },
});