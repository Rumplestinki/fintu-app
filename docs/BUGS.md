# REGISTRO DE ERRORES (BUGS) - FINTÚ

Este archivo documenta bugs complejos encontrados durante el desarrollo, su causa raíz y la solución implementada para evitar regresiones.

---

## [2026-04-15] Bug 7: Error de sintaxis por bloque de código duplicado
- **Síntoma:** "SyntaxError: 'return' outside of function" al empaquetar la aplicación o al guardar un cambio.
- **Causa:** Un bloque completo de la función en `services/voz.js` y `app/(tabs)/gastos.jsx` se duplicó durante un refactor automático, dejando la palabra reservada `return` fuera de su alcance.
- **Solución:** Limpiar el código y eliminar los bloques duplicados para recuperar la sintaxis correcta.

---

## [2026-04-15] Bug 6: Gastos de noche (tarde) saltan al día siguiente y al periodo incorrecto
- **Síntoma:** Al registrar un gasto muy tarde en el día (ej. después de las 6 o 7 PM), la fecha aparecía como el día de mañana. En los días de corte (ej. el día 14 de mes), esto provocaba que el gasto brincara al periodo del mes siguiente.
- **Causa:** Uso de `new Date().toISOString().split('T')[0]`, que transforma la hora local al formato UTC (Tiempo Universal Coordinado), resultando a menudo en un cambio de fecha (salto al futuro) dependiendo de la hora.
- **Solución:** Implementación de funciones locales como `toLocalISO` que usan `d.getFullYear()`, `d.getMonth()`, y `d.getDate()` para calcular de forma estrictamente local el año, mes y día, sin considerar la desviación UTC.

---

## [2026-04-15] Bug 5: Dashboard y Notificaciones de presupuesto no respetan el día de corte
- **Síntoma:** Los gastos en el historial mostraban el rango de días usando el `dia_corte` configurado, pero el presupuesto en la pantalla principal (Dashboard), la pantalla de presupuestos y las alertas seguían usando el mes calendario tradicional (del día 1 al fin de mes).
- **Causa:** Las funciones `obtenerGastosMes` y `verificarPresupuestos` estaban configuradas para buscar solo el mes en curso y no recibían el parámetro de `dia_corte`.
- **Solución:** Actualizar todo el sistema para utilizar de forma consistente la función `calcularPeriodo` en el Dashboard y las alertas, obteniendo siempre el `dia_corte` de la sesión del usuario. Se añadió sincronización cruzada entre las distintas pantallas.

---

## [2026-04-15] Bug 4: Error RLS al guardar gastos por voz
- **Síntoma:** Al tratar de guardar un gasto mediante el micrófono, fallaba con un error de Supabase: `new row violates row-level security policy for table "gastos"`.
- **Causa:** La llamada a la función `registrarGasto` no estaba mandando el ID del usuario actual ni usando el nombre correcto de la propiedad de categoría (`categoria_id` en lugar del camelCase esperado `categoriaId`), lo que causaba un intento de inserción con valores nulos, violando las reglas de la base de datos (RLS).
- **Solución:** Se corrigió la función en el dashboard para pasar `user.id` explícitamente y se hizo la función `registrarGasto` resiliente al buscar automáticamente el usuario en Supabase si este parámetro llegara a faltar.

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

## [2026-04-15] Bug 3: Filtro de categorías regresa al inicio al seleccionar
- **Síntoma:** Al seleccionar una categoría al final del scroll horizontal, el scroll regresaba al inicio automáticamente.
- **Causa:** El `ScrollView` de categorías estaba siendo afectado por el re-renderizado del `SectionList`.
- **Solución:** Envolver el `ScrollView` en un `View` con altura fija y separarlo de la lógica de scroll de la lista principal.
