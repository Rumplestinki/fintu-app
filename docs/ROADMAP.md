# ROADMAP Y PROGRESO DE FINTÚ

## FASES DE DESARROLLO

### FASE 1 — MVP (actual)
- Autenticación (email + Google OAuth)
- Registro manual de gastos
- Categorías: comida, transporte, renta, entretenimiento, salud, educación, servicios, suscripciones, otros
- Dashboard: balance, gastos del mes, últimos movimientos
- Presupuesto mensual por categoría con alertas
- Historial con filtros (fecha, categoría, monto)
- Perfil de usuario

### FASE 2 — IA + Automatización
- Registro por voz con Whisper + Gemini/Ollama
- Lectura automática de emails bancarios
- Clasificación inteligente de gastos
- Reportes con gráficas (pastel, barras, línea de tiempo)
- Resumen mensual generado por IA
- Sugerencias de ahorro personalizadas

### FASE 3 — Social + Monetización
- Gastos compartidos
- Metas de ahorro visuales
- Fintú Pro (suscripción mensual/anual)
- Exportar reportes a PDF
- Multi-moneda (MXN, USD)

---

## RASTREADOR DE PROGRESO

### FASE 1 — MVP
- [✅] Entorno Mac configurado (Node, Python, Expo CLI)
- [✅] Proyecto Expo creado y corriendo en dispositivo físico
- [✅] Estructura de carpetas creada
- [✅] Supabase configurado (proyecto + tablas + RLS)
- [✅] Autenticación con email funcionando
- [✅] Dashboard principal
- [✅] Registro manual de gastos
- [✅] Dashboard conectado a datos reales
- [✅] Historial con filtros
- [✅] Presupuestos por categoría
- [✅] Perfil de usuario
- [✅] Editar y eliminar gastos
- [✅] Ingreso mensual editable desde perfil
- [✅] Selector de fecha con fechas anteriores
- [✅] Pantalla de onboarding (3 pasos)
- [✅] Build de prueba en dispositivo físico
- [ ] Conexión LM Studio Mac-Windows probada

### FASE 2 — IA
- [✅] Clasificación inteligente de gastos con Gemini (ia.js — solo en voz, quitada de agregar manual)
- [✅] Registro de gastos por voz (expo-audio + Gemini 2.5 Flash)
- [ ] Lectura de emails bancarios
- [ ] Reportes con gráficas
- [ ] Resumen mensual con IA

---

## BACKLOG RECIENTE (Solucionado)
- ✅ Bug 1: Teclado se cierra al buscar en historial — TextInput fuera del SectionList
- ✅ Bug 2: Gasto con fecha pasada aparece arriba — doble .order en Supabase (fecha + created_at)
- ✅ Bug 3: Voz guardaba siempre fecha de hoy — Gemini recibe HOY/AYER en el prompt, index.jsx usa datos.fecha
- ✅ Bug 4: Filtro de categorías regresa al inicio — ScrollView fuera del SectionList, View wrapper height:42
- ✅ UX 5: Alertas de presupuesto al 80% y 100% — componente AlertaPresupuesto.jsx premium in-app
- ✅ Bug 10: Gastos mismo día ordenados por created_at DESC
- ✅ UX 21: Refresh token expirado manejado limpiamente en _layout.jsx
- ✅ UX 6: Filtro de meses y años pasados en el historial (Implementado con selector de año y cuadrícula de meses)

---

## BITÁCORA DE SESIONES

### Sesión 15-Abr-2026 (Actual)
- **Objetivo:** Organización del proyecto y mejora del historial.
- **Logros:**
  - ✅ Implementación de `docs/CONTEXT.md`, `docs/ROADMAP.md` y `docs/BUGS.md`.
  - ✅ Implementación de **UX 6**: Selector de año y mes en el historial (navegación histórica completa).
  - ✅ Implementación de **Deducciones de nómina**: Cálculo de ingreso neto real restando ISR, IMSS, IVA y sumando Vales de Despensa.
  - ✅ Sincronización de día de corte en toda la app y corrección de zona horaria local.
- **Estado de Git:** Pendiente de commit para cambios en historial, deducciones y documentación.
- **Próximos pasos:** Atacar la lógica de categorías personalizadas o reportes con gráficas.
