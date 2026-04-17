// /services/gastos.js
import { supabase } from './supabase';

// ──────────────────────────────────────────
// Helper: obtener fecha ISO local YYYY-MM-DD
// ──────────────────────────────────────────
const toLocalISO = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ──────────────────────────────────────────
// Helper: calcular rango de fechas según día de corte
// Dado un día de corte (1-28), devuelve el inicio y fin
// del periodo "actual" o "anterior"
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
  const { data: { user } } = await supabase.auth.getUser();
  const { inicio, fin } = calcularPeriodo(diaCorte, offset);

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
    .gte('fecha', inicio)
    .lte('fecha', fin)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return { data, inicio, fin };
}

// ──────────────────────────────────────────
// Gastos del mes actual — para el dashboard
// ──────────────────────────────────────────
export async function obtenerGastosMes(mes, anio, diaCorte = 1) {
  const { data: { user } } = await supabase.auth.getUser();

  let fechaInicio, fechaFin;

  if (diaCorte === 1) {
    fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
    fechaFin = new Date(anio, mes, 0);
    fechaFin = toLocalISO(fechaFin);
  } else {
    const { inicio, fin } = calcularPeriodo(diaCorte, 0);
    fechaInicio = inicio;
    fechaFin = fin;
  }

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
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────
// Últimos N gastos — para el dashboard
// Ahora filtra por periodo si se proporcionan fechas
// ──────────────────────────────────────────
export async function obtenerUltimosGastos(limite = 5, fechaInicio = null, fechaFin = null) {
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
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
    const { data: { user } } = await supabase.auth.getUser();
    uid = user?.id;
  }

  const cid = categoriaId || categoria_id;

  const { data, error } = await supabase
    .from('gastos')
    .insert({
      user_id: uid,
      monto,
      categoria_id: cid,
      descripcion,
      fecha,
      origen,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────
// Actualizar gasto existente
// ──────────────────────────────────────────
export async function actualizarGasto(id, cambios) {
  const { data, error } = await supabase
    .from('gastos')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────
// Eliminar gasto
// ──────────────────────────────────────────
export async function eliminarGasto(id) {
  const { error } = await supabase
    .from('gastos')
    .delete()
    .eq('id', id);

  if (error) throw error;
}