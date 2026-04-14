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
    if (!email || !password) {
      Alert.alert('Campos vacíos', 'Por favor ingresa tu email y contraseña.')
      return
    }

    setCargando(true)
    try {
      await login(email.trim().toLowerCase(), password)
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
          placeholderTextColor={COLORS.textSecondary}
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
          placeholderTextColor={COLORS.textSecondary}
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

        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.linkTexto}>
            ¿No tienes cuenta? <Text style={styles.linkDestacado}>Regístrate</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

function traducirError(mensaje) {
  if (mensaje.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (mensaje.includes('Email not confirmed')) return 'Confirma tu email antes de entrar.'
  if (mensaje.includes('Too many requests')) return 'Demasiados intentos. Espera un momento.'
  return 'Ocurrió un error. Intenta de nuevo.'
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORS.background,   // '#0F0F14' — oscuro
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
    color: COLORS.primary,                 // '#6C63FF' — púrpura
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 15,
    color: COLORS.textSecondary,           // '#9898B0'
    marginTop: 6,
  },
  formulario: {
    gap: 8,
  },
  etiqueta: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: COLORS.surface,      // '#1A1A24' — superficie oscura
    color: COLORS.textPrimary,             // '#FFFFFF'
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.border,            // '#2A2A3A'
  },
  boton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  botonDeshabilitado: {
    opacity: 0.6,
  },
  botonTexto: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  linkTexto: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
  linkDestacado: {
    color: COLORS.primary,
    fontWeight: '600',
  },
})