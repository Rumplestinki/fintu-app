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
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { CATEGORIAS, getCategoriaByDbId } from '../../constants/categorias';
import GastoCard from '../../components/GastoCard';
import { 
  obtenerGastosMes, 
  obtenerTodosLosGastos, 
  eliminarGasto, 
  actualizarGasto,
  calcularPeriodo
} from '../../services/gastos';
import { supabase } from '../../services/supabase';
import { hap } from '../../services/haptics';

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

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
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
  const [categoriaActiva, setCategoriaActiva] = useState('todas'); // puede ser 'todas' o un dbId (número)
  const [busqueda, setBusqueda] = useState('');

  // Estados de UI
  const [modalPeriodoVisible, setModalPeriodoVisible] = useState(false);
  const [modalEdicionVisible, setModalEdicionVisible] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);

  // ── Cargar Gastos desde Supabase ──
  async function cargarGastos() {
    try {
      setCargando(true);
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Obtener día de corte
      const { data: perfil } = await supabase
        .from('users')
        .select('dia_corte')
        .eq('id', user.id)
        .single();
      
      const corte = perfil?.dia_corte || 1;
      setDiaCorte(corte);

      // 2. Determinar qué periodo cargar
      let data = [];
      if (periodoActivoId === 'todo') {
        data = await obtenerTodosLosGastos(user.id);
      } else {
        const offset = periodoActivoId === 'anterior' ? -1 : 0;
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
    // 1. Filtrar por categoría y búsqueda
    let filtrados = gastosRaw.filter((g) => {
      // FIX: Comparar contra el dbId numérico o contra 'todas'
      const matchCat = categoriaActiva === 'todas' || Number(g.categoria_id) === Number(categoriaActiva);
      
      const matchBusqueda = !busqueda || 
        (g.descripcion || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        getCategoriaByDbId(g.categoria_id).nombre.toLowerCase().includes(busqueda.toLowerCase());
      
      return matchCat && matchBusqueda;
    });

    // 2. Agrupar por fecha para SectionList
    const grupos = filtrados.reduce((acc, g) => {
      const fecha = g.fecha; // 'YYYY-MM-DD'
      if (!acc[fecha]) acc[fecha] = [];
      acc[fecha].push(g);
      return acc;
    }, {});

    // 3. Convertir a array de secciones ordenado
    return Object.keys(grupos)
      .sort((a, b) => b.localeCompare(a))
      .map((fecha) => ({
        title: fecha,
        data: grupos[fecha],
      }));
  }, [gastosRaw, categoriaActiva, busqueda]);

  // ── Acciones de Gasto ──
  function abrirEdicion(gasto) {
    hap.suave();
    setGastoEditando({
      ...gasto,
      monto: String(gasto.monto),
    });
    setModalEdicionVisible(true);
  }

  async function handleGuardarEdicion() {
    hap.guardar();
    if (!gastoEditando.monto || parseFloat(gastoEditando.monto) <= 0) {
      Alert.alert('Error', 'Monto inválido');
      return;
    }

    try {
      setCargando(true);
      await actualizarGasto(gastoEditando.id, {
        monto: parseFloat(gastoEditando.monto),
        descripcion: gastoEditando.descripcion,
        categoria_id: gastoEditando.categoria_id,
      });
      setModalEdicionVisible(false);
      cargarGastos();
    } catch (e) {
      Alert.alert('Error', 'No se pudo actualizar');
    } finally {
      setCargando(false);
    }
  }

  function handleEliminarConfirmar(gastoId) {
    Alert.alert('Eliminar gasto', '¿Estás seguro de que quieres borrar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { 
        text: 'Eliminar', 
        style: 'destructive', 
        onPress: async () => {
          hap.error();
          await eliminarGasto(gastoId);
          cargarGastos();
        } 
      },
    ]);
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
              onPress={() => { 
                hap.suave(); 
                setCategoriaActiva(cat.dbId || cat.id); 
              }}
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
      <Modal visible={modalEdicionVisible} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlayEdicion}
        >
          <View style={styles.modalEdicion}>
            <View style={styles.handle} />
            <View style={styles.edicionHeader}>
              <Text style={styles.edicionTitulo}>Editar gasto</Text>
              <Pressable onPress={() => handleEliminarConfirmar(gastoEditando.id)}>
                <Ionicons name="trash-outline" size={22} color={COLORS.error} />
              </Pressable>
            </View>

            {gastoEditando && (
              <ScrollView>
                <Text style={styles.label}>Monto</Text>
                <View style={styles.inputMontoRow}>
                  <Text style={styles.prefijoMonto}>$</Text>
                  <TextInput
                    style={styles.inputMonto}
                    keyboardType="numeric"
                    value={gastoEditando.monto}
                    onChangeText={(t) => setGastoEditando({...gastoEditando, monto: t})}
                  />
                </View>

                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={styles.inputDesc}
                  value={gastoEditando.descripcion}
                  onChangeText={(t) => setGastoEditando({...gastoEditando, descripcion: t})}
                />

                <Text style={styles.label}>Categoría</Text>
                <View style={styles.gridCategoriasEdicion}>
                  {CATEGORIAS.map(cat => (
                    <Pressable 
                      key={cat.id}
                      style={[
                        styles.catEdicionBtn,
                        gastoEditando.categoria_id === cat.dbId && { borderColor: cat.color, backgroundColor: cat.color + '20' }
                      ]}
                      onPress={() => setGastoEditando({...gastoEditando, categoria_id: cat.dbId})}
                    >
                      <Text style={{ fontSize: 20 }}>{cat.icono}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.edicionBotones}>
                  <Pressable 
                    style={styles.btnCancelar} 
                    onPress={() => setModalEdicionVisible(false)}
                  >
                    <Text style={styles.btnCancelarTxt}>Cancelar</Text>
                  </Pressable>
                  <Pressable 
                    style={styles.btnGuardar} 
                    onPress={handleGuardarEdicion}
                  >
                    <Text style={styles.btnGuardarTxt}>Guardar</Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
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
    paddingVertical: 15
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
    borderColor: COLORS.border
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
    borderColor: COLORS.border
  },
  chipActivo: { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary },
  emojiChip: { fontSize: 16, marginRight: 6 },
  textoChip: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  textoChipActivo: { color: COLORS.primary, fontWeight: '600' },

  headerSeccion: { 
    backgroundColor: COLORS.background, 
    paddingHorizontal: 20, 
    paddingVertical: 10,
    marginTop: 10
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
  modalEdicion: { backgroundColor: COLORS.surface, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, paddingBottom: 40, maxHeight: '90%' },
  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  edicionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  edicionTitulo: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 10, textTransform: 'uppercase' },
  inputMontoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  prefijoMonto: { fontSize: 30, fontWeight: '700', color: COLORS.textPrimary, marginRight: 5 },
  inputMonto: { fontSize: 40, fontWeight: '700', color: COLORS.primary, flex: 1 },
  inputDesc: { backgroundColor: COLORS.background, borderRadius: 12, padding: 15, color: COLORS.textPrimary, fontSize: 16, marginBottom: 25, borderWidth: 1, borderColor: COLORS.border },
  gridCategoriasEdicion: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 30 },
  catEdicionBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  edicionBotones: { flexDirection: 'row', gap: 15 },
  btnCancelar: { flex: 1, paddingVertical: 15, borderRadius: 15, alignItems: 'center', backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  btnCancelarTxt: { color: COLORS.textSecondary, fontWeight: '600' },
  btnGuardar: { flex: 2, paddingVertical: 15, borderRadius: 15, alignItems: 'center', backgroundColor: COLORS.primary },
  btnGuardarTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
