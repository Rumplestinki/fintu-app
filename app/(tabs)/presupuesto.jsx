// /app/(tabs)/presupuesto.jsx
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
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { CATEGORIAS } from '../../constants/categorias';
import { NOMBRES_MESES } from '../../utils/fecha';
import { formatMXN } from '../../utils/formato';
import { obtenerPresupuestosMes, guardarPresupuesto, eliminarPresupuesto } from '../../services/presupuestos';
import { obtenerGastosMes, calcularPeriodo } from '../../services/gastos';
import { supabase } from '../../services/supabase';
import { hap } from '../../services/haptics';
import Toast from '../../components/Toast';

// ──────────────────────────────────────────
// Barra de progreso animada de una categoría
// ──────────────────────────────────────────
function BarraPresupuesto({ gastado, limite, delay = 0 }) {
  const porcentaje = limite > 0 ? Math.min((gastado / limite) * 100, 100) : 0;
  const anchoAnim = useRef(new Animated.Value(0)).current;

  // 0-70% verde, 70-90% ámbar, >90% rojo
  const colorBarra =
    porcentaje >= 90 ? COLORS.error :
    porcentaje >= 70 ? COLORS.warning :
    COLORS.success;

  useEffect(() => {
    anchoAnim.setValue(0);
    Animated.timing(anchoAnim, {
      toValue: porcentaje,
      duration: 700,
      delay: delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [porcentaje]);

  return (
    <View style={styles.barraContenedor}>
      <View style={styles.barraBg}>
        <Animated.View
          style={[
            styles.barraRelleno,
            {
              width: anchoAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: colorBarra,
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

// ──────────────────────────────────────────
// Pantalla principal de presupuestos
// ──────────────────────────────────────────
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

  const barraGeneralAnim = useRef(new Animated.Value(0)).current;

  // Toast
  const [toastMensaje, setToastMensaje] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTipo, setToastTipo] = useState('exito');

  // ──────────────────────────────────────────
  // Cargar presupuestos y gastos del mes
  // ──────────────────────────────────────────
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
      const budgetYear = anioIni;

      let labelPeriodo = `${NOMBRES_MESES[budgetMonth - 1]} ${budgetYear}`;
      let rangoPeriodo = '';
      if (diaCorte > 1) {
        const mesFinCorto = NOMBRES_MESES[mesFin - 1].substring(0, 3);
        const mesIniCorto = NOMBRES_MESES[mesIni - 1].substring(0, 3);
        rangoPeriodo = `(${diaIni} ${mesIniCorto} – ${diaFin} ${mesFinCorto})`;
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

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [])
  );

  const mostrarToast = (mensaje, tipo = 'exito') => {
    setToastMensaje(mensaje);
    setToastTipo(tipo);
    setToastVisible(false);
    setTimeout(() => setToastVisible(true), 50);
  };

  // ──────────────────────────────────────────
  // Calcular totales generales
  // ──────────────────────────────────────────
  const totalPresupuestado = presupuestos.reduce((sum, p) => sum + parseFloat(p.limite), 0);
  const totalGastado = Object.values(gastosPorCategoria).reduce((sum, v) => sum + v, 0);
  const porcentajeGeneral = totalPresupuestado > 0
    ? Math.min(Math.round((totalGastado / totalPresupuestado) * 100), 100)
    : 0;

  useEffect(() => {
    if (!cargando && totalPresupuestado > 0) {
      barraGeneralAnim.setValue(0);
      Animated.timing(barraGeneralAnim, {
        toValue: porcentajeGeneral,
        duration: 900,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [cargando, porcentajeGeneral]);

  function abrirModal(categoria) {
    const presupuestoExistente = presupuestos.find(
      (p) => p.categoria_id === categoria.dbId
    );
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
        const existe = prev.find((p) => p.categoria_id === categoriaEditando.dbId);
        if (existe) {
          return prev.map((p) =>
            p.categoria_id === categoriaEditando.dbId ? { ...p, limite } : p
          );
        }
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
    const presupuesto = presupuestos.find(
      (p) => p.categoria_id === categoriaEditando?.dbId
    );
    if (!presupuesto) {
      setModalVisible(false);
      return;
    }
    hap.advertencia();
    setModalEliminarVisible(true);
  }

  async function ejecutarEliminacion() {
    // CORREGIDO: null check antes de acceder a presupuesto.id
    const presupuesto = presupuestos.find(
      (p) => p.categoria_id === categoriaEditando?.dbId
    );
    if (!presupuesto) {
      setModalEliminarVisible(false);
      return;
    }

    try {
      hap.error();
      await eliminarPresupuesto(presupuesto.id);
      setPresupuestos((prev) =>
        prev.filter((p) => p.categoria_id !== categoriaEditando.dbId)
      );
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

      <View style={styles.cabecera}>
        <Text style={styles.titulo}>Presupuesto</Text>
        <Text style={styles.subtitulo}>
          {infoPeriodo.label} <Text style={styles.rangoTexto}>{infoPeriodo.rango}</Text>
        </Text>
      </View>

      <Toast visible={toastVisible} mensaje={toastMensaje} tipo={toastTipo} />

      {cargando ? (
        <View style={styles.contenedorCarga}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Resumen general */}
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
                  { color: porcentajeGeneral >= 90 ? COLORS.error : COLORS.textPrimary },
                ]}>
                  {formatMXN(totalGastado)}
                </Text>
              </View>
              <View style={styles.barraBg}>
                <Animated.View
                  style={[
                    styles.barraRelleno,
                    {
                      width: barraGeneralAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                      backgroundColor: porcentajeGeneral >= 90 ? COLORS.error
                        : porcentajeGeneral >= 70 ? COLORS.warning
                        : COLORS.success,
                    },
                  ]}
                />
              </View>
              <Text style={styles.resumenPorcentaje}>
                {porcentajeGeneral}% del presupuesto total usado
              </Text>
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

          {/* RENDIMIENTO: usar index directamente en lugar de CATEGORIAS.indexOf */}
          {CATEGORIAS.map((categoria, index) => {
            const presupuesto = presupuestos.find((p) => p.categoria_id === categoria.dbId);
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
                    superado && styles.tarjetaSuperada,
                    tieneLimite && styles.tarjetaConBarra,
                  ]}
                  onPress={() => { hap.suave(); abrirModal(categoria); }}
                >
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

                  <View style={styles.categoriaDerecha}>
                    {superado && (
                      <Ionicons name="warning" size={16} color={COLORS.error} style={{ marginRight: 6 }} />
                    )}
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                  </View>
                </Pressable>

                {tieneLimite && (
                  <View style={[
                    styles.barraIntegrada,
                    superado && { borderTopWidth: 0, borderColor: COLORS.error + '60' },
                  ]}>
                    <BarraPresupuesto
                      gastado={gastado}
                      limite={limite}
                      delay={index * 60}
                    />
                  </View>
                )}
              </View>
            );
          })}

          <View style={{ height: 75 }} />
        </ScrollView>
      )}

      {/* ── MODAL EDITAR PRESUPUESTO ── */}
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

              {categoriaEditando && (
                <View style={styles.modalHeader}>
                  <View style={[styles.iconoContenedor, { backgroundColor: categoriaEditando.color + '25' }]}>
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
                {presupuestos.find((p) => p.categoria_id === categoriaEditando?.dbId) && (
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

      {/* Modal Confirmación Eliminación */}
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
  cabecera: { paddingHorizontal: 20, paddingVertical: 16 },
  titulo: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '700' },
  subtitulo: { color: COLORS.textSecondary, fontSize: 14, marginTop: 2 },
  rangoTexto: { fontSize: 12, color: COLORS.textSecondary, opacity: 0.7 },
  contenedorCarga: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 24,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitulo: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  emptySubtitulo: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },

  // Resumen
  resumenGeneral: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 24 },
  resumenFila: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  resumenLabel: { color: COLORS.textSecondary, fontSize: 14 },
  resumenMonto: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  resumenPorcentaje: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6, textAlign: 'right' },

  seccionTitulo: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // CORREGIDO: overflow: 'hidden' solo una vez
  tarjetaWrapper: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },

  tarjetaCategoria: {
    backgroundColor: COLORS.surface,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tarjetaConBarra: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tarjetaSuperada: {},
  barraIntegrada: { backgroundColor: COLORS.surface, paddingHorizontal: 14, paddingVertical: 10 },
  categoriaIzquierda: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconoContenedor: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  icono: { fontSize: 22 },
  categoriaNombre: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '500', marginBottom: 2 },
  categoriaDetalle: { color: COLORS.textSecondary, fontSize: 13 },
  categoriaDerecha: { flexDirection: 'row', alignItems: 'center' },

  barraContenedor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barraBg: { flex: 1, height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  barraRelleno: { height: '100%', borderRadius: 4 },
  baraPorcentaje: { fontSize: 12, fontWeight: '700', minWidth: 38, textAlign: 'right' },

  tarjetaWrapperSuperado: {
    borderWidth: 1,
    borderColor: COLORS.error + '60',
    borderRadius: 12,
  },

  // Modal eliminación
  modalEliminarOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  modalEliminarContenedor: {
    backgroundColor: COLORS.surface, borderRadius: 20, padding: 24,
    alignItems: 'center', width: '100%',
  },
  modalEliminarIcono: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.error + '20',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  modalEliminarTitulo: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  modalEliminarMensaje: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalEliminarBotones: { flexDirection: 'row', gap: 12, width: '100%' },
  modalEliminarBtnCancelar: {
    flex: 1, height: 48, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  modalEliminarBtnCancelarTxt: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  modalEliminarBtnConfirmar: {
    flex: 1, height: 48, borderRadius: 12,
    backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center',
  },
  modalEliminarBtnConfirmarTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Modal general
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContenido: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  modalTitulo: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '600' },
  modalLabel: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 8 },
  inputContenedor: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 16, marginBottom: 24,
  },
  inputPrefijo: { color: COLORS.textSecondary, fontSize: 24, marginRight: 4 },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 32, fontWeight: '600', paddingVertical: 16 },
  modalBotones: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  botonEliminar: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.error + '20', justifyContent: 'center', alignItems: 'center',
  },
  botonCancelar: {
    flex: 1, height: 48, borderRadius: 12,
    backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center',
  },
  botonCancelarTexto: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '500' },
  botonGuardar: {
    flex: 2, height: 48, borderRadius: 12,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  botonGuardarTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
