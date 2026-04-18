// app/(tabs)/index.jsx
// Dashboard principal de Fintú — Soft Dark Luxury

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hap } from '../../services/haptics';
import { COLORS } from '../../constants/colors';
import { getCategoriaByDbId } from '../../constants/categorias';
import { NOMBRES_MESES, formatearFechaGasto } from '../../utils/fecha';
import { formatMXN } from '../../utils/formato';
import { obtenerPresupuestosMes } from '../../services/presupuestos';
import { obtenerUltimosGastos, obtenerGastosMes, registrarGasto, calcularPeriodo } from '../../services/gastos';
import { supabase } from '../../services/supabase';
import BotonVoz from '../../components/BotonVoz';
import AlertaPresupuesto from '../../components/AlertaPresupuesto';
import { verificarPresupuestos } from '../../services/notificaciones';
import BotonFintu from '../../components/BotonFintu';
import Toast from '../../components/Toast';
import { toLocalISO } from '../../utils/fecha';

// ─── HOOK DE ANIMACIÓN DE CONTADOR ─────────────────────────

function useContadorAnimado(valorFinal, duracion, delay) {
  const [conteo, setConteo] = useState(0);
  const animValue = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  useEffect(() => {
    if (animRef.current) animRef.current.stop();
    animValue.setValue(0);
    setConteo(0);

    const idListener = animValue.addListener(({ value }) => {
      setConteo(Math.round(value));
    });

    animRef.current = Animated.timing(animValue, {
      toValue: valorFinal,
      duration: duracion,
      delay: delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animRef.current.start();

    return () => { animValue.removeListener(idListener); };
  }, [valorFinal]);

  return conteo;
}

// ─── BARRA DE CATEGORÍA ANIMADA ──────────────────────────

function BarraCategoriaItem({ categoria, monto, total, delay }) {
  const pct = total > 0 ? Math.min((monto / total) * 100, 100) : 0;
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    barAnim.setValue(0);
    Animated.timing(barAnim, {
      toValue: pct,
      duration: 700,
      delay: delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);

  return (
    <View style={estilos.catBar}>
      <View style={[estilos.catBarIcon, { backgroundColor: categoria.color + '2E' }]}>
        <Text style={{ fontSize: 16 }}>{categoria.icono}</Text>
      </View>
      <View style={estilos.catBarBody}>
        <View style={estilos.catBarHead}>
          <Text style={estilos.catBarName}>{categoria.nombre}</Text>
          <Text style={estilos.catBarAmt}>{formatMXN(monto)}</Text>
        </View>
        <View style={estilos.catBarTrack}>
          <Animated.View
            style={[
              estilos.catBarFill,
              {
                width: barAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
                backgroundColor: categoria.color,
              },
            ]}
          />
        </View>
      </View>
      <Text style={estilos.catBarPct}>{Math.round(pct)}%</Text>
    </View>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [nombreUsuario, setNombreUsuario] = useState('');
  const [gastadoMes, setGastadoMes] = useState(0);
  const [ultimosGastos, setUltimosGastos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [presupuestoMes, setPresupuestoMes] = useState(0);
  const [ingresosNetos, setIngresosNetos] = useState(0);
  const [gastosPorCategoria, setGastosPorCategoria] = useState({});

  // Estados para disparar animaciones
  const [gastadoAnimado, setGastadoAnimado] = useState(0);
  const [ingresosAnimado, setIngresosAnimado] = useState(0);

  // Animación del sonar del FAB de voz
  const sonarAnim = useRef(new Animated.Value(0)).current;

  // Hooks de contador animado
  const gastoContado = useContadorAnimado(gastadoAnimado, 1000, 0);
  const ingresosContado = useContadorAnimado(ingresosAnimado, 900, 120);
  const disponibleCalc = ingresosAnimado - gastadoAnimado;
  const disponibleContado = useContadorAnimado(disponibleCalc, 900, 240);

  // Modal de Voz
  const [modalVozVisible, setModalVozVisible] = useState(false);
  const [guardandoVoz, setGuardandoVoz] = useState(false);

  const [infoPeriodo, setInfoPeriodo] = useState({ label: '', rango: '' });

  // Alertas de presupuesto
  const [alertas, setAlertas] = useState([]);
  const alertasDismissed = useRef(new Set());

  // Toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMensaje, setToastMensaje] = useState('');
  const [toastTipo, setToastTipo] = useState('exito');

  const mostrarToast = (mensaje, tipo = 'exito') => {
    setToastMensaje(mensaje);
    setToastTipo(tipo);
    setToastVisible(false);
    setTimeout(() => setToastVisible(true), 50);
  };

  // Saludo contextual según la hora del día
  const saludoHora = useMemo(() => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  // Animación sonar del FAB de voz
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(sonarAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(sonarAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Top categorías para las barras del dashboard
  const topCategorias = useMemo(() => {
    return Object.entries(gastosPorCategoria)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([dbId, total]) => ({ categoria: getCategoriaByDbId(parseInt(dbId)), total }));
  }, [gastosPorCategoria]);

  // ── Cargar datos desde Supabase ──
  const cargarDatos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let diaCorte = 1;
      let netoMensual = 0;
      let totalMes = 0;

      if (user) {
        const { data: perfil } = await supabase
          .from('users')
          .select('nombre, ingreso_mensual, dia_corte, isr, imss, iva, vales_despensa, frecuencia_pago, fondo_ahorro')
          .eq('id', user.id)
          .single();

        setNombreUsuario(perfil?.nombre || user.email?.split('@')[0] || 'Usuario');

        const bruto = perfil?.ingreso_mensual || 0;
        const isr = perfil?.isr || 0;
        const imss = perfil?.imss || 0;
        const iva = perfil?.iva || 0;
        const vales = perfil?.vales_despensa || 0;
        const fondo = perfil?.fondo_ahorro || 0;
        const frecuencia = perfil?.frecuencia_pago || 'mensual';

        const factor = frecuencia === 'quincenal' ? 2 : 1;
        netoMensual = (bruto - isr - imss - iva - fondo + vales) * factor;

        setIngresosNetos(netoMensual);
        diaCorte = perfil?.dia_corte || 1;
      }

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
        rangoPeriodo = `${diaIni} ${mesIniCorto} – ${diaFin} ${mesFinCorto}`;
      }
      setInfoPeriodo({ label: labelPeriodo, rango: rangoPeriodo });

      // RENDIMIENTO: 3 queries en paralelo
      const [gastosDelMes, recientes, presupuestosData] = await Promise.all([
        obtenerGastosMes(budgetMonth, budgetYear, diaCorte),
        obtenerUltimosGastos(5, inicio, fin),
        obtenerPresupuestosMes(budgetMonth, budgetYear),
      ]);

      totalMes = gastosDelMes.reduce((sum, g) => sum + parseFloat(g.monto), 0);
      setGastadoMes(totalMes);
      setUltimosGastos(recientes);

      // Agregación de gastos por categoría para las barras
      const totalesCat = {};
      gastosDelMes.forEach(g => {
        if (g.categoria_id) {
          totalesCat[g.categoria_id] = (totalesCat[g.categoria_id] || 0) + parseFloat(g.monto);
        }
      });
      setGastosPorCategoria(totalesCat);

      const totalPresupuestado = presupuestosData.reduce(
        (sum, p) => sum + parseFloat(p.limite), 0
      );
      setPresupuestoMes(totalPresupuestado);

      setCargando(false);
      setRefrescando(false);
      setGastadoAnimado(totalMes);
      setIngresosAnimado(netoMensual);

    } catch (error) {
      console.error('Error cargando dashboard:', error);
      setCargando(false);
      setRefrescando(false);
    }
  };

  useEffect(() => {
    if (!cargando && gastadoAnimado >= 0) {
      const timer = setTimeout(() => hap.suave(), 1000);
      return () => clearTimeout(timer);
    }
  }, [gastadoAnimado, cargando]);

  const actualizarAlertas = async () => {
    const nuevasAlertas = await verificarPresupuestos();
    const visibles = nuevasAlertas.filter(a => !alertasDismissed.current.has(a.id));
    setAlertas(visibles);
  };

  useFocusEffect(
    useCallback(() => {
      setCargando(true);
      cargarDatos();
      actualizarAlertas();
    }, [])
  );

  const onRefresh = () => {
    hap.suave();
    setRefrescando(true);
    cargarDatos();
    actualizarAlertas();
  };

  const handleDismissAlerta = (id) => {
    alertasDismissed.current.add(id);
    setAlertas(prev => prev.filter(a => a.id !== id));
  };

  // ── Guardar gasto por voz ──
  const handleResultadoVoz = async (datos) => {
    if (!datos.monto || datos.monto === '0') {
      setModalVozVisible(false);
      router.push('/(tabs)/agregar');
      return;
    }

    try {
      setGuardandoVoz(true);
      const { data: { user } } = await supabase.auth.getUser();

      await registrarGasto({
        userId: user?.id,
        monto: parseFloat(datos.monto),
        categoriaId: datos.categoria?.dbId || 9,
        descripcion: datos.descripcion || '',
        fecha: datos.fecha || toLocalISO(new Date()),
        origen: 'voz',
      });

      setModalVozVisible(false);
      cargarDatos();
      actualizarAlertas();
      mostrarToast(`🎙️ Guardado: $${datos.monto} en ${datos.categoria?.nombre}`);

    } catch (error) {
      console.error('Error guardando gasto por voz:', error);
      mostrarToast('No se pudo guardar el gasto. Intenta de nuevo.', 'error');
    } finally {
      setGuardandoVoz(false);
    }
  };

  const inicialAvatar = nombreUsuario ? nombreUsuario.charAt(0).toUpperCase() : '?';

  return (
    <View style={estilos.contenedor}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <Toast visible={toastVisible} mensaje={toastMensaje} tipo={toastTipo} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={estilos.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* ── HEADER ── */}
        <View style={[estilos.header, { paddingTop: insets.top + 16 }]}>
          <View style={estilos.headerLeft}>
            <Text style={estilos.saludoTxt}>{saludoHora}</Text>
            <Text style={estilos.nombreTxt}>
              {cargando ? 'Cargando...' : nombreUsuario}{' '}
              <Text style={{ opacity: 0.8 }}>👋</Text>
            </Text>
          </View>
          <View style={estilos.headerRight}>
            <TouchableOpacity style={estilos.iconBtn}>
              <Ionicons name="notifications-outline" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={estilos.avatar}
              onPress={() => router.push('/(tabs)/perfil')}
            >
              <Text style={estilos.avatarTxt}>{inicialAvatar}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── BALANCE CARD ── */}
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={estilos.balanceCard}
        >
          <View style={estilos.balanceRow1}>
            <Text style={estilos.balanceLabel}>Balance disponible</Text>
            {infoPeriodo.label ? (
              <View style={estilos.mesBadge}>
                <Text style={estilos.mesBadgeTxt}>{infoPeriodo.label}</Text>
              </View>
            ) : null}
          </View>

          {cargando ? (
            <ActivityIndicator color="#fff" style={{ marginVertical: 14 }} />
          ) : (
            <Text style={estilos.balanceMonto}>
              {formatMXN(disponibleContado)}
            </Text>
          )}

          {presupuestoMes > 0 && !cargando && (
            <View style={estilos.trendBadge}>
              <Text style={estilos.trendTxt}>
                ▲ {Math.round((gastadoMes / presupuestoMes) * 100)}% del presupuesto
              </Text>
            </View>
          )}

          <View style={estilos.balanceSub}>
            <View style={estilos.balanceSubItem}>
              <Text style={estilos.balanceSubLabel}>Ingresos</Text>
              <Text style={[estilos.balanceSubValue, { color: '#A0FFD6' }]}>
                {cargando ? '---' : formatMXN(ingresosContado)}
              </Text>
            </View>
            <View style={estilos.balanceSubDivider} />
            <View style={estilos.balanceSubItem}>
              <Text style={estilos.balanceSubLabel}>Gastos</Text>
              <Text style={estilos.balanceSubValue}>
                {cargando ? '---' : formatMXN(gastoContado)}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── ALERTAS ── */}
        {alertas.length > 0 && (
          <AlertaPresupuesto alertas={alertas} onDismiss={handleDismissAlerta} />
        )}

        {/* ── GASTOS DEL MES POR CATEGORÍA ── */}
        {topCategorias.length > 0 && (
          <View style={estilos.seccion}>
            <View style={estilos.seccionHeader}>
              <Text style={estilos.seccionTitulo}>Gastos del mes</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/gastos')}>
                <Text style={estilos.verTodos}>Ver todo →</Text>
              </TouchableOpacity>
            </View>
            {topCategorias.map(({ categoria, total }, i) => (
              <BarraCategoriaItem
                key={categoria.id}
                categoria={categoria}
                monto={total}
                total={gastadoMes}
                delay={i * 80}
              />
            ))}
          </View>
        )}

        {/* ── ÚLTIMOS MOVIMIENTOS ── */}
        <View style={estilos.seccion}>
          <View style={estilos.seccionHeader}>
            <Text style={estilos.seccionTitulo}>Últimos movimientos</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/gastos')}>
              <Text style={estilos.verTodos}>Ver todos →</Text>
            </TouchableOpacity>
          </View>
          {cargando ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
          ) : ultimosGastos.length === 0 ? (
            <View style={estilos.estadoVacio}>
              <Text style={estilos.estadoVacioEmoji}>💸</Text>
              <Text style={estilos.estadoVacioTitulo}>Sin gastos este mes</Text>
            </View>
          ) : (
            ultimosGastos.map(g => (
              <GastoItem
                key={g.id}
                gasto={g}
                categoria={getCategoriaByDbId(g.categoria_id)}
                onPress={() => router.push('/(tabs)/gastos')}
              />
            ))
          )}
        </View>

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* ── FAB DE VOZ FLOTANTE ── */}
      <View style={[estilos.voiceFab, { bottom: insets.bottom + 108 }]}>
        {/* Anillo sonar */}
        <Animated.View
          style={[
            estilos.sonarRing,
            {
              opacity: sonarAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.4, 0, 0],
              }),
              transform: [{
                scale: sonarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 2.2],
                }),
              }],
            },
          ]}
        />
        <TouchableOpacity
          style={estilos.voiceFabBtn}
          onLongPress={() => { hap.guardar(); setModalVozVisible(true); }}
          delayLongPress={500}
          activeOpacity={0.8}
        >
          <Ionicons name="mic" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={estilos.voiceFabLabel}>mantén presionado</Text>
      </View>

      {/* ── MODAL DE VOZ ── */}
      <Modal
        visible={modalVozVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !guardandoVoz && setModalVozVisible(false)}
      >
        <View style={estilos.modalOverlay}>
          <View style={estilos.modalContenido}>
            <Pressable
              onPress={() => !guardandoVoz && setModalVozVisible(false)}
              style={estilos.modalHandleContenedor}
            >
              <View style={estilos.modalHandle} />
            </Pressable>
            <Text style={estilos.modalTitulo}>Registrar por voz</Text>
            <Text style={estilos.modalSubtitulo}>"Gasté 150 pesos en tacos hoy"</Text>

            <View style={estilos.modalBotonVoz}>
              {guardandoVoz ? (
                <View style={{ alignItems: 'center', gap: 12 }}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>
                    Analizando y guardando...
                  </Text>
                </View>
              ) : (
                <BotonVoz onResultado={handleResultadoVoz} tamaño="grande" />
              )}
            </View>

            {!guardandoVoz && (
              <TouchableOpacity
                style={estilos.btnCancelarModal}
                onPress={() => setModalVozVisible(false)}
              >
                <Text style={estilos.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── COMPONENTE: GASTO ITEM ─────────────────────────────

function GastoItem({ gasto, categoria, onPress }) {
  return (
    <TouchableOpacity
      style={estilos.gastoItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[estilos.gastoIcono, { backgroundColor: categoria.color + '2E' }]}>
        <Text style={estilos.gastoEmoji}>{categoria.icono}</Text>
      </View>
      <View style={estilos.gastoInfo}>
        <Text style={estilos.gastoDescripcion} numberOfLines={1}>
          {gasto.descripcion || categoria.nombre}
        </Text>
        <View style={estilos.gastoMeta}>
          <Text style={estilos.gastoCategoria}>{categoria.nombre}</Text>
          <View style={estilos.metaDot} />
          <Text style={estilos.gastoFecha}>{formatearFechaGasto(gasto.fecha)}</Text>
        </View>
      </View>
      <Text style={estilos.gastoMonto}>−{formatMXN(gasto.monto)}</Text>
    </TouchableOpacity>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flexGrow: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saludoTxt: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  nombreTxt: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Balance card
  balanceCard: {
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 24,
    overflow: 'hidden',
  },
  balanceRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  mesBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  mesBadgeTxt: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  balanceMonto: {
    fontSize: 42,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: -1,
    lineHeight: 50,
    marginBottom: 10,
  },
  trendBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,212,170,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 20,
  },
  trendTxt: {
    fontSize: 12,
    color: '#A0FFD6',
    fontWeight: '500',
  },
  balanceSub: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 16,
  },
  balanceSubItem: {
    flex: 1,
  },
  balanceSubDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 16,
  },
  balanceSubLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 4,
  },
  balanceSubValue: {
    fontSize: 15,
    fontWeight: '400',
    color: '#fff',
  },

  // Sección genérica
  seccion: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  seccionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  seccionTitulo: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  verTodos: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  // Barras de categorías
  catBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  catBarIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  catBarBody: {
    flex: 1,
  },
  catBarHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  catBarName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  catBarAmt: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  catBarTrack: {
    height: 6,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 999,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  catBarPct: {
    fontSize: 11,
    color: COLORS.textSecondary,
    width: 32,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  // Transacciones
  gastoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 14,
  },
  gastoIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  gastoEmoji: {
    fontSize: 18,
  },
  gastoInfo: {
    flex: 1,
    minWidth: 0,
  },
  gastoDescripcion: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  gastoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gastoCategoria: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  metaDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.textMuted,
  },
  gastoFecha: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  gastoMonto: {
    fontSize: 15,
    fontWeight: '400',
    color: COLORS.coral,
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },

  // Estado vacío
  estadoVacio: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  estadoVacioEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  estadoVacioTitulo: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // FAB de voz flotante
  voiceFab: {
    position: 'absolute',
    right: 20,
    alignItems: 'center',
    gap: 6,
  },
  sonarRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(108,99,255,0.4)',
  },
  voiceFabBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(108,99,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(108,99,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceFabLabel: {
    fontSize: 9,
    letterSpacing: 0.5,
    color: COLORS.textMuted,
    textTransform: 'lowercase',
  },

  // Modal de voz
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContenido: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 48,
    alignItems: 'center',
  },
  modalHandleContenedor: {
    paddingVertical: 8,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginBottom: 16,
  },
  modalTitulo: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  modalSubtitulo: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  modalBotonVoz: {
    marginBottom: 20,
    alignItems: 'center',
  },
  btnCancelarModal: {
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  btnCancelarTexto: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
});
