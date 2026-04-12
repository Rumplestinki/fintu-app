import { View, Text, StyleSheet } from 'react-native';

// Pantalla principal del dashboard — placeholder inicial
export default function Dashboard() {
  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>💜 Fintú</Text>
      <Text style={styles.subtitulo}>Tus finanzas contigo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#0F0F1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginBottom: 8,
  },
  subtitulo: {
    fontSize: 16,
    color: '#AAAAAA',
  },
});