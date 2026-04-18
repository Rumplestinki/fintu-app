// app/(tabs)/index.jsx
// Dashboard principal de Fintú — Registro por voz instantáneo y cálculo de neto real

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
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
    // Detener animación anterior antes de iniciar una nueva
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

    return () => {
      animValue.removeListener(idListener);
    };
  }, [valorFinal]);

  return conteo;
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

  // Estados para disparar animaciones
  const [gastadoAnimado, setGastadoAnimado] = useState(0);
  const [ingresosAnimado, setIngresosAnimado] = useState(0);

  // Valores animados de UI
  const opacityAnim = useRef(new Animated.Value(0.75)).current;
  const barraAnim = useRef(new Animated.Value(0)).current;

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

      // RENDIMIENTO: parallelizar las 3 queries independientes
      const [gastosDelMes, recientes, presupuestosData] = await Promise.all([
        obtenerGastosMes(budgetMonth, budgetYear, diaCorte),
        obtenerUltimosGastos(5, inicio, fin),
        obtenerPresupuestosMes(budgetMonth, budgetYear),
      ]);

      totalMes = gastosDelMes.reduce((sum, g) => sum + parseFloat(g.monto), 0);
      setGastadoMes(totalMes);
      setUltimosGastos(recientes);

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

  // Disparar animaciones al cargar
  useEffect(() => {
    if (!cargando && gastadoAnimado >= 0) {
      const porcentaje = presupuestoMes > 0 ? Math.round((gastadoAnimado / presupuestoMes) * 100) : 0;

      opacityAnim.setValue(0.75);
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        delay: 1000,
        useNativeDriver: true,
      }).start();

      barraAnim.setValue(0);
      Animated.timing(barraAnim, {
        toValue: Math.min(porcentaje, 100),
        duration: 800,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

      const timer = setTimeout(() => hap.suave(), 1000);
      return () => clearTimeout(timer);
    }
  }, [gastadoAnimado, presupuestoMes, cargando]);

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

  const porcentajeUsado = presupuestoMes > 0 ? Math.round((gastadoMes / presupuestoMes) * 100) : 0;

  // UX: inicial de avatar — mostrar "?" mientras carga
  const inicialAvatar = nombreUsuario ? nombreUsuario.charAt(0).toUpperCase() : '?';

  return (
    <View style={estilos.contenedor}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <Toast visible={toastVisible} mensaje={toastMensaje} tipo={toastTipo} />

      {/* ── HEADER ── */}
      <View style={[estilos.header, { paddingTop: insets.top + 8 }]}>
        <View style={estilos.headerTop}>
          <View>
            <Text style={estilos.saludo}>
              {cargando ? 'Cargando...' : `Hola, ${nombreUsuario} 👋`}
            </Text>
            <View style={estilos.periodoContenedor}>
              <Text style={estilos.fechaMes}>{infoPeriodo.label}</Text>
              {infoPeriodo.rango !== '' && (
                <Text style={estilos.rangoPeriodo}>{infoPeriodo.rango}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity style={estilos.avatar} onPress={() => router.push('/(tabs)/perfil')}>
            <Text style={estilos.avatarTexto}>{inicialAvatar}</Text>
          </TouchableOpacity>
        </View>

        <Text style={estilos.etiquetaBalance}>Gastado este mes</Text>
        {cargando ? <ActivityIndicator color="#fff" style={{ marginVertical: 12 }} /> : (
          <>
            <Animated.Text style={[estilos.montoBalance, { opacity: opacityAnim }]}>
              {formatMXN(gastoContado)}
            </Animated.Text>
            <Text style={estilos.subBalance}>de {formatMXN(presupuestoMes)} presupuestados</Text>
          </>
        )}

        <View style={estilos.barraBg}>
          <Animated.View style={[
            estilos.barraRelleno,
            {
              width: barraAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: porcentajeUsado >= 90 ? COLORS.error : porcentajeUsado >= 70 ? COLORS.warning : '#fff',
            },
          ]} />
        </View>
        <Text style={estilos.porcentajeTexto}>{porcentajeUsado}% del presupuesto</Text>
      </View>

      {/* ── SCROLL ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={estilos.scroll}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={estilos.seccion}>
          <View style={estilos.tarjetasGrid}>
            <View style={estilos.tarjetaMini}>
              <Text style={estilos.tarjetaMiniLabel}>Ingresos Netos</Text>
              <Text style={[estilos.tarjetaMiniMonto, { color: COLORS.success }]}>
                {cargando ? '$---' : formatMXN(ingresosContado)}
              </Text>
            </View>
            <View style={estilos.tarjetaMini}>
              <Text style={estilos.tarjetaMiniLabel}>Disponible</Text>
              <Text style={[
                estilos.tarjetaMiniMonto,
                { color: disponibleCalc < 0 ? COLORS.error : COLORS.textPrimary },
              ]}>
                {cargando ? '$---' : formatMXN(disponibleContado)}
              </Text>
            </View>
          </View>
        </View>

        {alertas.length > 0 && (
          <AlertaPresupuesto alertas={alertas} onDismiss={handleDismissAlerta} />
        )}

        <View style={estilos.seccion}>
          <View style={estilos.seccionHeader}>
            <Text style={estilos.seccionTitulo}>Últimos movimientos</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/gastos')}>
              <Text style={estilos.verTodos}>Ver todos</Text>
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
              <GastoItem key={g.id} gasto={g} categoria={getCategoriaByDbId(g.categoria_id)} />
            ))
          )}
        </View>
        <View style={{ height: 180 }} />
      </ScrollView>

      {/* ── BOTONES FLOTANTES ── */}
      <View style={[estilos.botonesFlotantes, { bottom: insets.bottom + 95 }]}>
        <BotonFintu
          label="+ Agregar gasto"
          onPress={() => router.push('/(tabs)/agregar')}
          estilo={{ flex: 1 }}
        />
        <TouchableOpacity
          style={estilos.btnVozFlotante}
          onPress={() => { hap.guardar(); setModalVozVisible(true); }}
        >
          <Ionicons name="mic" size={24} color={COLORS.primary} />
        </TouchableOpacity>
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
                  <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>Analizando y guardando...</Text>
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

function GastoItem({ gasto, categoria }) {
  return (
    <TouchableOpacity
      style={estilos.gastoItem}
      onPress={() => hap.suave()}
      activeOpacity={0.7}
    >
      <View style={[estilos.gastoIcono, { backgroundColor: categoria.color + '25' }]}>
        <Text style={estilos.gastoEmoji}>{categoria.icono}</Text>
      </View>
      <View style={estilos.gastoInfo}>
        <Text style={estilos.gastoDescripcion} numberOfLines={1}>
          {gasto.descripcion || categoria.nombre}
        </Text>
        <Text style={estilos.gastoFecha}>{formatearFechaGasto(gasto.fecha)}</Text>
      </View>
      <Text style={estilos.gastoMonto}>-{formatMXN(gasto.monto)}</Text>
    </TouchableOpacity>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1 },
  header: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingBottom: 28 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  saludo: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
  periodoContenedor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fechaMes: { fontSize: 17, fontWeight: '600', color: '#fff' },
  rangoPeriodo: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontSize: 16, fontWeight: '600', color: '#fff' },
  etiquetaBalance: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  montoBalance: { fontSize: 34, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  subBalance: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  barraBg: { marginTop: 14, height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  barraRelleno: { height: '100%', borderRadius: 3 },
  porcentajeTexto: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6, textAlign: 'right' },
  seccion: { paddingHorizontal: 16, marginTop: 16 },
  seccionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seccionTitulo: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  verTodos: { fontSize: 12, color: COLORS.primary },
  tarjetasGrid: { flexDirection: 'row', gap: 10 },
  tarjetaMini: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 14 },
  tarjetaMiniLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  tarjetaMiniMonto: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  gastoItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, marginBottom: 8, gap: 12 },
  gastoIcono: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gastoEmoji: { fontSize: 18 },
  gastoInfo: { flex: 1 },
  gastoDescripcion: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary, marginBottom: 2 },
  gastoFecha: { fontSize: 11, color: COLORS.textSecondary },
  gastoMonto: { fontSize: 13, fontWeight: '600', color: COLORS.error },
  estadoVacio: { alignItems: 'center', paddingVertical: 40 },
  estadoVacioEmoji: { fontSize: 40, marginBottom: 12 },
  estadoVacioTitulo: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  botonesFlotantes: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  btnVozFlotante: { width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContenido: { backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48, alignItems: 'center' },
  modalHandleContenedor: { paddingVertical: 8, paddingHorizontal: 40, alignItems: 'center' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, marginBottom: 16 },
  modalTitulo: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  modalSubtitulo: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 28 },
  modalBotonVoz: { marginBottom: 20, alignItems: 'center' },
  btnCancelarModal: { paddingVertical: 10, paddingHorizontal: 32 },
  btnCancelarTexto: { fontSize: 15, color: COLORS.textSecondary },
});
