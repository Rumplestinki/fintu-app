// /services/gastos.js
import { supabase } from './supabase';

// ──────────────────────────────────────────
// Helper: calcular rango de fechas según día de corte
// Dado un día de corte (1-28), devuelve el inicio y fin
// del periodo "actual" o "anterior"
//
// Ejemplo con dia_corte = 15:
//   Hoy = 20 de abril → periodo actual: 15 abr – 14 may
//   Hoy = 10 de abril → periodo actual: 15 mar – 14 abr
// ──────────────────────────────────────────
export function calcularPeriodo(diaCorte = 1, offset = 0) {
  const hoy = new Date();
  const diaActual = hoy.getDate();

  // Determinar si ya pasamos el día de corte este mes
  // Si diaActual >= diaCorte → el periodo actual empezó este mes
  // Si diaActual < diaCorte  → el periodo actual empezó el mes pasado
  let mesInicio, anioInicio;

  if (diaActual >= diaCorte) {
    // Estamos dentro del periodo que empezó este mes
    mesInicio = hoy.getMonth();      // 0-indexed
    anioInicio = hoy.getFullYear();
  } else {
    // Aún no llegamos al corte, el periodo empezó el mes pasado
    const fechaPasada = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    mesInicio = fechaPasada.getMonth();
    anioInicio = fechaPasada.getFullYear();
  }

  // Aplicar offset: -1 = periodo anterior, 0 = actual
  const fechaInicioBase = new Date(anioInicio, mesInicio - offset, diaCorte);
  const fechaFinBase = new Date(anioInicio, mesInicio - offset + 1, diaCorte - 1);

  const toISO = (d) => d.toISOString().split('T')[0];

  return {
    inicio: toISO(fechaInicioBase),
    fin: toISO(fechaFinBase),
  };
}

// ──────────────────────────────────────────
// Gastos de un periodo con día de corte
// Reemplaza a obtenerGastosMes cuando el usuario tiene dia_corte configurado
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
// Mantiene compatibilidad con código existente
// Acepta diaCorte opcional (default = 1 = comportamiento anterior)
// ──────────────────────────────────────────
export async function obtenerGastosMes(mes, anio, diaCorte = 1) {
  const { data: { user } } = await supabase.auth.getUser();

  let fechaInicio, fechaFin;

  if (diaCorte === 1) {
    // Comportamiento clásico: mes calendario
    fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
    fechaFin = new Date(anio, mes, 0).toISOString().split('T')[0];
  } else {
    // Usar periodo basado en día de corte
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