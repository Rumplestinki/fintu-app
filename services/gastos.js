// services/gastos.js
// Funciones CRUD para la tabla "gastos" en Supabase
// Toda la comunicación con la base de datos pasa por aquí

import { supabase } from './supabase';

// ─── CREAR GASTO ──────────────────────────────────────────
// Inserta un nuevo gasto en la base de datos
// Parámetros: { monto, categoria_id, descripcion, fecha, origen }
export const crearGasto = async ({ monto, categoria_id, descripcion, fecha, origen = 'manual' }) => {
  // Obtenemos el usuario actual autenticado
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('No hay usuario autenticado');
  }

  const { data, error } = await supabase
    .from('gastos')
    .insert([
      {
        user_id: user.id,
        monto: parseFloat(monto),
        categoria_id,
        descripcion: descripcion?.trim() || null,
        fecha,
        origen,
      },
    ])
    .select() // Retorna el registro recién creado
    .single();

  if (error) throw error;
  return data;
};

// ─── OBTENER GASTOS DEL MES ───────────────────────────────
// Retorna todos los gastos del usuario en un mes/año dado
export const obtenerGastosMes = async (mes, año) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  // Calculamos el primer y último día del mes
  const fechaInicio = `${año}-${String(mes).padStart(2, '0')}-01`;
  const fechaFin = new Date(año, mes, 0).toISOString().split('T')[0]; // Último día del mes

  const { data, error } = await supabase
    .from('gastos')
    .select('*')
    .eq('user_id', user.id)
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)
    .order('fecha', { ascending: false });

  if (error) throw error;
  return data || [];
};

// ─── OBTENER ÚLTIMOS GASTOS ───────────────────────────────
// Retorna los últimos N gastos del usuario (para el dashboard)
export const obtenerUltimosGastos = async (limite = 10) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data, error } = await supabase
    .from('gastos')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) throw error;
  return data || [];
};

// ─── ELIMINAR GASTO ───────────────────────────────────────
export const eliminarGasto = async (gastoId) => {
  const { error } = await supabase
    .from('gastos')
    .delete()
    .eq('id', gastoId);

  if (error) throw error;
};