// /services/presupuestos.js
import { supabase } from './supabase';

// ──────────────────────────────────────────
// Obtener presupuestos del mes actual
// ──────────────────────────────────────────
export async function obtenerPresupuestosMes(mes, anio) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Sesión no válida');

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
// ──────────────────────────────────────────
export async function guardarPresupuesto(categoriaId, limite, mes, anio) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Sesión no válida');

  const { data, error } = await supabase
    .from('presupuestos')
    .upsert(
      { user_id: user.id, categoria_id: categoriaId, limite, mes, anio },
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
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Sesión no válida');

  const { error } = await supabase
    .from('presupuestos')
    .delete()
    .eq('id', presupuestoId)
    .eq('user_id', user.id);

  if (error) throw error;
}
