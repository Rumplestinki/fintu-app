// Layout del grupo auth — sin tabs ni header
import { Stack } from 'expo-router'

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  )
}