// services/notificaciones.js
// Verificación de presupuestos — devuelve alertas para mostrar in-app
// Sin expo-notifications (no compatible con Expo Go SDK 53+)
// Las alertas se muestran como banners premium dentro del dashboard

import { obtenerPresupuestosMes } from './presupuestos';
import { obtenerGastosMes } from './gastos';
import { getCategoriaByDbId } from '../constants/categorias';

// ──────────────────────────────────────────
// Verificar presupuestos y devolver alertas
// Retorna array de alertas para mostrar en la UI
// Llamar después de registrar cualquier gasto
// ──────────────────────────────────────────
export async function verificarPresupuestos() {
  try {
    const ahora = new Date();
    const mes = ahora.getMonth() + 1;
    const anio = ahora.getFullYear();

    const [presupuestos, gastos] = await Promise.all([
      obtenerPresupuestosMes(mes, anio),
      obtenerGastosMes(mes, anio),
    ]);

    if (!presupuestos || presupuestos.length === 0) return [];

    const gastosPorCategoria = {};
    for (const gasto of gastos) {
      const cid = gasto.categoria_id;
      gastosPorCategoria[cid] = (gastosPorCategoria[cid] || 0) + parseFloat(gasto.monto);
    }

    const alertas = [];

    for (const presupuesto of presupuestos) {
      const { categoria_id, limite } = presupuesto;
      if (!limite || limite <= 0) continue;

      const gastado = gastosPorCategoria[categoria_id] || 0;
      const porcentaje = (gastado / limite) * 100;
      const categoria = getCategoriaByDbId(categoria_id);

      if (porcentaje >= 100) {
        alertas.push({
          id: `alerta-${categoria_id}-100`,
          tipo: 'error',
          categoria_id,
          icono: categoria?.icono || '💰',
          nombre: categoria?.nombre || 'Categoría',
          color: categoria?.color || '#FF5252',
          porcentaje: Math.round(porcentaje),
          gastado: Math.round(gastado),
          limite: Math.round(limite),
          restante: 0,
          titulo: 'Presupuesto agotado',
          mensaje: `Gastaste $${Math.round(gastado)} de $${Math.round(limite)}`,
        });
      } else if (porcentaje >= 80) {
        alertas.push({
          id: `alerta-${categoria_id}-80`,
          tipo: 'warning',
          categoria_id,
          icono: categoria?.icono || '💰',
          nombre: categoria?.nombre || 'Categoría',
          color: categoria?.color || '#FFB300',
          porcentaje: Math.round(porcentaje),
          gastado: Math.round(gastado),
          limite: Math.round(limite),
          restante: Math.round(limite - gastado),
          titulo: 'Casi en el límite',
          mensaje: `${Math.round(porcentaje)}% usado · Te quedan $${Math.round(limite - gastado)}`,
        });
      }
    }

    return alertas;
  } catch (e) {
    console.warn('Error verificando presupuestos:', e);
    return [];
  }
}