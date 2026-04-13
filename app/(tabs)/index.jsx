// app/(tabs)/index.jsx
// Dashboard principal de Fintú — conectado a datos reales de Supabase

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { getCategoriaByDbId } from '../../constants/categorias';
import { obtenerPresupuestosMes } from '../../services/presupuestos';
import { obtenerUltimosGastos, obtenerGastosMes } from '../../services/gastos';
import { supabase } from '../../services/supabase';

// ─── HELPERS ──────────────────────────────────────────────

// Formatea número a pesos mexicanos
const formatMXN = (monto) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(monto || 0);

// Convierte fecha ISO a texto legible ("Hoy", "Ayer", "13 abr")
const formatearFechaGasto = (fechaISO) => {
  if (!fechaISO) return '';
  const hoy = new Date();
  const fecha = new Date(fechaISO + 'T12:00:00'); // Evitar problemas de timezone

  const hoyStr = hoy.toISOString().split('T')[0];
  const ayerStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (fechaISO === hoyStr) return 'Hoy';
  if (fechaISO === ayerStr) return 'Ayer';

  const meses = ['ene','feb','mar','abr','may','jun',
                 'jul','ago','sep','oct','nov','dic'];
  return `${fecha.getDate()} ${meses[fecha.getMonth()]}`;
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Estado ──
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [gastadoMes, setGastadoMes] = useState(0);
  const [ultimosGastos, setUltimosGastos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

    // presupuesto viene de Supabase, ingresos siguen fijos por ahora:
    const [presupuestoMes, setPresupuestoMes] = useState(0);
    const [ingresosMes, setIngresosMes] = useState(0);

  // ── Cargar datos desde Supabase ──
  const cargarDatos = async () => {
    try {
      // Obtener nombre del usuario autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Buscar nombre en la tabla users, si no usar el email
        const { data: perfil } = await supabase
          .from('users')
          .select('nombre, ingreso_mensual')
          .eq('id', user.id)
          .single();

        setNombreUsuario(perfil?.nombre || user.email?.split('@')[0] || 'Usuario');
        setIngresosMes(perfil?.ingreso_mensual || 0);
      }

      // Obtener gastos del mes actual
      const ahora = new Date();
      const gastosDelMes = await obtenerGastosMes(
        ahora.getMonth() + 1, // getMonth() retorna 0-11, Supabase espera 1-12
        ahora.getFullYear()
      );

      // Sumar todos los montos del mes
      const totalMes = gastosDelMes.reduce((sum, g) => sum + parseFloat(g.monto), 0);
      setGastadoMes(totalMes);

      // Obtener los 5 gastos más recientes para mostrar en el dashboard
      const recientes = await obtenerUltimosGastos(5);
      setUltimosGastos(recientes);

      // Cargar presupuesto total del mes desde Supabase
      const ahora2 = new Date();
      const presupuestosData = await obtenerPresupuestosMes(ahora2.getMonth() + 1, ahora2.getFullYear());
      const totalPresupuestado = presupuestosData.reduce((sum, p) => sum + parseFloat(p.limite), 0);
      setPresupuestoMes(totalPresupuestado);

    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  // useFocusEffect: se ejecuta cada vez que el usuario regresa a esta pantalla
  // Así cuando guarda un gasto y vuelve, los datos se actualizan automáticamente
  useFocusEffect(
    useCallback(() => {
      setCargando(true);
      cargarDatos();
    }, [])
  );

  // Jalar hacia abajo para refrescar
  const onRefresh = () => {
    setRefrescando(true);
    cargarDatos();
  };

  // Cálculos del presupuesto
  const porcentajeUsado = presupuestoMes > 0
    ? Math.round((gastadoMes / presupuestoMes) * 100)
    : 0;
  const disponible = ingresosMes - gastadoMes;

  // Mes actual en español con primera letra mayúscula
  const mesActual = new Date().toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  });
  const mesCapitalizado = mesActual.charAt(0).toUpperCase() + mesActual.slice(1);

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <View style={estilos.contenedor}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* ── HEADER FIJO ── */}
      <View style={[estilos.header, { paddingTop: insets.top + 8 }]}>

        <View style={estilos.headerTop}>
          <View>
            <Text style={estilos.saludo}>
              Hola, {nombreUsuario} 👋
            </Text>
            <Text style={estilos.fechaMes}>{mesCapitalizado}</Text>
          </View>

          <TouchableOpacity
            style={estilos.avatar}
            onPress={() => router.push('/(tabs)/perfil')}
          >
            <Text style={estilos.avatarTexto}>
              {nombreUsuario.charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Balance del mes */}
        <Text style={estilos.etiquetaBalance}>Gastado este mes</Text>

        {cargando ? (
          <ActivityIndicator color="#fff" style={{ marginVertical: 12 }} />
        ) : (
          <>
            <Text style={estilos.montoBalance}>{formatMXN(gastadoMes)}</Text>
            <Text style={estilos.subBalance}>
              de {formatMXN(presupuestoMes)} presupuestados
            </Text>
          </>
        )}

        {/* Barra de progreso del presupuesto */}
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
        <Text style={estilos.porcentajeTexto}>
          {porcentajeUsado}% del presupuesto
        </Text>
      </View>

      {/* ── CONTENIDO CON SCROLL ── */}
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
        {/* Tarjetas: Ingresos y Disponible */}
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
            // Estado vacío — cuando no hay gastos aún
            <View style={estilos.estadoVacio}>
              <Text style={estilos.estadoVacioEmoji}>💸</Text>
              <Text style={estilos.estadoVacioTitulo}>Sin gastos este mes</Text>
              <Text style={estilos.estadoVacioSub}>
                Toca "+ Agregar gasto" para registrar tu primer gasto
              </Text>
            </View>
          ) : (
            ultimosGastos.map((gasto) => {
              // Buscar la categoría por su dbId numérico
              const categoria = getCategoriaByDbId(gasto.categoria_id);
              return (
                <GastoItem
                  key={gasto.id}
                  gasto={gasto}
                  categoria={categoria}
                />
              );
            })
          )}
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ── BOTÓN FLOTANTE ── */}
      <View style={[estilos.botonContenedor, { bottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={estilos.botonAgregar}
          onPress={() => router.push('/(tabs)/agregar')}
          activeOpacity={0.85}
        >
          <Text style={estilos.botonTexto}>+ Agregar gasto</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Componente: una fila de gasto ────────────────────────

function GastoItem({ gasto, categoria }) {
  return (
    <View style={estilos.gastoItem}>
      {/* Ícono con color de fondo de la categoría */}
      <View style={[estilos.gastoIcono, { backgroundColor: categoria.color + '25' }]}>
        <Text style={estilos.gastoEmoji}>{categoria.icono}</Text>
      </View>

      {/* Descripción y fecha */}
      <View style={estilos.gastoInfo}>
        <Text style={estilos.gastoDescripcion} numberOfLines={1}>
          {gasto.descripcion || categoria.nombre}
        </Text>
        <Text style={estilos.gastoFecha}>
          {formatearFechaGasto(gasto.fecha)}
        </Text>
      </View>

      {/* Monto */}
      <Text style={estilos.gastoMonto}>
        -{formatMXN(gasto.monto)}
      </Text>
    </View>
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

  // Header púrpura
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  saludo: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  fechaMes: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  etiquetaBalance: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  montoBalance: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  subBalance: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  barraBg: {
    marginTop: 14,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barraRelleno: {
    height: '100%',
    borderRadius: 3,
  },
  porcentajeTexto: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
    textAlign: 'right',
  },

  // Secciones
  seccion: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  seccionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seccionTitulo: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  verTodos: {
    fontSize: 12,
    color: COLORS.primary,
  },

  // Tarjetas mini
  tarjetasGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  tarjetaMini: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
  },
  tarjetaMiniLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  tarjetaMiniMonto: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  // Filas de gastos
  gastoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  gastoIcono: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gastoEmoji: {
    fontSize: 18,
  },
  gastoInfo: {
    flex: 1,
  },
  gastoDescripcion: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  gastoFecha: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  gastoMonto: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.error,
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
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  estadoVacioSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // Botón flotante
  botonContenedor: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  botonAgregar: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  botonTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});