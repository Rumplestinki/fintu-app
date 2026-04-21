// app/(tabs)/presupuesto.jsx
// Pantalla de presupuestos — diseño Soft Dark Luxury con barras animadas

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { CATEGORIAS } from '../../constants/categorias';
import { NOMBRES_MESES } from '../../utils/fecha';
import { formatMXN, hexToRgba } from '../../utils/formato';
import { obtenerPresupuestosMes, guardarPresupuesto, eliminarPresupuesto } from '../../services/presupuestos';
import { obtenerGastosMes, calcularPeriodo } from '../../services/gastos';
import { supabase } from '../../services/supabase';
import { hap } from '../../services/haptics';
import Toast from '../../components/Toast';

// ─── BARRA DE PROGRESO ANIMADA ────────────────────────────
function BarraPresupuesto({ gastado, limite, delay = 0 }) {
  const porcentaje = limite > 0 ? Math.min((gastado / limite) * 100, 100) : 0;
  const anchoAnim  = useRef(new Animated.Value(0)).current;
  const parpadeoAnim = useRef(new Animated.Value(1)).current;

  // Color semántico según porcentaje
  const colorBarra =
    porcentaje >= 90 ? COLORS.error :
    porcentaje >= 70 ? COLORS.warning :
    COLORS.success;

  useEffect(() => {
    anchoAnim.setValue(0);
    Animated.timing(anchoAnim, {
      toValue: porcentaje,
      duration: 600,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // Parpadeo cuando supera el 100%
    if (porcentaje >= 100) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(parpadeoAnim, { toValue: 0.4, duration: 400, useNativeDriver: true }),
          Animated.timing(parpadeoAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [porcentaje]);

  return (
    <View style={styles.barraContenedor}>
      <View style={styles.barraBg}>
        <Animated.View
          style={[
            styles.barraRelleno,
            {
              width: anchoAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
              backgroundColor: colorBarra,
              opacity: porcentaje >= 100 ? parpadeoAnim : 1,
            },
          ]}
        />
      </View>
      <Text style={[styles.baraPorcentaje, { color: colorBarra }]}>
        {Math.round(porcentaje)}%
      </Text>
    </View>
  );
}

// ─── DONUT CHART (sin SVG, usando vistas circulares) ─────
function DonutChart({ porcentaje }) {
  const pct = Math.min(porcentaje, 100);
  const colorProgreso =
    pct >= 90 ? COLORS.error :
    pct >= 70 ? COLORS.warning :
    COLORS.primary;

  // Mensaje de estado
  let mensajeEstado = '✓ ¡Vas muy bien!';
  let colorEstado = COLORS.success;
  if (pct >= 90) { mensajeEstado = '🔴 Límite cerca'; colorEstado = COLORS.error; }
  else if (pct >= 70) { mensajeEstado = '⚠ Cuidado'; colorEstado = COLORS.warning; }

  return { colorProgreso, mensajeEstado, colorEstado };
}

// ─── PANTALLA PRINCIPAL ───────────────────────────────────
export default function PresupuestoScreen() {
  const insets = useSafeAreaInsets();

  const [presupuestos, setPresupuestos] = useState([]);
  const [gastosPorCategoria, setGastosPorCategoria] = useState({});
  const [cargando, setCargando] = useState(true);
  const [infoPeriodo, setInfoPeriodo] = useState({ label: '', rango: '', mes: 1, anio: 2026 });

  const [modalVisible, setModalVisible] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [limiteInput, setLimiteInput] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [modalEliminarVisible, setModalEliminarVisible] = useState(false);

  // Toast
  const [toastMensaje, setToastMensaje] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTipo, setToastTipo] = useState('exito');

  // ── Cargar presupuestos y gastos ──
  async function cargarDatos() {
    try {
      setCargando(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { data: perfil } = await supabase
        .from('users')
        .select('dia_corte')
        .eq('id', user.id)
        .single();

      const diaCorte = perfil?.dia_corte || 1;
      const { inicio, fin } = calcularPeriodo(diaCorte, 0);
      const [anioIni, mesIni, diaIni] = inicio.split('-').map(Number);
      const [anioFin, mesFin, diaFin] = fin.split('-').map(Number);
      const budgetMonth = mesIni;
      const budgetYear  = anioIni;

      let labelPeriodo = `${NOMBRES_MESES[budgetMonth - 1]} ${budgetYear}`;
      let rangoPeriodo = '';
      if (diaCorte > 1) {
        const mIni = NOMBRES_MESES[mesIni - 1].substring(0, 3);
        const mFin = NOMBRES_MESES[mesFin - 1].substring(0, 3);
        rangoPeriodo = `(${diaIni} ${mIni} – ${diaFin} ${mFin})`;
      }
      setInfoPeriodo({ label: labelPeriodo, rango: rangoPeriodo, mes: budgetMonth, anio: budgetYear });

      const [presupuestosData, gastosData] = await Promise.all([
        obtenerPresupuestosMes(budgetMonth, budgetYear),
        obtenerGastosMes(budgetMonth, budgetYear, diaCorte),
      ]);

      setPresupuestos(presupuestosData);

      const totales = {};
      for (const gasto of gastosData) {
        const cid = gasto.categoria_id;
        totales[cid] = (totales[cid] || 0) + parseFloat(gasto.monto);
      }
      setGastosPorCategoria(totales);
    } catch (e) {
      console.error('Error cargando presupuestos:', e);
      mostrarToast('No se pudieron cargar los datos', 'error');
    } finally {
      setCargando(false);
    }
  }

  useFocusEffect(useCallback(() => { cargarDatos(); }, []));

  const mostrarToast = (mensaje, tipo = 'exito') => {
    setToastMensaje(mensaje);
    setToastTipo(tipo);
    setToastVisible(false);
    setTimeout(() => setToastVisible(true), 50);
  };

  // Totales generales
  const totalPresupuestado = presupuestos.reduce((sum, p) => sum + parseFloat(p.limite), 0);
  const totalGastado = Object.values(gastosPorCategoria).reduce((sum, v) => sum + v, 0);
  const porcentajeGeneral = totalPresupuestado > 0
    ? Math.min(Math.round((totalGastado / totalPresupuestado) * 100), 100)
    : 0;

  const { colorProgreso, mensajeEstado, colorEstado } = DonutChart({ porcentaje: porcentajeGeneral });

  function abrirModal(categoria) {
    const presupuestoExistente = presupuestos.find(p => p.categoria_id === categoria.dbId);
    setCategoriaEditando(categoria);
    setLimiteInput(presupuestoExistente ? String(presupuestoExistente.limite) : '');
    setModalVisible(true);
  }

  async function handleGuardar() {
    const limite = parseFloat(limiteInput);
    if (!limiteInput || isNaN(limite) || limite <= 0) {
      hap.error();
      mostrarToast('El monto debe ser mayor a $0', 'error');
      return;
    }
    try {
      setGuardando(true);
      await guardarPresupuesto(categoriaEditando.dbId, limite, infoPeriodo.mes, infoPeriodo.anio);
      setPresupuestos((prev) => {
        const existe = prev.find(p => p.categoria_id === categoriaEditando.dbId);
        if (existe) return prev.map(p => p.categoria_id === categoriaEditando.dbId ? { ...p, limite } : p);
        return [...prev, { categoria_id: categoriaEditando.dbId, limite, mes: infoPeriodo.mes, anio: infoPeriodo.anio }];
      });
      hap.logro();
      setModalVisible(false);
      setTimeout(() => mostrarToast('Presupuesto guardado'), 300);
    } catch (e) {
      console.error('Error guardando presupuesto:', e);
      hap.error();
      mostrarToast('No se pudo guardar. Intenta de nuevo.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  function handleEliminar() {
    const presupuesto = presupuestos.find(p => p.categoria_id === categoriaEditando?.dbId);
    if (!presupuesto) { setModalVisible(false); return; }
    hap.advertencia();
    setModalEliminarVisible(true);
  }

  async function ejecutarEliminacion() {
    const presupuesto = presupuestos.find(p => p.categoria_id === categoriaEditando?.dbId);
    if (!presupuesto) { setModalEliminarVisible(false); return; }
    try {
      hap.error();
      await eliminarPresupuesto(presupuesto.id);
      setPresupuestos(prev => prev.filter(p => p.categoria_id !== categoriaEditando.dbId));
      setModalEliminarVisible(false);
      setModalVisible(false);
      setTimeout(() => mostrarToast('Presupuesto eliminado'), 300);
    } catch (e) {
      setModalEliminarVisible(false);
      mostrarToast('No se pudo eliminar. Intenta de nuevo.', 'error');
    }
  }

  return (
    <View style={[styles.contenedor, { paddingTop: insets.top }]}>
      <Toast visible={toastVisible} mensaje={toastMensaje} tipo={toastTipo} />

      {/* ── Cabecera ── */}
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>Presupuestos</Text>
        <Text style={styles.subtitulo}>
          {infoPeriodo.label} <Text style={styles.rangoTexto}>{infoPeriodo.rango}</Text>
        </Text>
      </View>

      {cargando ? (
        <View style={styles.contenedorCarga}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* ── Card resumen global ── */}
          {totalPresupuestado > 0 && (
            <View style={styles.cardResumen}>
              {/* Indicador circular */}
              <View style={styles.donutWrap}>
                <View style={[styles.donutOuter, { borderColor: COLORS.border }]}>
                  <View style={[styles.donutInner, { borderColor: colorProgreso }]}>
                    <Text style={[styles.donutPct, { color: colorProgreso }]}>{porcentajeGeneral}%</Text>
                  </View>
                </View>
              </View>

              {/* Datos al lado del donut */}
              <View style={{ flex: 1, paddingLeft: 20 }}>
                <Text style={styles.resumenMontos}>
                  {formatMXN(totalGastado)} / {formatMXN(totalPresupuestado)}
                </Text>
                <Text style={[styles.resumenEstado, { color: colorEstado }]}>{mensajeEstado}</Text>
                <Text style={styles.resumenLabel}>del presupuesto mensual</Text>
              </View>
            </View>
          )}

          {/* Empty state cuando no hay presupuestos */}
          {totalPresupuestado === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎯</Text>
              <Text style={styles.emptyTitulo}>Sin presupuestos aún</Text>
              <Text style={styles.emptySubtitulo}>
                Toca cualquier categoría para fijar tu límite mensual de gasto.
              </Text>
            </View>
          )}

          <Text style={styles.seccionTitulo}>Por categoría</Text>

          {/* ── Cards de presupuesto ── */}
          {CATEGORIAS.map((categoria, index) => {
            const presupuesto = presupuestos.find(p => p.categoria_id === categoria.dbId);
            const gastado = gastosPorCategoria[categoria.dbId] || 0;
            const limite = presupuesto ? parseFloat(presupuesto.limite) : 0;
            const tieneLimite = !!presupuesto;
            const superado = tieneLimite && gastado > limite;

            return (
              <View
                key={categoria.id}
                style={[styles.tarjetaWrapper, superado && styles.tarjetaWrapperSuperado]}
              >
                <Pressable
                  style={[
                    styles.tarjetaCategoria,
                    tieneLimite && styles.tarjetaConBarra,
                  ]}
                  onPress={() => { hap.suave(); abrirModal(categoria); }}
                >
                  <View style={styles.categoriaIzquierda}>
                    <View style={[styles.iconoContenedor, { backgroundColor: hexToRgba(categoria.color, 0.18) }]}>
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

                  <View style={styles.categoriaDerecha}>
                    {superado && (
                      <Ionicons name="warning" size={16} color={COLORS.error} style={{ marginRight: 6 }} />
                    )}
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                  </View>
                </Pressable>

                {tieneLimite && (
                  <View style={[styles.barraIntegrada, superado && { borderTopColor: COLORS.error + '60' }]}>
                    <BarraPresupuesto gastado={gastado} limite={limite} delay={index * 60} />
                  </View>
                )}
              </View>
            );
          })}

          {/* Card punteada para agregar */}
          <Pressable
            style={styles.cardAgregar}
            onPress={() => {
              hap.suave();
              // Abre el modal con primera categoría sin presupuesto
              const sinPresupuesto = CATEGORIAS.find(c => !presupuestos.find(p => p.categoria_id === c.dbId));
              if (sinPresupuesto) abrirModal(sinPresupuesto);
            }}
          >
            <Text style={styles.cardAgregarTexto}>+ Agregar presupuesto</Text>
          </Pressable>

          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* ── Modal editar presupuesto ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={styles.modalContenido} onPress={() => {}}>
              <View style={styles.modalHandle} />

              {categoriaEditando && (
                <View style={styles.modalHeader}>
                  <View style={[styles.iconoContenedor, { backgroundColor: hexToRgba(categoriaEditando.color, 0.18) }]}>
                    <Text style={styles.icono}>{categoriaEditando.icono}</Text>
                  </View>
                  <Text style={styles.modalTitulo}>{categoriaEditando.nombre}</Text>
                </View>
              )}

              <Text style={styles.modalLabel}>Límite mensual</Text>
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

              <View style={styles.modalBotones}>
                {presupuestos.find(p => p.categoria_id === categoriaEditando?.dbId) && (
                  <Pressable style={styles.botonEliminar} onPress={handleEliminar}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  </Pressable>
                )}
                <Pressable style={styles.botonCancelar} onPress={() => setModalVisible(false)}>
                  <Text style={styles.botonCancelarTexto}>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.botonGuardar} onPress={handleGuardar} disabled={guardando}>
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

      {/* Modal confirmación eliminación */}
      <Modal
        visible={modalEliminarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalEliminarVisible(false)}
      >
        <Pressable style={styles.modalEliminarOverlay} onPress={() => setModalEliminarVisible(false)}>
          <Pressable style={styles.modalEliminarContenedor} onPress={() => {}}>
            <View style={styles.modalEliminarIcono}>
              <Text style={{ fontSize: 32 }}>🗑️</Text>
            </View>
            <Text style={styles.modalEliminarTitulo}>Eliminar presupuesto</Text>
            <Text style={styles.modalEliminarMensaje}>
              Esta acción no se puede deshacer.{'\n'}
              ¿Eliminar el presupuesto de {categoriaEditando?.nombre}?
            </Text>
            <View style={styles.modalEliminarBotones}>
              <Pressable
                style={styles.modalEliminarBtnCancelar}
                onPress={() => { hap.suave(); setModalEliminarVisible(false); }}
              >
                <Text style={styles.modalEliminarBtnCancelarTxt}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalEliminarBtnConfirmar} onPress={ejecutarEliminacion}>
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
  cabecera: { paddingHorizontal: 20, paddingVertical: 16 },
  titulo: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '600' },
  subtitulo: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  rangoTexto: { fontSize: 12, color: COLORS.textMuted },
  contenedorCarga: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },

  // Card resumen con donut
  cardResumen: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  donutWrap: { alignItems: 'center', justifyContent: 'center' },
  donutOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  donutPct: { fontSize: 16, fontWeight: '600' },
  resumenMontos: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 4 },
  resumenEstado: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  resumenLabel: { fontSize: 12, color: COLORS.textMuted },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 24,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitulo: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  emptySubtitulo: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },

  seccionTitulo: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  // Tarjeta de categoría
  tarjetaWrapper: {
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tarjetaWrapperSuperado: {
    borderWidth: 1,
    borderColor: COLORS.error + '60',
    borderRadius: 16,
  },
  tarjetaCategoria: {
    backgroundColor: COLORS.surface,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tarjetaConBarra: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  barraIntegrada: { backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 10 },
  categoriaIzquierda: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconoContenedor: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  icono: { fontSize: 20 },
  categoriaNombre: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '500', marginBottom: 2 },
  categoriaDetalle: { color: COLORS.textSecondary, fontSize: 13 },
  categoriaDerecha: { flexDirection: 'row', alignItems: 'center' },

  // Barra de progreso
  barraContenedor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barraBg: { flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  barraRelleno: { height: '100%', borderRadius: 3 },
  baraPorcentaje: { fontSize: 12, fontWeight: '700', minWidth: 38, textAlign: 'right' },

  // Card punteada para agregar
  cardAgregar: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    marginBottom: 8,
  },
  cardAgregarTexto: { fontSize: 14, color: COLORS.textMuted },

  // Modales
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContenido: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  modalTitulo: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '600' },
  modalLabel: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 8 },
  inputContenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  inputPrefijo: { color: COLORS.textSecondary, fontSize: 24, marginRight: 4 },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 32, fontWeight: '600', paddingVertical: 16 },
  modalBotones: { flexDirection: 'row', gap: 10, alignItems: 'center' },
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
