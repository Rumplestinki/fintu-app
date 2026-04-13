// Hook central de autenticación — maneja sesión, login, registro y logout
import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

export function useAuth() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    // Verificar si ya hay una sesión activa al abrir la app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUsuario(session?.user ?? null)
      setCargando(false)
    })

    // Escuchar cambios de sesión (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_evento, session) => {
        setUsuario(session?.user ?? null)
        setCargando(false)
      }
    )

    // Limpiar el listener cuando el componente se desmonte
    return () => subscription.unsubscribe()
  }, [])

  // Registro con email y contraseña
  async function registrar(email, password, nombre) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre }, // guarda el nombre en los metadatos del usuario
      },
    })
    if (error) throw error
    return data
  }

  // Login con email y contraseña
  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  // Cerrar sesión
  async function logout() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { usuario, cargando, registrar, login, logout }
}