// services/voz.js
// Grabación de audio y extracción de datos del gasto con Gemini
// Usa expo-audio + expo-file-system/legacy (SDK 54+)

import { AudioModule } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { CATEGORIAS } from '../constants/categorias';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
const LISTA_CATEGORIAS = CATEGORIAS.map(c => `${c.id} (${c.nombre})`).join(', ');

// ──────────────────────────────────────────
// Pedir permisos de micrófono
// ──────────────────────────────────────────
export async function pedirPermisoMicrofono() {
  const status = await AudioModule.requestRecordingPermissionsAsync();
  return status.granted;
}

// ──────────────────────────────────────────
// Procesar audio con Gemini
// Convierte el archivo a base64 y extrae monto, categoría y descripción
// ──────────────────────────────────────────
export async function procesarAudioConGemini(audioUri) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no configurada');

  const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const prompt = `Eres un asistente de finanzas personales para México.
Tu ÚNICA función es extraer datos de gastos del audio que escuchas.

Si el audio contiene información de un gasto (monto, compra, pago), extrae:
1. El monto en pesos mexicanos — solo el número
2. La categoría más apropiada: ${LISTA_CATEGORIAS}
3. Una descripción corta (máximo 50 caracteres)

Si el audio NO es un gasto (saludos, preguntas, conversación general, ruido), responde exactamente:
{"monto": 0, "categoria_id": "otros", "descripcion": "", "es_gasto": false}

Si SÍ es un gasto, incluye "es_gasto": true en el JSON.

Responde ÚNICAMENTE con JSON válido, sin explicación, sin markdown, sin backticks.
Ejemplo gasto: {"monto": 150, "categoria_id": "comida", "descripcion": "tacos", "es_gasto": true}`;

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: 'audio/mp4', data: base64Audio } },
          { text: prompt },
        ],
      }],
      generationConfig: { maxOutputTokens: 600, temperature: 0.1 },
    }),
  });

  // Error 503 — Gemini saturado, mensaje amigable
  if (response.status === 503) {
    throw new Error('Gemini está saturado en este momento. Intenta en unos segundos.');
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Error de IA (${response.status}). Intenta de nuevo.`);
  }

  const data = await response.json();
  const textoRespuesta = data.candidates[0].content.parts[0].text.trim();
  const jsonLimpio = textoRespuesta.replace(/```json|```/g, '').trim();
  const resultado = JSON.parse(jsonLimpio);

  // Si Gemini detectó que no era un gasto, lanzar error controlado
  if (resultado.es_gasto === false) {
    throw new Error('NO_ES_GASTO');
  }

  const categoria = CATEGORIAS.find(c => c.id === resultado.categoria_id) || CATEGORIAS[8];

  return {
    monto: String(resultado.monto || 0),
    categoria,
    descripcion: resultado.descripcion || '',
  };
}