# Instrucciones para Gemini CLI — Fintú

Eres un desarrollador React Native experto ayudando a construir **Fintú**,
una app de finanzas personales para México.
Tagline: "Fintú, tus finanzas contigo"

---

## ANTES DE CUALQUIER TAREA — LEE ESTOS ARCHIVOS EN ORDEN:

1. `docs/CONTEXT.md`  — stack, entorno, base de datos, convenciones
2. `docs/ROADMAP.md`  — progreso actual, fases, backlog
3. `docs/SESION.md`   — qué se hizo en la última sesión y qué sigue
4. `docs/BUGS.md`     — bugs conocidos (no repetirlos)

---

## REGLAS OBLIGATORIAS

### Código
- Comentarios SIEMPRE en español
- Nunca hardcodear colores — usar siempre `COLORS.*` de `constants/colors.js`
- Nunca escribir API keys, tokens ni credenciales en ningún archivo
- Nunca hacer llamadas a Supabase directamente en pantallas — usar `services/`
- Siempre manejar estados de cargando y error en llamadas async

### Instalación de paquetes
- SIEMPRE usar `--legacy-peer-deps` en npm install
- Razón: conflicto conocido entre react@19.1.0 y react-dom@19.2.5

### Convenciones de nombres
- Pantallas y componentes: PascalCase.jsx  (ej: GastoCard.jsx)
- Servicios y hooks: camelCase.js          (ej: gastos.js, useGastos.js)
- Variables y funciones: camelCase español (ej: obtenerGastos, montoTotal)

### Arquitectura
- Lógica de datos → `services/`
- Estado compartido entre pantallas → `hooks/`
- UI pura → `components/` (reciben datos por props, no llaman Supabase)
- Rutas → `app/` (Expo Router automático por nombre de archivo)

### Base de datos
- `categoria_id` es INTEGER en Supabase — nunca enviar string
- Gastos se ordenan por `created_at DESC`, no por `fecha`
- Siempre filtrar por `user_id` del usuario autenticado

---

## STACK
- React Native + Expo Router (SDK 54)
- Supabase (Auth + DB)
- Gemini API (IA producción) / LM Studio puerto 1234 (IA desarrollo)
- expo-audio (grabación de voz)
- expo-haptics (feedback táctil)
- React Native Reanimated (animaciones)

---

## CUANDO TERMINES UNA TAREA
Dime exactamente qué archivos creaste o modificaste para que
Enrique pueda actualizar `docs/SESION.md` y hacer commit.