// ============================================
// app/test-connection.jsx
// Pantalla TEMPORAL para probar conexión a Supabase
// BORRAR después de confirmar que funciona
// ============================================

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { supabase } from '../../services/supabase';

export default function TestConnection() {
  const [resultado, setResultado] = useState('⏳ Sin probar...');
  const [cargando, setCargando] = useState(false);
  const [categorias, setCategorias] = useState([]);

  const probarConexion = async () => {
    setCargando(true);
    setResultado('⏳ Conectando...');

    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('id');

      if (error) {
        setResultado(`❌ Error: ${error.message}`);
        setCategorias([]);
      } else {
        setResultado(`✅ Conexión exitosa — ${data.length} categorías encontradas`);
        setCategorias(data);
      }
    } catch (err) {
      setResultado(`❌ Error de red: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  // Probar automáticamente al abrir la pantalla
  useEffect(() => {
    probarConexion();
  }, []);

  return (
    <ScrollView style={estilos.contenedor}>
      <Text style={estilos.titulo}>🔌 Test de Conexión Supabase</Text>

      <View style={estilos.resultado}>
        <Text style={estilos.textoResultado}>{resultado}</Text>
      </View>

      <TouchableOpacity
        style={estilos.boton}
        onPress={probarConexion}
        disabled={cargando}
      >
        <Text style={estilos.textoBoton}>
          {cargando ? 'Probando...' : 'Probar de nuevo'}
        </Text>
      </TouchableOpacity>

      {/* Lista de categorías si la conexión fue exitosa */}
      {categorias.length > 0 && (
        <View style={estilos.listaCategorias}>
          <Text style={estilos.subtitulo}>Categorías en la base de datos:</Text>
          {categorias.map((cat) => (
            <View key={cat.id} style={estilos.filaCat}>
              <Text style={estilos.textoCat}>{cat.nombre} — {cat.icono}</Text>
              <View style={[estilos.colorPunto, { backgroundColor: cat.color }]} />
            </View>
          ))}
        </View>
      )}

      {/* Debug de variables de entorno */}
      <View style={estilos.debug}>
        <Text style={estilos.debugTitulo}>Variables de entorno:</Text>
        <Text style={estilos.debugTexto}>
          URL: {process.env.EXPO_PUBLIC_SUPABASE_URL ? '✅ Definida' : '❌ No encontrada'}
        </Text>
        <Text style={estilos.debugTexto}>
          KEY: {process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '✅ Definida' : '❌ No encontrada'}
        </Text>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    padding: 20,
    paddingTop: 60,
  },
  titulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  resultado: {
    backgroundColor: '#16213E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  textoResultado: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
  boton: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  textoBoton: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listaCategorias: {
    backgroundColor: '#16213E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  subtitulo: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  filaCat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0F3460',
  },
  textoCat: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  colorPunto: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  debug: {
    backgroundColor: '#0F3460',
    borderRadius: 12,
    padding: 16,
    marginBottom: 40,
  },
  debugTitulo: {
    color: '#6C63FF',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugTexto: {
    color: '#AAAAAA',
    fontSize: 12,
    marginBottom: 4,
  },
});