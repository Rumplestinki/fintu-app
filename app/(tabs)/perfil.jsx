// Perfil de usuario — placeholder con botón de logout para probar
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { COLORS } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'

export default function Perfil() {
  const { logout, usuario } = useAuth()

  return (
    <View style={styles.contenedor}>
      <Text style={styles.texto}>👤 Perfil</Text>
      <Text style={styles.email}>{usuario?.email}</Text>

      {/* Botón temporal de logout para probar el flujo */}
      <TouchableOpacity style={styles.boton} onPress={logout}>
        <Text style={styles.botonTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORS.fondo, justifyContent: 'center', alignItems: 'center', gap: 16 },
  texto: { fontSize: 24, color: COLORS.texto, fontWeight: '700' },
  email: { fontSize: 14, color: COLORS.textoSecundario },
  boton: { backgroundColor: COLORS.error, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 16 },
  botonTexto: { color: '#fff', fontWeight: '700' },
})