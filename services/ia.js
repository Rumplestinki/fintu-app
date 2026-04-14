// services/ia.js
// Servicio de IA para Fintú
// Soporta dos modos: LM Studio (desarrollo) y Gemini (producción)
// El modo se controla con la variable IA_MODE en el .env

import { CATEGORIAS } from '../constants/categorias';

// ──────────────────────────────────────────
// Configuración según el modo activo
// ──────────────────────────────────────────
const IA_MODE = process.env.EXPO_PUBLIC_IA_MODE || 'gemini';
const LM_STUDIO_URL = process.env.EXPO_PUBLIC_LM_STUDIO_BASE_URL;
const LM_STUDIO_MODEL = process.env.EXPO_PUBLIC_LM_STUDIO_MODEL || 'qwen3.5-9b';
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// Lista de categorías para el prompt (generada automáticamente desde categorias.js)
const LISTA_CATEGORIAS = CATEGORIAS.map(c => `${c.id} (${c.nombre})`).join(', ');

// ──────────────────────────────────────────
// Prompt base para clasificación de gastos
// ──────────────────────────────────────────
function buildPrompt(descripcion) {
  return `Eres un asistente de finanzas personales para México.
Tu tarea es clasificar un gasto en una de estas categorías: ${LISTA_CATEGORIAS}, otros.

Descripción del gasto: "${descripcion}"

Responde ÚNICAMENTE con el id de la categoría más apropiada, sin explicación.
Ejemplos:
- "uber" → transporte
- "starbucks" → comida  
- "netflix" → suscripciones
- "doctor" → salud
- "cfe" → servicios
- "gimnasio" → salud

Responde solo con el id, una sola palabra:`;
}

// ──────────────────────────────────────────
// Modo desarrollo — LM Studio (gratis, ilimitado)
// LM Studio debe estar corriendo en Windows en la red local
// ──────────────────────────────────────────
async function clasificarConLMStudio(descripcion) {
  if (!LM_STUDIO_URL) throw new Error('LM_STUDIO_BASE_URL no configurada en .env');

  const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LM_STUDIO_MODEL,
      messages: [{ role: 'user', content: buildPrompt(descripcion) }],
      max_tokens: 20,
      temperature: 0.1, // temperatura baja = más determinista
    }),
  });

  if (!response.ok) throw new Error(`LM Studio error: ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content.trim().toLowerCase();
}

// ──────────────────────────────────────────
// Modo producción — Gemini API (Google)
// Modelo: gemini-2.0-flash-lite (gratis, 1000 req/día)
// ──────────────────────────────────────────
async function clasificarConGemini(descripcion) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no configurada en .env');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(descripcion) }] }],
        generationConfig: {
          maxOutputTokens: 20,
          temperature: 0.1,
        },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
  const data = await response.json();
  return data.candidates[0].content.parts[0].text.trim().toLowerCase();
}

// ──────────────────────────────────────────
// Función principal — exportada y usada en la app
// Clasifica una descripción y devuelve el objeto categoría completo
// ──────────────────────────────────────────
export async function sugerirCategoria(descripcion) {
  // No clasificar si la descripción es muy corta
  if (!descripcion || descripcion.trim().length < 3) return null;

  try {
    // Elegir el motor según el modo configurado
    const categoriaId = IA_MODE === 'lmstudio'
      ? await clasificarConLMStudio(descripcion)
      : await clasificarConGemini(descripcion);

    // Buscar la categoría en nuestra lista local
    const categoria = CATEGORIAS.find(c => c.id === categoriaId.trim());

    // Si el modelo devolvió algo inválido, retornar null silenciosamente
    return categoria || null;

  } catch (error) {
    // No bloquear la app si la IA falla — simplemente no sugerir nada
    console.warn('⚠️ IA no disponible:', error.message);
    return null;
  }
}