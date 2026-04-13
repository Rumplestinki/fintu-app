// /services/gastos.js
import { supabase } from './supabase';

// ──────────────────────────────────────────
// Gastos del mes actual — para el dashboard
// ──────────────────────────────────────────
export async function obtenerGastosMes(mes, anio) {
  const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const fechaFin = new Date(anio, mes, 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('gastos')
    .select(`
      *,
      categorias (
        id,
        nombre,
        icono,
        color
      )
    `)
    .eq('user_id', (await supabase.auth.getUser()).data.user.id)
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)
    .order('fecha', { ascending: false });

  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────
// Últimos N gastos — para el dashboard
// Nombre original conservado tal como lo usa index.jsx
// ──────────────────────────────────────────
export async function obtenerUltimosGastos(limite = 5) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('gastos')
    .select(`
      *,
      categorias (
        id,
        nombre,
        icono,
        color
      )
    `)
    .eq('user_id', user.id)
    .order('fecha', { ascending: false })
    .limit(limite);

  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────
// Todos los gastos — para el historial
// ──────────────────────────────────────────
export async function obtenerTodosLosGastos(userId) {
  const { data, error } = await supabase
    .from('gastos')
    .select(`
      *,
      categorias (
        id,
        nombre,
        icono,
        color
      )
    `)
    .eq('user_id', userId)
    .order('fecha', { ascending: false });

  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────
// Registrar un nuevo gasto
// Agrega user_id automáticamente desde la sesión activa
// ──────────────────────────────────────────
export async function registrarGasto(gasto) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('gastos')
    .insert([{ ...gasto, user_id: user.id }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────
// Eliminar un gasto por ID
// ──────────────────────────────────────────
export async function eliminarGasto(gastoId) {
  const { error } = await supabase
    .from('gastos')
    .delete()
    .eq('id', gastoId);

  if (error) throw error;
}

// ──────────────────────────────────────────
// Actualizar un gasto existente por ID
// ──────────────────────────────────────────
export async function actualizarGasto(gastoId, cambios) {
  const { data, error } = await supabase
    .from('gastos')
    .update(cambios)
    .eq('id', gastoId)
    .select()
    .single();

  if (error) throw error;
  return data;
}