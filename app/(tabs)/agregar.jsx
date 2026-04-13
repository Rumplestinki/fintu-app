// Agregar gasto — placeholder
import { View, Text, StyleSheet } from 'react-native'
import { COLORS } from '../../constants/colors'

export default function Agregar() {
  return (
    <View style={styles.contenedor}>
      <Text style={styles.texto}>➕ Agregar gasto</Text>
      <Text style={styles.subtexto}>Aquí vas a registrar tus gastos</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORS.fondo, justifyContent: 'center', alignItems: 'center' },
  texto: { fontSize: 24, color: COLORS.texto, fontWeight: '700' },
  subtexto: { fontSize: 14, color: COLORS.textoSecundario, marginTop: 8 },
})