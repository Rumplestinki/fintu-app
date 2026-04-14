// ============================================
// services/supabase.js
// Cliente de Supabase para toda la app
// ============================================
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Faltan variables de entorno de Supabase. ' +
    'Revisa tu archivo .env o la configuración de EAS.'
  );
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Limpiar sesión automáticamente si el refresh token expira o es inválido
// Esto evita que la app quede en un estado roto tras reinstalación o inactividad larga
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('✅ Token renovado correctamente');
  }
  if (event === 'SIGNED_OUT') {
    // Limpiar cualquier dato residual de AsyncStorage
    AsyncStorage.multiRemove([
      'supabase.auth.token',
      'supabase.auth.refreshToken',
    ]);
  }
});