# REGISTRO DE ERRORES (BUGS) - FINTÚ

Este archivo documenta bugs complejos encontrados durante el desarrollo, su causa raíz y la solución implementada para evitar regresiones.

---

## [2026-04-15] Bug 2: Gasto con fecha pasada aparece arriba en la lista
- **Síntoma:** Al registrar un gasto con fecha de ayer, aparecía al principio de la lista de hoy.
- **Causa:** La consulta a Supabase solo ordenaba por `created_at DESC`. Los gastos registrados hoy (con fecha de ayer) tenían un `created_at` más reciente que los de hoy registrados temprano.
- **Solución:** Implementar doble ordenamiento en `services/gastos.js`: `.order('fecha', { ascending: false }).order('created_at', { ascending: false })`.

---

## [2026-04-15] Bug 1: Teclado se cierra al buscar en historial
- **Síntoma:** Al escribir en el buscador del historial, el teclado se ocultaba tras cada letra.
- **Causa:** El `TextInput` estaba dentro de un `renderItem` o un `ListHeaderComponent` que se re-renderizaba completamente al cambiar el estado de la búsqueda, perdiendo el foco.
- **Solución:** Mover el `TextInput` fuera del `SectionList` o asegurar que el componente padre no se desmonte.

---

## [2026-04-15] Bug 4: Filtro de categorías regresa al inicio al seleccionar
- **Síntoma:** Al seleccionar una categoría al final del scroll horizontal, el scroll regresaba al inicio automáticamente.
- **Causa:** El `ScrollView` de categorías estaba siendo afectado por el re-renderizado del `SectionList`.
- **Solución:** Envolver el `ScrollView` en un `View` con altura fija y separarlo de la lógica de scroll de la lista principal.
