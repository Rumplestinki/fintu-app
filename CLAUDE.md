# CLAUDE.md — Fintú

App de finanzas personales para México. React Native + Expo Router (SDK 54) + Supabase + Gemini API.

## Contexto completo
Lee `docs/CONTEXT.md` para arquitectura, stack, BD y convenciones.
Lee `docs/ROADMAP.md` para estado del proyecto y fases.
Lee `docs/SESION.md` para el resumen de la última sesión.

## Stack resumido
- Frontend: React Native + Expo Router (SDK 54)
- DB/Auth: Supabase
- IA/Voz: Gemini API (gemini-2.5-flash para audio, gemini-2.5-flash-lite para texto)
- Audio: expo-audio (SDK 54, reemplazó expo-av)
- Paquetes: SIEMPRE instalar con `--legacy-peer-deps`

## Dispositivo de prueba
Samsung Galaxy S24+ con Expo Go (Android). No hay emulador Android instalado.

## Estructura de archivos clave
```
app/(tabs)/index.jsx       — Dashboard principal
app/(tabs)/agregar.jsx     — Formulario de gasto
app/(tabs)/gastos.jsx      — Historial con filtros
app/(tabs)/presupuesto.jsx — Presupuestos por categoría
app/(tabs)/perfil.jsx      — Perfil y configuración
app/_layout.jsx            — Layout raíz + tab bar
components/BotonVoz.jsx    — Grabación de voz con Gemini
services/                  — Lógica de datos (NO tocar desde pantallas)
hooks/useAuth.js           — Autenticación (NO tocar)
constants/colors.js        — Paleta Soft Dark Luxury
constants/categorias.js    — 12 categorías con dbId numérico para Supabase
utils/fecha.js             — toLocalISO, formatearFechaLegible, NOMBRES_MESES
utils/formato.js           — formatMXN
components/Toast.jsx       — Toast compartido
```

## Convenciones críticas
- **Comentarios**: SIEMPRE en español
- **Colores**: NUNCA hardcodear — usar `COLORS.xxx` de `constants/colors.js`
- **Supabase**: NUNCA llamar desde pantallas — usar `services/`
- **categoria_id** en Supabase es INTEGER — nunca enviar string
- **Fechas**: NUNCA usar `new Date().toISOString()` (UTC) — usar `toLocalISO(date)` de `utils/fecha.js`
- **Gastos**: ordenados por `created_at DESC`
- **calcularPeriodo(diaCorte, offset)**: offset=0 actual, offset=1 anterior, NUNCA -1
- **Categorías**: `id` (string) en UI, `dbId` (integer) en Supabase

## Paleta de colores (Soft Dark Luxury)
```js
background: '#0A0A12'   surface: '#12121E'   primary: '#6C63FF'
success: '#00D4AA'      error: '#FF5252'     warning: '#FFB300'
```

## Ramas activas
- `main` — producción estable
- `claude/quizzical-ritchie-9ef2d6` — nuevo diseño Soft Dark Luxury (en curso)

## Retomar trabajo en rama de diseño
```bash
git -C .claude/worktrees/quizzical-ritchie-9ef2d6 log --oneline -5
git -C .claude/worktrees/quizzical-ritchie-9ef2d6 status
```
Orden completado: colors.js ✅ _layout.jsx ✅ index.jsx ✅ agregar.jsx ✅
gastos.jsx ✅ presupuesto.jsx ✅ perfil.jsx ✅ BotonVoz.jsx ✅

## Lo que NO tocar
- `services/` — lógica de datos
- `hooks/useAuth.js` — autenticación
- `constants/categorias.js` — categorías
- `app/(auth)/` — pantallas de login
- `app/onboarding.jsx`
- `.env` — nunca commitear

## Seguridad
- API keys en `.env` (local) y EAS Secrets (build)
- `.env` está en `.gitignore` — NUNCA commitear
- ⚠️ `EXPO_PUBLIC_GEMINI_API_KEY` expuesta en bundle — migrar a EAS Secrets antes de producción
