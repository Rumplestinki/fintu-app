// Pantalla de registro — crea una cuenta nueva en Fintú
import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ActivityIndicator, ScrollView,
  TouchableWithoutFeedback, Keyboard
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../hooks/useAuth'
import { COLORS } from '../../constants/colors'

export default function Register() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const { registrar } = useAuth()
  const router = useRouter()

  async function handleRegistro() {
    if (!nombre || !email || !password || !confirmPassword) {
      Alert.alert('Campos vacíos', 'Por favor completa todos los campos.')
      return
    }
    if (password !== confirmPassword) {
      Alert.alert('Contraseñas distintas', 'Las contraseñas no coinciden.')
      return
    }
    if (password.length < 6) {
      Alert.alert('Contraseña muy corta', 'Mínimo 6 caracteres.')
      return
    }

    setCargando(true)
    try {
      await registrar(email.trim().toLowerCase(), password, nombre.trim())
      Alert.alert(
        '¡Cuenta creada! 🎉',
        'Revisa tu correo para confirmar tu cuenta.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      )
    } catch (error) {
      Alert.alert('Error al registrarse', traducirError(error.message))
    } finally {
      setCargando(false)
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.contenedor}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.encabezado}>
              <Text style={styles.titulo}>Crear cuenta</Text>
              <Text style={styles.subtitulo}>Empieza a controlar tus finanzas</Text>
            </View>

            <View style={styles.formulario}>
              <Text style={styles.etiqueta}>Nombre</Text>
              <TextInput
                style={styles.input}
                placeholder="¿Cómo te llamas?"
                placeholderTextColor={COLORS.textSecondary}
                value={nombre}
                onChangeText={setNombre}
                autoCapitalize="words"
              />

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
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={COLORS.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <Text style={styles.etiqueta}>Confirmar contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="Repite tu contraseña"
                placeholderTextColor={COLORS.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              <TouchableOpacity
                style={[styles.boton, cargando && styles.botonDeshabilitado]}
                onPress={handleRegistro}
                disabled={cargando}
              >
                {cargando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.botonTexto}>Crear cuenta</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.linkTexto}>
                  ¿Ya tienes cuenta? <Text style={styles.linkDestacado}>Inicia sesión</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  )
}

function traducirError(mensaje) {
  if (mensaje.includes('already registered')) return 'Este email ya tiene una cuenta.'
  if (mensaje.includes('invalid email')) return 'El email no es válido.'
  if (mensaje.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (mensaje.includes('Too many requests')) return 'Demasiados intentos. Espera un momento.'
  return 'Ocurrió un error. Intenta de nuevo.'
}

const styles = StyleSheet.create({
  contenedor: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  encabezado: {
    marginBottom: 36,
  },
  titulo: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitulo: {
    fontSize: 15,
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
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