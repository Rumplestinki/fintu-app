// Layout raíz — decide si mostrar auth o la app según el estado de sesión
import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { useAuth } from '../hooks/useAuth'
import { View, ActivityIndicator } from 'react-native'
import { COLORS } from '../constants/colors'

export default function RootLayout() {
  const { usuario, cargando } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (cargando) return

    const enAreaAuth = segments[0] === '(auth)'

    if (!usuario && !enAreaAuth) {
      router.replace('/(auth)/login')
    } else if (usuario && enAreaAuth) {
      router.replace('/(tabs)')
    }
  }, [usuario, cargando, segments])

  if (cargando) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background, // ← corregido: era COLORS.fondo
      }}>
        <ActivityIndicator size="large" color={COLORS.primary} /> 
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  )
}