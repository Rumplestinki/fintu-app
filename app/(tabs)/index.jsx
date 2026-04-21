// app/(tabs)/index.jsx
// Dashboard principal de Fintú — diseño Soft Dark Luxury

import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hap } from '../../services/haptics';
import { COLORS } from '../../constants/colors';
import { getCategoriaByDbId } from '../../constants/categorias';
import { NOMBRES_MESES, formatearFechaGasto } from '../../utils/fecha';
import { formatMXN, hexToRgba } from '../../utils/formato';
import { obtenerPresupuestosMes } from '../../services/presupuestos';
import { obtenerUltimosGastos, obtenerGastosMes, registrarGasto, calcularPeriodo } from '../../services/gastos';
import { supabase } from '../../services/supabase';
import BotonVoz from '../../components/BotonVoz';
import AlertaPresupuesto from '../../components/AlertaPresupuesto';
import { verificarPresupuestos } from '../../services/notificaciones';
import Toast from '../../components/Toast';
import { toLocalISO } from '../../utils/fecha';

// ─── SALUDO SEGÚN HORA ──────────────────────────────────────
function saludo() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ─── COMPONENTE: BARRA DE CATEGORÍA ANIMADA ─────────────────
function BarraCategoria({ categoria, total, totalMes, delay }) {
  const pct = totalMes > 0 ? Math.min((total / totalMes) * 100, 100) : 0;
  const anchoAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anchoAnim.setValue(0);
    Animated.timing(anchoAnim, {
      toValue: pct,
      duration: 600,
      delay: delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);

  return (
    <View style={estilos.catRow}>
      {/* Ícono */}
      <View style={[estilos.catIcono, { backgroundColor: hexToRgba(categoria.color, 0.18) }]}>
        <Text style={estilos.catEmoji}>{categoria.icono}</Text>
      </View>
      {/* Info + barra */}
      <View style={estilos.catInfo}>
        <Text style={estilos.catNombre}>{categoria.nombre}</Text>
        <View style={estilos.barraBg}>
          <Animated.View
            style={[
              estilos.barraRelleno,
              {
                width: anchoAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
                backgroundColor: categoria.color,
              },
            ]}
          />
        </View>
      </View>
      {/* Monto + % */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={estilos.catMonto}>{formatMXN(total)}</Text>
        <Text style={estilos.catPct}>{Math.round(pct)}%</Text>
      </View>
    </View>
  );
}

// ─── COMPONENTE: GASTO ITEM ─────────────────────────────────
function GastoItem({ gasto, categoria, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={estilos.gastoRow}>
        {/* Ícono */}
        <View style={[estilos.gastoIcono, { backgroundColor: hexToRgba(categoria.color, 0.18) }]}>
          <Text style={estilos.gastoEmoji}>{categoria.icono}</Text>
        </View>
        {/* Info */}
        <View style={estilos.gastoInfo}>
          <Text style={estilos.gastoDescripcion} numberOfLines={1}>
            {gasto.descripcion || categoria.nombre}
          </Text>
          <View style={estilos.gastoSubRow}>
            <Text style={estilos.gastoCat}>{categoria.nombre}</Text>
            <View style={estilos.gastoDot} />
            <Text style={estilos.gastoFecha}>{formatearFechaGasto(gasto.fecha)}</Text>
          </View>
        </View>
        {/* Monto */}
        <Text style={estilos.gastoMonto}>−{formatMXN(gasto.monto)}</Text>
      </View>
      <View style={estilos.separadorItem} />
    </TouchableOpacity>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Datos
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [iniciales, setIniciales] = useState('?');
  const [gastadoMes, setGastadoMes] = useState(0);
  const [ingresosNetos, setIngresosNetos] = useState(0);
  const [ultimosGastos, setUltimosGastos] = useState([]);
  const [top3Categorias, setTop3Categorias] = useState([]);
  const [infoPeriodo, setInfoPeriodo] = useState({ label: '', rango: '' });
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  // Alertas de presupuesto
  const [alertas, setAlertas] = useState([]);
  const alertasDismissed = useRef(new Set());

  // Toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMensaje, setToastMensaje] = useState('');
  const [toastTipo, setToastTipo] = useState('exito');

  // Modal de voz
  const [modalVozVisible, setModalVozVisible] = useState(false);
  const [guardandoVoz, setGuardandoVoz] = useState(false);

  // Timer para activar voz con long press
  const vozTimerRef = useRef(null);

  // ── Animaciones de entrada ──
  const fadeBalance = useRef(new Animated.Value(0)).current;
  const slideBalance = useRef(new Animated.Value(12)).current;
  const fadeCategorias = useRef(new Animated.Value(0)).current;
  const slideCategorias = useRef(new Animated.Value(12)).current;
  const fadeMovimientos = useRef(new Animated.Value(0)).current;
  const slideMovimientos = useRef(new Animated.Value(12)).current;

  // ── Animación de monto principal ──
  const montoAnim = useRef(new Animated.Value(0)).current;
  const [montoMostrado, setMontoMostrado] = useState(0);

  // ── Animación FAB de voz (pulse ring) ──
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(null);

  useEffect(() => {
    // Iniciar animación pulse del FAB de voz en loop
    pulseAnim.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1.4, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    pulseAnim.current.start();
    return () => pulseAnim.current?.stop();
  }, []);

  const mostrarToast = (mensaje, tipo = 'exito') => {
    setToastMensaje(mensaje);
    setToastTipo(tipo);
    setToastVisible(false);
    setTimeout(() => setToastVisible(true), 50);
  };

  // ── Animaciones de entrada (stagger) ──
  const animarEntrada = () => {
    // Resetear
    fadeBalance.setValue(0);    slideBalance.setValue(12);
    fadeCategorias.setValue(0); slideCategorias.setValue(12);
    fadeMovimientos.setValue(0); slideMovimientos.setValue(12);

    const animar = (fade, slide, delay) =>
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.back(1)), useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 420, delay, easing: Easing.out(Easing.back(1)), useNativeDriver: true }),
      ]);

    Animated.stagger(80, [
      animar(fadeBalance, slideBalance, 0),
      animar(fadeCategorias, slideCategorias, 0),
      animar(fadeMovimientos, slideMovimientos, 0),
    ]).start();
  };

  // ── Animación de monto ──
  const animarMonto = (valor) => {
    montoAnim.setValue(0);
    const listener = montoAnim.addListener(({ value }) => setMontoMostrado(value));
    Animated.timing(montoAnim, {
      toValue: valor,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => montoAnim.removeListener(listener));
  };

  // ── Cargar datos desde Supabase ──
  const cargarDatos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let diaCorte = 1;
      let netoMensual = 0;

      if (user) {
        const { data: perfil } = await supabase
          .from('users')
          .select('nombre, ingreso_mensual, dia_corte, isr, imss, iva, vales_despensa, frecuencia_pago, fondo_ahorro')
          .eq('id', user.id)
          .single();

        const nombre = perfil?.nombre || user.email?.split('@')[0] || 'Usuario';
        setNombreUsuario(nombre);
        setIniciales(nombre.substring(0, 2).toUpperCase());

        const bruto    = perfil?.ingreso_mensual || 0;
        const isr      = perfil?.isr || 0;
        const imss     = perfil?.imss || 0;
        const iva      = perfil?.iva || 0;
        const vales    = perfil?.vales_despensa || 0;
        const fondo    = perfil?.fondo_ahorro || 0;
        const factor   = (perfil?.frecuencia_pago || 'mensual') === 'quincenal' ? 2 : 1;
        netoMensual    = (bruto - isr - imss - iva - fondo + vales) * factor;

        setIngresosNetos(netoMensual);
        diaCorte = perfil?.dia_corte || 1;
      }

      const { inicio, fin } = calcularPeriodo(diaCorte, 0);
      const [anioIni, mesIni, diaIni] = inicio.split('-').map(Number);
      const [anioFin, mesFin, diaFin] = fin.split('-').map(Number);
      const budgetMonth = mesIni;
      const budgetYear  = anioIni;

      let labelPeriodo = `${NOMBRES_MESES[budgetMonth - 1]} ${budgetYear}`;
      if (diaCorte > 1) {
        const mIni = NOMBRES_MESES[mesIni - 1].substring(0, 3);
        const mFin = NOMBRES_MESES[mesFin - 1].substring(0, 3);
        labelPeriodo = `${diaIni} ${mIni} – ${diaFin} ${mFin}`;
      }
      setInfoPeriodo({ label: labelPeriodo });

      const [gastosDelMes, recientes] = await Promise.all([
        obtenerGastosMes(budgetMonth, budgetYear, diaCorte),
        obtenerUltimosGastos(3, inicio, fin),
      ]);

      const totalMes = gastosDelMes.reduce((sum, g) => sum + parseFloat(g.monto), 0);
      setGastadoMes(totalMes);
      setUltimosGastos(recientes);

      // Calcular top 3 categorías
      const porCategoria = {};
      for (const g of gastosDelMes) {
        const cid = g.categoria_id;
        porCategoria[cid] = (porCategoria[cid] || 0) + parseFloat(g.monto);
      }
      const top3 = Object.entries(porCategoria)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cid, total]) => ({ categoria: getCategoriaByDbId(Number(cid)), total }));
      setTop3Categorias(top3);

      setCargando(false);
      setRefrescando(false);
      animarEntrada();
      animarMonto(totalMes);

    } catch (error) {
      console.error('Error cargando dashboard:', error);
      setCargando(false);
      setRefrescando(false);
    }
  };

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

  // ── Long press para activar voz ──
  const handleVozPressIn = () => {
    vozTimerRef.current = setTimeout(() => {
      hap.guardar();
      setModalVozVisible(true);
    }, 500);
  };

  const handleVozPressOut = () => {
    if (vozTimerRef.current) {
      clearTimeout(vozTimerRef.current);
      vozTimerRef.current = null;
    }
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
      mostrarToast(`Guardado: $${datos.monto} en ${datos.categoria?.nombre}`);
    } catch (error) {
      console.error('Error guardando gasto por voz:', error);
      mostrarToast('No se pudo guardar el gasto.', 'error');
    } finally {
      setGuardandoVoz(false);
    }
  };

  // Separar centavos para efecto visual en el balance
  const balanceStr = formatMXN(Math.round(montoMostrado));

  return (
    <View style={estilos.contenedor}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <Toast visible={toastVisible} mensaje={toastMensaje} tipo={toastTipo} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[estilos.scroll, { paddingTop: insets.top + 12 }]}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >

        {/* ── HEADER ── */}
        <View style={estilos.header}>
          {/* Avatar + gradiente */}
          <LinearGradient
            colors={['#6C63FF', '#A78BFA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={estilos.avatar}
          >
            <Text style={estilos.avatarTexto}>{iniciales}</Text>
          </LinearGradient>

          {/* Saludo */}
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={estilos.saludoTexto}>{saludo()}</Text>
            <Text style={estilos.nombreTexto} numberOfLines={1}>{nombreUsuario}</Text>
          </View>

          {/* Botones derecha */}
          <TouchableOpacity style={estilos.iconBtn} onPress={() => {}}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={estilos.iconBtn} onPress={() => router.push('/(tabs)/perfil')}>
            <Ionicons name="settings-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── BALANCE CARD HERO ── */}
        <Animated.View
          style={[
            estilos.balanceCardWrap,
            { opacity: fadeBalance, transform: [{ translateY: slideBalance }] },
          ]}
        >
          <LinearGradient
            colors={['#6C63FF', '#4B3FCC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={estilos.balanceCard}
          >
            {/* Círculo decorativo */}
            <View style={estilos.circuloDecorativo} />

            {/* Row: label + pill periodo */}
            <View style={estilos.balanceRow1}>
              <Text style={estilos.balanceLabel}>BALANCE DISPONIBLE</Text>
              <View style={estilos.periodoChip}>
                <Text style={estilos.periodoChipTexto}>{infoPeriodo.label}</Text>
              </View>
            </View>

            {/* Monto principal */}
            {cargando ? (
              <ActivityIndicator color="rgba(255,255,255,0.8)" style={{ marginVertical: 14 }} />
            ) : (
              <Text style={estilos.balanceMonto}>{balanceStr}</Text>
            )}

            {/* Separador */}
            <View style={estilos.balanceSeparador} />

            {/* Sub-métricas: Ingresos + Gastos */}
            <View style={estilos.balanceSubRow}>
              <View style={{ flex: 1 }}>
                <Text style={estilos.subLabel}>INGRESOS</Text>
                <Text style={[estilos.subMonto, { color: '#A0FFD6' }]}>
                  {formatMXN(ingresosNetos)}
                </Text>
              </View>
              <View style={estilos.subSeparador} />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={estilos.subLabel}>GASTOS</Text>
                <Text style={estilos.subMonto}>{formatMXN(gastadoMes)}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── ALERTAS DE PRESUPUESTO ── */}
        {alertas.length > 0 && (
          <AlertaPresupuesto alertas={alertas} onDismiss={handleDismissAlerta} />
        )}

        {/* ── SECCIÓN: GASTOS DEL MES ── */}
        <Animated.View
          style={[
            estilos.seccion,
            { opacity: fadeCategorias, transform: [{ translateY: slideCategorias }] },
          ]}
        >
          <View style={estilos.seccionHeader}>
            <Text style={estilos.seccionTitulo}>Gastos del mes</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/gastos')}>
              <Text style={estilos.verTodo}>Ver todo →</Text>
            </TouchableOpacity>
          </View>

          {cargando ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : top3Categorias.length === 0 ? (
            <View style={estilos.estadoVacio}>
              <Text style={estilos.vacioEmoji}>💸</Text>
              <Text style={estilos.vacioTexto}>Sin gastos este mes</Text>
            </View>
          ) : (
            top3Categorias.map((item, i) => (
              <BarraCategoria
                key={item.categoria.id}
                categoria={item.categoria}
                total={item.total}
                totalMes={gastadoMes}
                delay={i * 100}
              />
            ))
          )}
        </Animated.View>

        {/* ── SECCIÓN: ÚLTIMOS MOVIMIENTOS ── */}
        <Animated.View
          style={[
            estilos.seccion,
            { opacity: fadeMovimientos, transform: [{ translateY: slideMovimientos }] },
          ]}
        >
          <View style={estilos.seccionHeader}>
            <Text style={estilos.seccionTitulo}>Últimos movimientos</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/gastos')}>
              <Text style={estilos.verTodo}>Ver todo →</Text>
            </TouchableOpacity>
          </View>

          {cargando ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : ultimosGastos.length === 0 ? (
            <View style={estilos.estadoVacio}>
              <Text style={estilos.vacioEmoji}>📋</Text>
              <Text style={estilos.vacioTexto}>No hay movimientos recientes</Text>
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
        </Animated.View>

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* ── FAB DE VOZ FLOTANTE ── */}
      <View style={[estilos.fabVozWrap, { bottom: insets.bottom + 90 }]}>
        {/* Anillo de pulse */}
        <Animated.View
          style={[
            estilos.fabVozAnillo,
            { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
          ]}
          pointerEvents="none"
        />
        <Pressable
          onPressIn={handleVozPressIn}
          onPressOut={handleVozPressOut}
          style={estilos.fabVozBoton}
        >
          <Ionicons name="mic-outline" size={22} color={COLORS.primary} />
        </Pressable>
        <Text style={estilos.fabVozLabel}>mantén presionado</Text>
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
              style={{ alignItems: 'center', paddingVertical: 8 }}
            >
              <View style={estilos.modalHandle} />
            </Pressable>
            <Text style={estilos.modalTitulo}>Registrar por voz</Text>
            <Text style={estilos.modalSubtitulo}>"Gasté 150 pesos en tacos hoy"</Text>

            <View style={{ marginBottom: 20, alignItems: 'center' }}>
              {guardandoVoz ? (
                <View style={{ alignItems: 'center', gap: 12 }}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>Analizando y guardando...</Text>
                </View>
              ) : (
                <BotonVoz onResultado={handleResultadoVoz} tamaño="grande" />
              )}
            </View>

            {!guardandoVoz && (
              <TouchableOpacity
                style={{ paddingVertical: 10, alignItems: 'center' }}
                onPress={() => setModalVozVisible(false)}
              >
                <Text style={{ fontSize: 15, color: COLORS.textSecondary }}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── ESTILOS ─────────────────────────────────────────────────
const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { fontSize: 13, fontWeight: '600', color: COLORS.white },
  saludoTexto: { fontSize: 12, color: COLORS.textSecondary },
  nombreTexto: { fontSize: 17, fontWeight: '600', color: COLORS.textPrimary },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // Balance card
  balanceCardWrap: { marginHorizontal: 20, marginBottom: 20 },
  balanceCard: {
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  circuloDecorativo: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  balanceRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 11,
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  periodoChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  periodoChipTexto: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  balanceMonto: {
    fontSize: 42,
    fontWeight: '300',
    color: COLORS.white,
    marginVertical: 6,
    fontVariant: ['tabular-nums'],
  },
  balanceSeparador: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    marginTop: 16,
    marginBottom: 16,
  },
  balanceSubRow: { flexDirection: 'row', alignItems: 'center' },
  subSeparador: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.12)' },
  subLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  subMonto: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
    fontVariant: ['tabular-nums'],
  },

  // Secciones
  seccion: { paddingHorizontal: 20, marginBottom: 24 },
  seccionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seccionTitulo: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  verTodo: { fontSize: 13, color: COLORS.textSecondary },

  // Fila de categoría con barra
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    marginBottom: 8,
  },
  catIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catEmoji: { fontSize: 18 },
  catInfo: { flex: 1, paddingHorizontal: 12 },
  catNombre: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary, marginBottom: 4 },
  barraBg: { height: 4, borderRadius: 2, backgroundColor: COLORS.border, overflow: 'hidden' },
  barraRelleno: { height: '100%', borderRadius: 2 },
  catMonto: { fontSize: 13, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  catPct: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  // Fila de gasto reciente
  gastoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: 0,
  },
  gastoIcono: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gastoEmoji: { fontSize: 20 },
  gastoInfo: { flex: 1, paddingHorizontal: 12 },
  gastoDescripcion: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary, marginBottom: 2 },
  gastoSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gastoCat: { fontSize: 12, color: COLORS.textSecondary },
  gastoDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.textMuted },
  gastoFecha: { fontSize: 12, color: COLORS.textSecondary },
  gastoMonto: { fontSize: 14, color: COLORS.coral, fontVariant: ['tabular-nums'] },
  separadorItem: { height: 0.5, backgroundColor: COLORS.border },

  // Estado vacío
  estadoVacio: { alignItems: 'center', paddingVertical: 32 },
  vacioEmoji: { fontSize: 36, marginBottom: 8 },
  vacioTexto: { fontSize: 14, color: COLORS.textSecondary },

  // FAB de voz
  fabVozWrap: {
    position: 'absolute',
    right: 20,
    alignItems: 'center',
    zIndex: 80,
  },
  fabVozAnillo: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(108,99,255,0.2)',
  },
  fabVozBoton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(108,99,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(108,99,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabVozLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 0.9,
    marginTop: 4,
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
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginBottom: 16,
  },
  modalTitulo: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  modalSubtitulo: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 28 },
});
