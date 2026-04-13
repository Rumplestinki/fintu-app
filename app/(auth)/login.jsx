// Pantalla de login — entrada principal a Fintú
import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ActivityIndicator
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../hooks/useAuth'
import { COLORS } from '../../constants/colors'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  async function handleLogin() {
    // Validación básica antes de llamar a Supabase
    if (!email || !password) {
      Alert.alert('Campos vacíos', 'Por favor ingresa tu email y contraseña.')
      return
    }

    setCargando(true)
    try {
      await login(email.trim().toLowerCase(), password)
      // El _layout.jsx detecta el cambio de sesión y redirige automáticamente
    } catch (error) {
      Alert.alert('Error al iniciar sesión', traducirError(error.message))
    } finally {
      setCargando(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.contenedor}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Logo y bienvenida */}
      <View style={styles.encabezado}>
        <Text style={styles.logo}>Fintú</Text>
        <Text style={styles.tagline}>Tus finanzas contigo</Text>
      </View>

      {/* Formulario */}
      <View style={styles.formulario}>
        <Text style={styles.etiqueta}>Correo electrónico</Text>
        <TextInput
          style={styles.input}
          placeholder="tu@email.com"
          placeholderTextColor={COLORS.textoSecundario}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.etiqueta}>Contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="Tu contraseña"
          placeholderTextColor={COLORS.textoSecundario}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.boton, cargando && styles.botonDeshabilitado]}
          onPress={handleLogin}
          disabled={cargando}
        >
          {cargando
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.botonTexto}>Entrar</Text>
          }
        </TouchableOpacity>

        {/* Ir a registro */}
        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.linkTexto}>
            ¿No tienes cuenta? <Text style={styles.linkDestacado}>Regístrate</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

// Traduce mensajes de error de Supabase al español
function traducirError(mensaje) {
  if (mensaje.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (mensaje.includes('Email not confirmed')) return 'Confirma tu email antes de entrar.'
  if (mensaje.includes('Too many requests')) return 'Demasiados intentos. Espera un momento.'
  return 'Ocurrió un error. Intenta de nuevo.'
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORS.fondo,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  encabezado: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 42,
    fontWeight: '800',
    color: COLORS.primario,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 15,
    color: COLORS.textoSecundario,
    marginTop: 6,
  },
  formulario: {
    gap: 8,
  },
  etiqueta: {
    color: COLORS.textoSecundario,
    fontSize: 13,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: COLORS.fondoInput,
    color: COLORS.texto,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.borde,
  },
  boton: {
    backgroundColor: COLORS.primario,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  botonDeshabilitado: {
    opacity: 0.6,
  },
  botonTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  linkTexto: {
    color: COLORS.textoSecundario,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
  linkDestacado: {
    color: COLORS.primario,
    fontWeight: '600',
  },
})