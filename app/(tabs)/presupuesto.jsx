// /app/(tabs)/presupuesto.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { CATEGORIAS } from '../../constants/categorias';
import { obtenerPresupuestosMes, guardarPresupuesto, eliminarPresupuesto } from '../../services/presupuestos';
import { obtenerGastosMes, calcularPeriodo } from '../../services/gastos';
import { supabase } from '../../services/supabase';

// ──────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────
const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

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
// Barra de progreso de una categoría
// Muestra cuánto gastaste vs tu límite
// ──────────────────────────────────────────
function BarraPresupuesto({ gastado, limite }) {
  const porcentaje = limite > 0 ? Math.min((gastado / limite) * 100, 100) : 0;

  // Color según qué tan cerca está del límite
  const colorBarra =
    porcentaje >= 100 ? COLORS.error :
    porcentaje >= 80  ? COLORS.warning :
    COLORS.primary;

  return (
    <View style={styles.barraContenedor}>
      <View style={styles.barraBg}>
        <View
          style={[
            styles.barraRelleno,
            { width: `${porcentaje}%`, backgroundColor: colorBarra },
          ]}
        />
      </View>
      <Text style={[styles.baraPorcentaje, { color: colorBarra }]}>
        {Math.round(porcentaje)}%
      </Text>
    </View>
  );
}

// ──────────────────────────────────────────
// Pantalla principal de presupuestos
// ──────────────────────────────────────────
export default function PresupuestoScreen() {
  const insets = useSafeAreaInsets();

  // ── Estado ──
  const [presupuestos, setPresupuestos] = useState([]);  // datos de Supabase
  const [gastosPorCategoria, setGastosPorCategoria] = useState({}); // { categoria_id: total }
  const [cargando, setCargando] = useState(true);
  const [infoPeriodo, setInfoPeriodo] = useState({ label: '', rango: '', mes: 1, anio: 2026 });

  // Modal para editar un presupuesto
  const [modalVisible, setModalVisible] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [limiteInput, setLimiteInput] = useState('');
  const [guardando, setGuardando] = useState(false);

  // ──────────────────────────────────────────
  // Cargar presupuestos y gastos del mes
  // ──────────────────────────────────────────
  async function cargarDatos() {
    try {
      setCargando(true);

      const { data: { user } } = await supabase.auth.getUser();
      
      // Obtener dia_corte del perfil
      const { data: perfil } = await supabase
        .from('users')
        .select('dia_corte')
        .eq('id', user.id)
        .single();

      const diaCorte = perfil?.dia_corte || 1;

      // Calcular el periodo actual basado en el día de corte
      const { inicio, fin } = calcularPeriodo(diaCorte, 0);
      const [anioIni, mesIni, diaIni] = inicio.split('-').map(Number);
      const [anioFin, mesFin, diaFin] = fin.split('-').map(Number);

      // El mes y año del presupuesto deben corresponder al INICIO del periodo
      const budgetMonth = mesIni;
      const budgetYear = anioIni;

      // Actualizar info del periodo
      let labelPeriodo = `${NOMBRES_MESES[budgetMonth - 1]} ${budgetYear}`;
      let rangoPeriodo = '';
      if (diaCorte > 1) {
        const mesFinCorto = NOMBRES_MESES[mesFin - 1].substring(0, 3);
        const mesIniCorto = NOMBRES_MESES[mesIni - 1].substring(0, 3);
        rangoPeriodo = `(${diaIni} ${mesIniCorto} – ${diaFin} ${mesFinCorto})`;
      }
      setInfoPeriodo({ label: labelPeriodo, rango: rangoPeriodo, mes: budgetMonth, anio: budgetYear });

      // Cargar presupuestos y gastos en paralelo
      const [presupuestosData, gastosData] = await Promise.all([
        obtenerPresupuestosMes(budgetMonth, budgetYear),
        obtenerGastosMes(budgetMonth, budgetYear, diaCorte),
      ]);

      setPresupuestos(presupuestosData);

      // Agrupar gastos por categoria_id y sumar montos
      const totales = {};
      for (const gasto of gastosData) {
        const cid = gasto.categoria_id;
        totales[cid] = (totales[cid] || 0) + parseFloat(gasto.monto);
      }
      setGastosPorCategoria(totales);

    } catch (e) {
      console.error('Error cargando presupuestos:', e);
      Alert.alert('Error', 'No se pudieron cargar los presupuestos.');
    } finally {
      setCargando(false);
    }
  }

  // Recargar cada vez que el usuario entra a esta pantalla
  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [])
  );

  // ──────────────────────────────────────────
  // Abrir modal para editar/crear presupuesto
  // ──────────────────────────────────────────
  function abrirModal(categoria) {
    const presupuestoExistente = presupuestos.find(
      (p) => p.categoria_id === categoria.dbId
    );
    setCategoriaEditando(categoria);
    setLimiteInput(presupuestoExistente ? String(presupuestoExistente.limite) : '');
    setModalVisible(true);
  }

  // ──────────────────────────────────────────
  // Guardar presupuesto en Supabase
  // ──────────────────────────────────────────
  async function handleGuardar() {
    const limite = parseFloat(limiteInput);

    if (!limiteInput || isNaN(limite) || limite <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a $0');
      return;
    }

    try {
      setGuardando(true);
      await guardarPresupuesto(categoriaEditando.dbId, limite, infoPeriodo.mes, infoPeriodo.anio);

      // Actualizar lista local sin recargar todo
      setPresupuestos((prev) => {
        const existe = prev.find((p) => p.categoria_id === categoriaEditando.dbId);
        if (existe) {
          return prev.map((p) =>
            p.categoria_id === categoriaEditando.dbId ? { ...p, limite } : p
          );
        }
        return [...prev, { categoria_id: categoriaEditando.dbId, limite, mes: infoPeriodo.mes, anio: infoPeriodo.anio }];
      });

      setModalVisible(false);
    } catch (e) {
      console.error('Error guardando presupuesto:', e);
      Alert.alert('Error', 'No se pudo guardar el presupuesto.');
    } finally {
      setGuardando(false);
    }
  }

  // ──────────────────────────────────────────
  // Eliminar presupuesto de una categoría
  // ──────────────────────────────────────────
  function handleEliminar() {
    const presupuesto = presupuestos.find(
      (p) => p.categoria_id === categoriaEditando.dbId
    );
    if (!presupuesto) {
      setModalVisible(false);
      return;
    }

    Alert.alert(
      'Eliminar presupuesto',
      `¿Eliminar el presupuesto de ${categoriaEditando.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarPresupuesto(presupuesto.id);
              setPresupuestos((prev) =>
                prev.filter((p) => p.categoria_id !== categoriaEditando.dbId)
              );
              setModalVisible(false);
            } catch (e) {
              Alert.alert('Error', 'No se pudo eliminar el presupuesto.');
            }
          },
        },
      ]
    );
  }

  // ──────────────────────────────────────────
  // Calcular totales generales del mes
  // ──────────────────────────────────────────
  const totalPresupuestado = presupuestos.reduce((sum, p) => sum + parseFloat(p.limite), 0);
  const totalGastado = Object.values(gastosPorCategoria).reduce((sum, v) => sum + v, 0);
  const porcentajeGeneral = totalPresupuestado > 0
    ? Math.min(Math.round((totalGastado / totalPresupuestado) * 100), 100)
    : 0;

  // ──────────────────────────────────────────
  // Render principal
  // ──────────────────────────────────────────
  return (
    <View style={[styles.contenedor, { paddingTop: insets.top }]}>

      {/* Título */}
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>Presupuesto</Text>
        <Text style={styles.subtitulo}>
          {infoPeriodo.label} <Text style={styles.rangoTexto}>{infoPeriodo.rango}</Text>
        </Text>
      </View>

      {cargando ? (
        <View style={styles.contenedorCarga}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* Resumen general del mes */}
          {totalPresupuestado > 0 && (
            <View style={styles.resumenGeneral}>
              <View style={styles.resumenFila}>
                <Text style={styles.resumenLabel}>Presupuestado</Text>
                <Text style={styles.resumenMonto}>{formatMXN(totalPresupuestado)}</Text>
              </View>
              <View style={styles.resumenFila}>
                <Text style={styles.resumenLabel}>Gastado</Text>
                <Text style={[
                  styles.resumenMonto,
                  { color: porcentajeGeneral >= 100 ? COLORS.error : COLORS.textPrimary }
                ]}>
                  {formatMXN(totalGastado)}
                </Text>
              </View>
              <View style={styles.barraBg}>
                <View
                  style={[
                    styles.barraRelleno,
                    {
                      width: `${porcentajeGeneral}%`,
                      backgroundColor: porcentajeGeneral >= 100 ? COLORS.error
                        : porcentajeGeneral >= 80 ? COLORS.warning
                        : COLORS.primary,
                    },
                  ]}
                />
              </View>
              <Text style={styles.resumenPorcentaje}>
                {porcentajeGeneral}% del presupuesto total usado
              </Text>
            </View>
          )}

          {/* Lista de categorías */}
          <Text style={styles.seccionTitulo}>Por categoría</Text>

          {CATEGORIAS.map((categoria) => {
            const presupuesto = presupuestos.find((p) => p.categoria_id === categoria.dbId);
            const gastado = gastosPorCategoria[categoria.dbId] || 0;
            const limite = presupuesto ? parseFloat(presupuesto.limite) : 0;
            const tieneLimite = !!presupuesto;
            const superado = tieneLimite && gastado > limite;

            return (
              <Pressable
                key={categoria.id}
                style={[
                  styles.tarjetaCategoria,
                  superado && styles.tarjetaSuperada,
                ]}
                onPress={() => abrirModal(categoria)}
              >
                {/* Ícono y nombre */}
                <View style={styles.categoriaIzquierda}>
                  <View style={[styles.iconoContenedor, { backgroundColor: categoria.color + '25' }]}>
                    <Text style={styles.icono}>{categoria.icono}</Text>
                  </View>
                  <View>
                    <Text style={styles.categoriaNombre}>{categoria.nombre}</Text>
                    {tieneLimite ? (
                      <Text style={styles.categoriaDetalle}>
                        {formatMXN(gastado)} de {formatMXN(limite)}
                      </Text>
                    ) : (
                      <Text style={[styles.categoriaDetalle, { color: COLORS.primary }]}>
                        Toca para fijar límite
                      </Text>
                    )}
                  </View>
                </View>

                {/* Lado derecho: ícono de alerta o chevron */}
                <View style={styles.categoriaDerecha}>
                  {superado && (
                    <Ionicons name="warning" size={16} color={COLORS.error} style={{ marginRight: 6 }} />
                  )}
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                </View>
              </Pressable>
            );
          })}

          {/* Barra de progreso debajo de cada categoría con presupuesto */}
          {/* (se renderiza fuera del map para mejor control visual) */}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── MODAL PARA EDITAR PRESUPUESTO ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Pressable style={styles.modalContenido}>

              {/* Handle visual */}
              <View style={styles.modalHandle} />

              {/* Encabezado del modal */}
              {categoriaEditando && (
                <View style={styles.modalHeader}>
                  <View style={[
                    styles.iconoContenedor,
                    { backgroundColor: categoriaEditando.color + '25' }
                  ]}>
                    <Text style={styles.icono}>{categoriaEditando.icono}</Text>
                  </View>
                  <Text style={styles.modalTitulo}>
                    {categoriaEditando.nombre}
                  </Text>
                </View>
              )}

              <Text style={styles.modalLabel}>Límite mensual</Text>

              {/* Input del monto */}
              <View style={styles.inputContenedor}>
                <Text style={styles.inputPrefijo}>$</Text>
                <TextInput
                  style={styles.input}
                  value={limiteInput}
                  onChangeText={setLimiteInput}
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  autoFocus
                />
              </View>

              {/* Botones */}
              <View style={styles.modalBotones}>
                {/* Mostrar botón eliminar solo si ya tiene presupuesto */}
                {presupuestos.find((p) => p.categoria_id === categoriaEditando?.dbId) && (
                  <Pressable
                    style={styles.botonEliminar}
                    onPress={handleEliminar}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  </Pressable>
                )}

                <Pressable
                  style={styles.botonCancelar}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.botonCancelarTexto}>Cancelar</Text>
                </Pressable>

                <Pressable
                  style={styles.botonGuardar}
                  onPress={handleGuardar}
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
  contenedor: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  cabecera: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  titulo: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitulo: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  rangoTexto: {
    fontSize: 12,
    color: COLORS.textSecondary,
    opacity: 0.7,
  },
  contenedorCarga: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  // Resumen general
  resumenGeneral: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  resumenFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resumenLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  resumenMonto: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  resumenPorcentaje: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },

  // Sección categorías
  seccionTitulo: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Tarjeta de categoría
  tarjetaCategoria: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tarjetaSuperada: {
    borderWidth: 1,
    borderColor: COLORS.error + '60',
  },
  categoriaIzquierda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconoContenedor: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icono: {
    fontSize: 22,
  },
  categoriaNombre: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  categoriaDetalle: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  categoriaDerecha: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Barra de progreso
  barraContenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  barraBg: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barraRelleno: {
    height: '100%',
    borderRadius: 3,
  },
  baraPorcentaje: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContenido: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
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
    gap: 12,
    marginBottom: 20,
  },
  modalTitulo: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  modalLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
  inputContenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  inputPrefijo: {
    color: COLORS.textSecondary,
    fontSize: 24,
    marginRight: 4,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '600',
    paddingVertical: 16,
  },
  modalBotones: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  botonEliminar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.error + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  botonCancelar: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
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