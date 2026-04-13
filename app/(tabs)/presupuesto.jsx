// Presupuestos — placeholder
import { View, Text, StyleSheet } from 'react-native'
import { COLORS } from '../../constants/colors'

export default function Presupuesto() {
  return (
    <View style={styles.contenedor}>
      <Text style={styles.texto}>🎯 Presupuesto</Text>
      <Text style={styles.subtexto}>Aquí van tus límites por categoría</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORS.fondo, justifyContent: 'center', alignItems: 'center' },
  texto: { fontSize: 24, color: COLORS.texto, fontWeight: '700' },
  subtexto: { fontSize: 14, color: COLORS.textoSecundario, marginTop: 8 },
})