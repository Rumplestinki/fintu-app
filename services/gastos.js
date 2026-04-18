// /services/gastos.js
import { supabase } from './supabase';
import { toLocalISO } from '../utils/fecha';

// ──────────────────────────────────────────
// Helper: calcular rango de fechas según día de corte
// offset = 0 → periodo actual, offset = 1 → periodo anterior
// ──────────────────────────────────────────
export function calcularPeriodo(diaCorte = 1, offset = 0) {
  const hoy = new Date();
  const diaActual = hoy.getDate();

  let mesInicio, anioInicio;

  if (diaActual >= diaCorte) {
    mesInicio = hoy.getMonth();
    anioInicio = hoy.getFullYear();
  } else {
    const fechaPasada = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    mesInicio = fechaPasada.getMonth();
    anioInicio = fechaPasada.getFullYear();
  }

  // Evitar desborde en meses cortos (ej: día 31 en febrero)
  const ultimoDiaMesInicio = new Date(anioInicio, mesInicio - offset + 1, 0).getDate();
  const ultimoDiaMesFin = new Date(anioInicio, mesInicio - offset + 2, 0).getDate();
  const diaRealInicio = Math.min(diaCorte, ultimoDiaMesInicio);
  const diaRealFin = Math.min(diaCorte - 1, ultimoDiaMesFin);

  const fechaInicioBase = new Date(anioInicio, mesInicio - offset, diaRealInicio);
  const fechaFinBase = new Date(anioInicio, mesInicio - offset + 1, diaRealFin);

  return {
    inicio: toLocalISO(fechaInicioBase),
    fin: toLocalISO(fechaFinBase),
  };
}

// ──────────────────────────────────────────
// Gastos de un periodo con día de corte
// ──────────────────────────────────────────
export async function obtenerGastosPeriodo(diaCorte = 1, offset = 0) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Sesión no válida');

  const { inicio, fin } = calcularPeriodo(diaCorte, offset);

  const { data, error } = await supabase
    .from('gastos')
    .select(`*, categorias(id, nombre, icono, color)`)
    .eq('user_id', user.id)
    .gte('fecha', inicio)
    .lte('fecha', fin)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return { data, inicio, fin };
}

// ──────────────────────────────────────────
// Gastos de un periodo específico por fechas
// Reemplaza obtenerGastosMes — recibe inicio/fin directamente
// para evitar que diaCorte > 1 ignore los parámetros recibidos
// ──────────────────────────────────────────
export async function obtenerGastosPorFechas(fechaInicio, fechaFin) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Sesión no válida');

  const { data, error } = await supabase
    .from('gastos')
    .select(`*, categorias(id, nombre, icono, color)`)
    .eq('user_id', user.id)
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────
// Gastos del mes — mantiene compatibilidad con callers existentes
// CORREGIDO: ya no ignora mes/anio cuando diaCorte > 1
// ──────────────────────────────────────────
export async function obtenerGastosMes(mes, anio, diaCorte = 1) {
  let fechaInicio, fechaFin;

  if (diaCorte === 1) {
    fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
    fechaFin = toLocalISO(new Date(anio, mes, 0));
  } else {
    // Con diaCorte > 1 el caller ya calculó el inicio del periodo correcto,
    // así que reconstruimos el rango a partir de mes/anio del inicio
    const ultimoDiaMesInicio = new Date(anio, mes, 0).getDate();
    const ultimoDiaMesFin = new Date(anio, mes + 1, 0).getDate();
    const diaRealInicio = Math.min(diaCorte, ultimoDiaMesInicio);
    const diaRealFin = Math.min(diaCorte - 1, ultimoDiaMesFin);
    fechaInicio = toLocalISO(new Date(anio, mes - 1, diaRealInicio));
    fechaFin = toLocalISO(new Date(anio, mes, diaRealFin));
  }

  return obtenerGastosPorFechas(fechaInicio, fechaFin);
}

// ──────────────────────────────────────────
// Últimos N gastos — para el dashboard
// ──────────────────────────────────────────
export async function obtenerUltimosGastos(limite = 5, fechaInicio = null, fechaFin = null) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Sesión no válida');

  let query = supabase
    .from('gastos')
    .select(`*, categorias(id, nombre, icono, color)`)
    .eq('user_id', user.id);

  if (fechaInicio) query = query.gte('fecha', fechaInicio);
  if (fechaFin) query = query.lte('fecha', fechaFin);

  const { data, error } = await query
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
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
    .select(`*, categorias(id, nombre, icono, color)`)
    .eq('user_id', userId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────
// Registrar nuevo gasto
// ──────────────────────────────────────────
export async function registrarGasto({ userId, monto, categoriaId, categoria_id, descripcion, fecha, origen = 'manual' }) {
  let uid = userId;
  if (!uid) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Sesión no válida');
    uid = user.id;
  }

  const cid = categoriaId || categoria_id;

  const { data, error } = await supabase
    .from('gastos')
    .insert({ user_id: uid, monto, categoria_id: cid, descripcion, fecha, origen })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────
// Actualizar gasto existente
// SEGURIDAD: filtra también por user_id para doble protección
// ──────────────────────────────────────────
export async function actualizarGasto(id, cambios) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Sesión no válida');

  const { data, error } = await supabase
    .from('gastos')
    .update(cambios)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────
// Eliminar gasto
// SEGURIDAD: filtra también por user_id para doble protección
// ──────────────────────────────────────────
export async function eliminarGasto(id) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Sesión no válida');

  const { error } = await supabase
    .from('gastos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}
