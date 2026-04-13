// Historial de gastos — placeholder
import { View, Text, StyleSheet } from 'react-native'
import { COLORS } from '../../constants/colors'

export default function Gastos() {
  return (
    <View style={styles.contenedor}>
      <Text style={styles.texto}>📋 Gastos</Text>
      <Text style={styles.subtexto}>Aquí va tu historial</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORS.fondo, justifyContent: 'center', alignItems: 'center' },
  texto: { fontSize: 24, color: COLORS.texto, fontWeight: '700' },
  subtexto: { fontSize: 14, color: COLORS.textoSecundario, marginTop: 8 },
})