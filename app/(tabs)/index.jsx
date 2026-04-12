// ============================================
// app/(tabs)/index.jsx
// Dashboard principal — TEMPORAL con botón de prueba
// ============================================

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function Dashboard() {
  const router = useRouter();

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo}>Fintú 💜</Text>

      {/* BOTÓN TEMPORAL — borrar después de probar Supabase */}
      <TouchableOpacity
        style={estilos.boton}
        onPress={() => router.push('/test-connection')}
      >
        <Text style={estilos.textoBoton}>🔌 Probar conexión Supabase</Text>
      </TouchableOpacity>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  titulo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 40,
  },
  boton: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '100%',
  },
  textoBoton: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});