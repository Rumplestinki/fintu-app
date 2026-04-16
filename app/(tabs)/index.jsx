// app/(tabs)/index.jsx
// Dashboard principal de Fintú — con alertas de presupuesto premium in-app

import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { getCategoriaByDbId } from '../../constants/categorias';
import { obtenerPresupuestosMes } from '../../services/presupuestos';
import { obtenerUltimosGastos, obtenerGastosMes, registrarGasto, calcularPeriodo } from '../../services/gastos';
import { supabase } from '../../services/supabase';
import BotonVoz from '../../components/BotonVoz';
import AlertaPresupuesto from '../../components/AlertaPresupuesto';
import { verificarPresupuestos } from '../../services/notificaciones';

// ─── HELPERS ──────────────────────────────────────────────

const formatMXN = (monto) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(monto || 0);

const formatearFechaGasto = (fechaISO) => {
  if (!fechaISO) return '';
  const hoy = new Date();
  const fecha = new Date(fechaISO + 'T12:00:00');
  const hoyStr = hoy.toISOString().split('T')[0];
  const ayerStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (fechaISO === hoyStr) return 'Hoy';
  if (fechaISO === ayerStr) return 'Ayer';
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${fecha.getDate()} ${meses[fecha.getMonth()]}`;
};

const formatearFechaISO = (date) => new Date(date).toISOString().split('T')[0];

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ─── COMPONENTE TOAST ─────────────────────────────────────
import React from 'react';

function Toast({ visible, mensaje, tipo = 'exito' }) {
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[
      estilos.toast,
      tipo === 'exito' ? estilos.toastExito : estilos.toastError,
      { opacity },
    ]}>
      <Text style={estilos.toastEmoji}>{tipo === 'exito' ? '✅' : '❌'}</Text>
      <Text style={estilos.toastTexto} numberOfLines={2}>{mensaje}</Text>
    </Animated.View>
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
  const [ingresosMes, setIngresosMes] = useState(0);
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
 
      // Leer perfil: ahora también traemos dia_corte
      let diaCorte = 1;
      if (user) {
        const { data: perfil } = await supabase
          .from('users')
          .select('nombre, ingreso_mensual, dia_corte')
          .eq('id', user.id)
          .single();
 
        setNombreUsuario(perfil?.nombre || user.email?.split('@')[0] || 'Usuario');
        setIngresosMes(perfil?.ingreso_mensual || 0);
 
        // Guardar día de corte para calcular el periodo correcto
        diaCorte = perfil?.dia_corte || 1;
      }
 
      // Calcular el periodo actual basado en el día de corte
      const { inicio, fin } = calcularPeriodo(diaCorte, 0);
      const [anioIni, mesIni, diaIni] = inicio.split('-').map(Number);
      const [anioFin, mesFin, diaFin] = fin.split('-').map(Number);

      // El mes y año del presupuesto deben corresponder al INICIO del periodo
      const budgetMonth = mesIni;
      const budgetYear = anioIni;

      // Actualizar info del periodo para el header
      let labelPeriodo = `${NOMBRES_MESES[budgetMonth - 1]} ${budgetYear}`;
      let rangoPeriodo = '';
      if (diaCorte > 1) {
        const mesFinCorto = NOMBRES_MESES[mesFin - 1].substring(0, 3);
        const mesIniCorto = NOMBRES_MESES[mesIni - 1].substring(0, 3);
        rangoPeriodo = `${diaIni} ${mesIniCorto} – ${diaFin} ${mesFinCorto}`;
      }
      setInfoPeriodo({ label: labelPeriodo, rango: rangoPeriodo });
 
      // Obtener gastos del periodo
      const gastosDelMes = await obtenerGastosMes(budgetMonth, budgetYear, diaCorte);
      const totalMes = gastosDelMes.reduce((sum, g) => sum + parseFloat(g.monto), 0);
      setGastadoMes(totalMes);
 
      const recientes = await obtenerUltimosGastos(5);
      setUltimosGastos(recientes);
 
      // Obtener presupuestos usando el mes/año de inicio del periodo
      const presupuestosData = await obtenerPresupuestosMes(budgetMonth, budgetYear);
      const totalPresupuestado = presupuestosData.reduce(
        (sum, p) => sum + parseFloat(p.limite), 0
      );
      setPresupuestoMes(totalPresupuestado);
 
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  // ── Revisar alertas de presupuesto ──
  const actualizarAlertas = async () => {
    const nuevasAlertas = await verificarPresupuestos();
    // Filtrar las que el usuario ya cerró en esta sesión
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
    setRefrescando(true);
    cargarDatos();
    actualizarAlertas();
  };

  // Cerrar una alerta (persiste solo durante la sesión)
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
        fecha: datos.fecha || formatearFechaISO(new Date()),
        origen: 'voz',
      });

      setModalVozVisible(false);
      setGuardandoVoz(false);

      // Recargar datos, revisar alertas y mostrar toast
      cargarDatos();
      actualizarAlertas();

      const desc = datos.descripcion ? ` — ${datos.descripcion}` : '';
      mostrarToast(`🎙️ $${datos.monto} en ${datos.categoria?.nombre || 'Otros'}${desc}`);

    } catch (error) {
      console.error('Error guardando gasto por voz:', error);
      setGuardandoVoz(false);
      mostrarToast('No se pudo guardar el gasto. Intenta de nuevo.', 'error');
    }
  };

  const porcentajeUsado = presupuestoMes > 0 ? Math.round((gastadoMes / presupuestoMes) * 100) : 0;
  const disponible = ingresosMes - gastadoMes;

  return (
    <View style={estilos.contenedor}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Toast flotante */}
      <Toast visible={toastVisible} mensaje={toastMensaje} tipo={toastTipo} />

      {/* ── HEADER ── */}
      <View style={[estilos.header, { paddingTop: insets.top + 8 }]}>
        <View style={estilos.headerTop}>
          <View>
            <Text style={estilos.saludo}>Hola, {nombreUsuario} 👋</Text>
            <View style={estilos.periodoContenedor}>
              <Text style={estilos.fechaMes}>{infoPeriodo.label}</Text>
              {infoPeriodo.rango !== '' && (
                <Text style={estilos.rangoPeriodo}>{infoPeriodo.rango}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={estilos.avatar}
            onPress={() => router.push('/(tabs)/perfil')}
          >
            <Text style={estilos.avatarTexto}>{nombreUsuario.charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        <Text style={estilos.etiquetaBalance}>Gastado este mes</Text>
        {cargando ? (
          <ActivityIndicator color="#fff" style={{ marginVertical: 12 }} />
        ) : (
          <>
            <Text style={estilos.montoBalance}>{formatMXN(gastadoMes)}</Text>
            <Text style={estilos.subBalance}>de {formatMXN(presupuestoMes)} presupuestados</Text>
          </>
        )}

        <View style={estilos.barraBg}>
          <View
            style={[
              estilos.barraRelleno,
              {
                width: `${Math.min(porcentajeUsado, 100)}%`,
                backgroundColor:
                  porcentajeUsado >= 90 ? COLORS.error
                  : porcentajeUsado >= 70 ? COLORS.warning
                  : '#ffffff',
              },
            ]}
          />
        </View>
        <Text style={estilos.porcentajeTexto}>{porcentajeUsado}% del presupuesto</Text>
      </View>

      {/* ── SCROLL ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={estilos.scroll}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Tarjetas de ingresos y disponible */}
        <View style={estilos.seccion}>
          <View style={estilos.tarjetasGrid}>
            <View style={estilos.tarjetaMini}>
              <Text style={estilos.tarjetaMiniLabel}>Ingresos</Text>
              <Text style={[estilos.tarjetaMiniMonto, { color: COLORS.success }]}>
                {formatMXN(ingresosMes)}
              </Text>
            </View>
            <View style={estilos.tarjetaMini}>
              <Text style={estilos.tarjetaMiniLabel}>Disponible</Text>
              <Text style={[
                estilos.tarjetaMiniMonto,
                { color: disponible < 0 ? COLORS.error : COLORS.textPrimary }
              ]}>
                {formatMXN(disponible)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── ALERTAS DE PRESUPUESTO — aparecen solo si hay categorías en riesgo ── */}
        {alertas.length > 0 && (
          <AlertaPresupuesto
            alertas={alertas}
            onDismiss={handleDismissAlerta}
          />
        )}

        {/* Últimos movimientos */}
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
              <Text style={estilos.estadoVacioSub}>
                Toca "+ Agregar gasto" para registrar tu primer gasto
              </Text>
            </View>
          ) : (
            ultimosGastos.map((gasto) => {
              const categoria = getCategoriaByDbId(gasto.categoria_id);
              return <GastoItem key={gasto.id} gasto={gasto} categoria={categoria} />;
            })
          )}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── BOTONES FLOTANTES ── */}
      <View style={[estilos.botonesFlotantes, { bottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={estilos.botonAgregar}
          onPress={() => router.push('/(tabs)/agregar')}
          activeOpacity={0.85}
        >
          <Text style={estilos.botonTexto}>+ Agregar gasto</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={estilos.btnVozFlotante}
          onPress={() => setModalVozVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={estilos.btnVozEmoji}>🎙️</Text>
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
            <View style={estilos.modalHandle} />
            <Text style={estilos.modalTitulo}>Registrar por voz</Text>
            <Text style={estilos.modalSubtitulo}>
              Di algo como: "gasté 150 pesos en tacos"
            </Text>

            <View style={estilos.modalBotonVoz}>
              {guardandoVoz ? (
                <View style={estilos.guardandoContenedor}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={estilos.guardandoTexto}>Guardando gasto…</Text>
                </View>
              ) : (
                <BotonVoz onResultado={handleResultadoVoz} tamaño="grande" />
              )}
            </View>

            <View style={estilos.ejemplos}>
              <Text style={estilos.ejemplosTitulo}>Ejemplos:</Text>
              <Text style={estilos.ejemploTexto}>"Gasté 80 pesos en el Oxxo"</Text>
              <Text style={estilos.ejemploTexto}>"Ayer pagué 150 de Uber"</Text>
              <Text style={estilos.ejemploTexto}>"El 10 gasté 500 en el super"</Text>
              <Text style={estilos.ejemploTexto}>"Compré tenis Nike el martes en 1200"</Text>
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

// ─── Componente fila de gasto ──────────────────────────────
function GastoItem({ gasto, categoria }) {
  return (
    <View style={estilos.gastoItem}>
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
    </View>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────
const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1 },

  toast: {
    position: 'absolute',
    top: 60, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingVertical: 14, paddingHorizontal: 18,
    borderRadius: 14, zIndex: 999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 10,
  },
  toastExito: { backgroundColor: '#1A2A1A', borderWidth: 1, borderColor: COLORS.success },
  toastError: { backgroundColor: '#2A1A1A', borderWidth: 1, borderColor: COLORS.error },
  toastEmoji: { fontSize: 18 },
  toastTexto: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '500', flex: 1 },

  header: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingBottom: 28 },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  saludo: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
  periodoContenedor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fechaMes: { fontSize: 17, fontWeight: '600', color: '#fff' },
  rangoPeriodo: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTexto: { fontSize: 16, fontWeight: '600', color: '#fff' },
  etiquetaBalance: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  montoBalance: { fontSize: 34, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  subBalance: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  barraBg: {
    marginTop: 14, height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3, overflow: 'hidden',
  },
  barraRelleno: { height: '100%', borderRadius: 3 },
  porcentajeTexto: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6, textAlign: 'right' },

  seccion: { paddingHorizontal: 16, marginTop: 16 },
  seccionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  seccionTitulo: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  verTodos: { fontSize: 12, color: COLORS.primary },

  tarjetasGrid: { flexDirection: 'row', gap: 10 },
  tarjetaMini: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 14 },
  tarjetaMiniLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  tarjetaMiniMonto: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },

  gastoItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 12, marginBottom: 8, gap: 12,
  },
  gastoIcono: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gastoEmoji: { fontSize: 18 },
  gastoInfo: { flex: 1 },
  gastoDescripcion: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary, marginBottom: 2 },
  gastoFecha: { fontSize: 11, color: COLORS.textSecondary },
  gastoMonto: { fontSize: 13, fontWeight: '600', color: COLORS.error },

  estadoVacio: { alignItems: 'center', paddingVertical: 40 },
  estadoVacioEmoji: { fontSize: 40, marginBottom: 12 },
  estadoVacioTitulo: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  estadoVacioSub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 20 },

  botonesFlotantes: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', gap: 12, alignItems: 'center',
  },
  botonAgregar: {
    flex: 1, backgroundColor: COLORS.primary,
    borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  botonTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnVozFlotante: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  btnVozEmoji: { fontSize: 24 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContenido: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 48, alignItems: 'center',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, marginBottom: 16 },
  modalTitulo: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  modalSubtitulo: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 28 },
  modalBotonVoz: { marginBottom: 28, alignItems: 'center' },
  guardandoContenedor: { alignItems: 'center', gap: 12 },
  guardandoTexto: { fontSize: 14, color: COLORS.textSecondary },
  ejemplos: {
    width: '100%', backgroundColor: COLORS.surfaceLight,
    borderRadius: 12, padding: 14, marginBottom: 16, gap: 4,
  },
  ejemplosTitulo: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 4 },
  ejemploTexto: { fontSize: 13, color: COLORS.textPrimary, fontStyle: 'italic' },
  btnCancelarModal: { paddingVertical: 10, paddingHorizontal: 32 },
  btnCancelarTexto: { fontSize: 15, color: COLORS.textSecondary },
});
