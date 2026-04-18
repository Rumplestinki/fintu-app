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
- [✅] Rediseño Premium de TabBar con animaciones y haptics
- [✅] Centralización de servicio de Haptics (Feedback táctil en toda la app)
- [✅] Animaciones de entrada en categorías y tarjetas de gasto
- [✅] Contador animado en Dashboard (monto total)
- [ ] Conexión LM Studio Mac-Windows probada

### FASE 2 — IA
- [✅] Clasificación inteligente de gastos con Gemini (ia.js — solo en voz, quitada de agregar manual)
- [✅] Registro de gastos por voz (expo-audio + Gemini 2.5 Flash)
- [ ] Lectura de emails bancarios
- [ ] Reportes con gráficas
- [ ] Resumen mensual con IA

---

## AUDITORÍA COMPLETADA [2026-04-17]

Se realizó una auditoría exhaustiva del MVP. Todos los puntos fueron corregidos excepto la exposición del API key de Gemini (intencional hasta producción).

### Bugs críticos ✅
- `gastos.jsx`: offset "mes anterior" corregido (-1 → 1)
- `services/gastos.js`: `obtenerGastosMes` ahora respeta mes/anio con diaCorte > 1
- `presupuesto.jsx`: null-check en `ejecutarEliminacion` evita crash
- `perfil.jsx`: `netoMensual` ahora descuenta `fondoAhorro`; campo añadido al modal

### Seguridad ✅
- Validación de sesión en todos los servicios antes de ejecutar queries
- `actualizarGasto`, `eliminarGasto`, `eliminarPresupuesto` con filtro `user_id` extra
- Validación de valores negativos en deducciones de nómina

### Rendimiento ✅
- `index.jsx`: 3 queries de Supabase ahora corren en paralelo con `Promise.all`
- `presupuesto.jsx`: animación usa índice del `map` en lugar de `indexOf`

### UX ✅
- Avatar muestra `?` mientras carga (en lugar de string vacío)
- `agregar.jsx`: header usa `SafeAreaInsets` en lugar de `paddingTop: 60` fijo
- `presupuesto.jsx`: empty state cuando no hay presupuestos configurados
- `BotonFintu.jsx`: estado cargando muestra `<ActivityIndicator>`
- `gastos.jsx`: toast con posición relativa, modal cierra en error

### Arquitectura ✅
- Nuevos: `utils/fecha.js`, `utils/formato.js`, `components/Toast.jsx`
- `BotonVoz.jsx`: corregido Rules of Hooks en `barAnims`; límite 30 s grabación
- `_layout.jsx`: eliminado re-read de AsyncStorage en cada navegación

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
- ✅ UX 7: Solapamiento de TabBar en pantallas de Perfil y Presupuesto — Añadido espaciador inferior dinámico

---

## BITÁCORA DE SESIONES

### Sesión 17-Abr-2026 (Actual)
- **Objetivo:** Auditoría completa del MVP — bugs, seguridad, rendimiento y arquitectura.
- **Logros:**
  - ✅ **4 bugs críticos** corregidos (ver BUGS.md: Bug 10–13)
  - ✅ **Seguridad**: validación de auth en todos los servicios + filtros user_id dobles
  - ✅ **Rendimiento**: queries paralelas en Dashboard con Promise.all
  - ✅ **Utilidades centralizadas**: `utils/fecha.js`, `utils/formato.js`, `components/Toast.jsx`
  - ✅ **BotonVoz**: Rules of Hooks corregido + límite de grabación de 30 s
  - ✅ **UX**: SafeAreaInsets en agregar.jsx, empty state en presupuesto.jsx, ActivityIndicator en BotonFintu
- **Estado de Git:** Commit `fcb6e0d`, mergeado a `main`.

### Sesión 16-Abr-2026
- **Objetivo:** Pulido de UI/UX y Animaciones Premium.
- **Logros:**
  - ✅ **Rediseño de TabBar**: Implementación de una barra de navegación personalizada con botón central flotante y respuesta táctil (haptics).
  - ✅ **Sistema de Haptics**: Centralización del feedback táctil en `services/haptics.js`, integrado en botones de acción y validaciones.
  - ✅ **Animaciones de Dashboard**: Integración de contadores de dinero animados y transiciones suaves en las barras de presupuesto.
  - ✅ **Spring Animations**: Aplicación de animaciones de rebote en la selección de categorías y en la visualización de tarjetas de gasto.
  - ✅ **Ajustes de Layout**: Corrección de espaciado inferior en `perfil.jsx` y `presupuesto.jsx` para evitar que la TabBar tape el contenido.
- **Estado de Git:** Todos los cambios confirmados (commits 84bf80f, 9205bc4, 8d899d9, a606965, 1bd17cd).

### Sesión 15-Abr-2026
- **Objetivo:** Organización del proyecto y mejora del historial.
- **Logros:**
  - ✅ Implementación de `docs/CONTEXT.md`, `docs/ROADMAP.md` y `docs/BUGS.md`.
  - ✅ Implementación de **UX 6**: Selector de año y mes en el historial (navegación histórica completa).
  - ✅ Implementación de **Deducciones de nómina**: Cálculo de ingreso neto real restando ISR, IMSS, IVA y sumando Vales de Despensa.
  - ✅ Sincronización de día de corte en toda la app y corrección de zona horaria local.
