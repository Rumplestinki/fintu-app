// /components/GastoCard.jsx
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { COLORS } from '../constants/colors';
import { getCategoriaByDbId } from '../constants/categorias';

// ──────────────────────────────────────────
// Formatea número a pesos mexicanos
// ──────────────────────────────────────────
function formatearMonto(monto) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(monto);
}

// ──────────────────────────────────────────
// Tarjeta individual de un gasto
// Usa getCategoriaByDbId igual que el dashboard
// para obtener ícono y color correctos
// ──────────────────────────────────────────
export default function GastoCard({ gasto, onPress, onDelete }) {
  // Buscar la categoría local por su ID numérico
  // igual que lo hace index.jsx con getCategoriaByDbId
  const categoria = getCategoriaByDbId(gasto.categoria_id);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onDelete}
      style={({ pressed }) => [
        styles.tarjeta,
        pressed && styles.tarjetaPresionada,
      ]}
    >
      {/* Ícono de la categoría con color de fondo */}
      <View style={[styles.iconoContenedor, { backgroundColor: categoria.color + '25' }]}>
        <Text style={styles.icono}>{categoria.icono}</Text>
      </View>

      {/* Descripción y nombre de categoría */}
      <View style={styles.info}>
        <Text style={styles.descripcion} numberOfLines={1}>
          {gasto.descripcion || categoria.nombre}
        </Text>
        <Text style={styles.categoriaTexto}>
          {categoria.nombre}
        </Text>
      </View>

      {/* Monto */}
      <Text style={styles.monto}>
        {formatearMonto(gasto.monto)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  tarjetaPresionada: {
    opacity: 0.75,
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
  info: {
    flex: 1,
  },
  descripcion: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  categoriaTexto: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  monto: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});