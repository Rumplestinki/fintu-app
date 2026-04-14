// ============================================
// services/supabase.js
// Cliente de Supabase para toda la app
// ============================================
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Leer credenciales desde variables de entorno
// process.env.EXPO_PUBLIC_* funciona en Expo tanto en dev como en builds
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Advertir si faltan variables (sin crashear la app)
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Faltan variables de entorno de Supabase. ' +
    'Revisa tu archivo .env o la configuración de EAS.'
  );
}

// Crear y exportar el cliente de Supabase
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