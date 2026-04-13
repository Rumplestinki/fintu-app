// /services/presupuestos.js
import { supabase } from './supabase';

// ──────────────────────────────────────────
// Obtener presupuestos del mes actual
// ──────────────────────────────────────────
export async function obtenerPresupuestosMes(mes, anio) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('presupuestos')
    .select('*')
    .eq('user_id', user.id)
    .eq('mes', mes)
    .eq('anio', anio);

  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────
// Guardar o actualizar un presupuesto
// Si ya existe para esa categoría/mes/año lo actualiza
// Si no existe lo crea — gracias al UNIQUE constraint
// ──────────────────────────────────────────
export async function guardarPresupuesto(categoriaId, limite, mes, anio) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('presupuestos')
    .upsert(
      {
        user_id: user.id,
        categoria_id: categoriaId,
        limite: limite,
        mes: mes,
        anio: anio,
      },
      { onConflict: 'user_id,categoria_id,mes,anio' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────
// Eliminar presupuesto de una categoría
// ──────────────────────────────────────────
export async function eliminarPresupuesto(presupuestoId) {
  const { error } = await supabase
    .from('presupuestos')
    .delete()
    .eq('id', presupuestoId);

  if (error) throw error;
}