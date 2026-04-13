// Dashboard principal de Fintú
// Pantalla de inicio con balance, movimientos recientes y acceso rápido
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants/colors'
import { CATEGORIAS, getCategoriaById } from '../../constants/categorias'

// ─── Datos de prueba ─────────────────────────────────────────────────────────
// TODO: reemplazar con datos reales de Supabase en el siguiente paso
const USUARIO_PRUEBA = {
  nombre: 'Enrique',
}

const RESUMEN_PRUEBA = {
  gastadoMes: 8450.0,
  presupuestoMes: 12000.0,
  ingresosMes: 15000.0,
}

const GASTOS_RECIENTES = [
  {
    id: '1',
    descripcion: 'Tacos de canasta',
    categoria_id: 1, // Comida
    monto: 185,
    fecha: 'Hoy, 1:30 pm',
  },
  {
    id: '2',
    descripcion: 'Metro + Metrobús',
    categoria_id: 2, // Transporte
    monto: 45,
    fecha: 'Ayer, 8:15 am',
  },
  {
    id: '3',
    descripcion: 'Farmacia',
    categoria_id: 5, // Salud
    monto: 320,
    fecha: 'Ayer, 11:00 am',
  },
  {
    id: '4',
    descripcion: 'Netflix',
    categoria_id: 8, // Suscripciones
    monto: 219,
    fecha: '10 abr, 9:00 am',
  },
  {
    id: '5',
    descripcion: 'Uber',
    categoria_id: 2, // Transporte
    monto: 128,
    fecha: '9 abr, 7:45 pm',
  },
]
// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()

  // Calcular porcentaje del presupuesto usado
  const porcentajeUsado = Math.round(
    (RESUMEN_PRUEBA.gastadoMes / RESUMEN_PRUEBA.presupuestoMes) * 100
  )
  const disponible = RESUMEN_PRUEBA.ingresosMes - RESUMEN_PRUEBA.gastadoMes

  // Formatear número a pesos mexicanos
  const formatMXN = (monto) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
    }).format(monto)

  // Mes actual en español
  const mesActual = new Date().toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  })
  // Primera letra mayúscula
  const mesCapitalizado =
    mesActual.charAt(0).toUpperCase() + mesActual.slice(1)

  return (
    <SafeAreaView style={estilos.contenedor}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primario} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={estilos.scroll}
      >
        {/* ── HEADER + BALANCE ─────────────────────────── */}
        <View style={estilos.header}>
          {/* Saludo y fecha */}
          <View style={estilos.headerTop}>
            <View>
              <Text style={estilos.saludo}>
                Hola, {USUARIO_PRUEBA.nombre} 👋
              </Text>
              <Text style={estilos.fechaMes}>{mesCapitalizado}</Text>
            </View>

            {/* Avatar con iniciales */}
            <TouchableOpacity
              style={estilos.avatar}
              onPress={() => router.push('/(tabs)/perfil')}
            >
              <Text style={estilos.avatarTexto}>
                {USUARIO_PRUEBA.nombre.charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Monto gastado */}
          <Text style={estilos.etiquetaBalance}>Gastado este mes</Text>
          <Text style={estilos.montoBalance}>
            {formatMXN(RESUMEN_PRUEBA.gastadoMes)}
          </Text>
          <Text style={estilos.subBalance}>
            de {formatMXN(RESUMEN_PRUEBA.presupuestoMes)} presupuestados
          </Text>

          {/* Barra de progreso del presupuesto */}
          <View style={estilos.barraBg}>
            <View
              style={[
                estilos.barraRelleno,
                {
                  width: `${Math.min(porcentajeUsado, 100)}%`,
                  // Color rojo si supera el 90%, amarillo si supera el 70%
                  backgroundColor:
                    porcentajeUsado >= 90
                      ? COLORS.peligro
                      : porcentajeUsado >= 70
                      ? COLORS.advertencia
                      : '#ffffff',
                },
              ]}
            />
          </View>
          <Text style={estilos.porcentajeTexto}>
            {porcentajeUsado}% del presupuesto
          </Text>
        </View>

        {/* ── TARJETAS DE RESUMEN ───────────────────────── */}
        <View style={estilos.seccion}>
          <View style={estilos.tarjetasGrid}>
            <View style={estilos.tarjetaMini}>
              <Text style={estilos.tarjetaMiniLabel}>Ingresos</Text>
              <Text style={[estilos.tarjetaMiniMonto, { color: COLORS.exito }]}>
                {formatMXN(RESUMEN_PRUEBA.ingresosMes)}
              </Text>
            </View>
            <View style={estilos.tarjetaMini}>
              <Text style={estilos.tarjetaMiniLabel}>Disponible</Text>
              <Text style={estilos.tarjetaMiniMonto}>
                {formatMXN(disponible)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── ÚLTIMOS MOVIMIENTOS ───────────────────────── */}
        <View style={estilos.seccion}>
          {/* Encabezado de sección */}
          <View style={estilos.seccionHeader}>
            <Text style={estilos.seccionTitulo}>Últimos movimientos</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/gastos')}>
              <Text style={estilos.verTodos}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          {/* Lista de gastos recientes */}
          {GASTOS_RECIENTES.map((gasto) => {
            const categoria = getCategoriaById(gasto.categoria_id)
            return (
              <GastoItem
                key={gasto.id}
                gasto={gasto}
                categoria={categoria}
                formatMXN={formatMXN}
              />
            )
          })}
        </View>

        {/* Espacio extra para que el botón flotante no tape contenido */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── BOTÓN FLOTANTE AGREGAR GASTO ─────────────── */}
      <View style={estilos.botonContenedor}>
        <TouchableOpacity
          style={estilos.botonAgregar}
          onPress={() => router.push('/(tabs)/agregar')}
          activeOpacity={0.85}
        >
          <Text style={estilos.botonTexto}>+ Agregar gasto</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

// ─── Componente interno: tarjeta de un gasto ──────────────────────────────────
function GastoItem({ gasto, categoria, formatMXN }) {
  return (
    <View style={estilos.gastoItem}>
      {/* Ícono de categoría */}
      <View
        style={[
          estilos.gastoIcono,
          { backgroundColor: categoria.colorFondo },
        ]}
      >
        <Text style={estilos.gastoEmoji}>{categoria.emoji}</Text>
      </View>

      {/* Descripción y fecha */}
      <View style={estilos.gastoInfo}>
        <Text style={estilos.gastoDescripcion} numberOfLines={1}>
          {gasto.descripcion}
        </Text>
        <Text style={estilos.gastoFecha}>{gasto.fecha}</Text>
      </View>

      {/* Monto */}
      <Text style={[estilos.gastoMonto, { color: COLORS.peligro }]}>
        -{formatMXN(gasto.monto)}
      </Text>
    </View>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const estilos = StyleSheet.create({
  // Contenedor principal
  contenedor: {
    flex: 1,
    backgroundColor: COLORS.fondo,
  },
  scroll: {
    flexGrow: 1,
  },

  // Header con fondo púrpura
  header: {
    backgroundColor: COLORS.primario,
    paddingHorizontal: 20,
    paddingTop: 16,
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
    fontWeight: '500',
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
    fontWeight: '500',
    color: '#fff',
  },

  // Balance principal
  etiquetaBalance: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  montoBalance: {
    fontSize: 34,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: -0.5,
  },
  subBalance: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },

  // Barra de presupuesto
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

  // Secciones generales
  seccion: {
    paddingHorizontal: 16,
    marginTop: 16,
  },

  // Tarjetas mini (ingresos / disponible)
  tarjetasGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  tarjetaMini: {
    flex: 1,
    backgroundColor: COLORS.fondoTarjeta,
    borderRadius: 12,
    padding: 14,
  },
  tarjetaMiniLabel: {
    fontSize: 11,
    color: COLORS.textoSecundario,
    marginBottom: 4,
  },
  tarjetaMiniMonto: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textoPrimario,
  },

  // Encabezado de sección con "Ver todos"
  seccionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seccionTitulo: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textoPrimario,
  },
  verTodos: {
    fontSize: 12,
    color: COLORS.primario,
  },

  // Tarjeta de cada gasto
  gastoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.fondoTarjeta,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  gastoIcono: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gastoEmoji: {
    fontSize: 16,
  },
  gastoInfo: {
    flex: 1,
  },
  gastoDescripcion: {
    fontSize: 13,
    color: COLORS.textoPrimario,
    marginBottom: 2,
  },
  gastoFecha: {
    fontSize: 11,
    color: COLORS.textoTerciario,
  },
  gastoMonto: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Botón flotante
  botonContenedor: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  botonAgregar: {
    backgroundColor: COLORS.primario,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    // Sombra suave para que flote sobre el contenido
    shadowColor: COLORS.primario,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  botonTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
})