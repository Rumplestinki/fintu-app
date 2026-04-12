// ============================================
// services/supabase.js
// Cliente de Supabase para toda la app
// ============================================

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Leer credenciales desde las variables de entorno
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validar que las variables estén definidas
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '❌ Faltan variables de entorno de Supabase. ' +
    'Revisa tu archivo .env'
  );
}

// Crear y exportar el cliente de Supabase
// AsyncStorage mantiene la sesión activa entre cierres de la app
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,  // Necesario en React Native
  },
});