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
// Helpers de fecha locales
// ──────────────────────────────────────────
const toLocalISO = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function getFechaHoy() {
  return toLocalISO(new Date());
}

function getFechaAyer() {
  return toLocalISO(new Date(Date.now() - 86400000));
}

function getFechaHaceNDias(n) {
  return toLocalISO(new Date(Date.now() - n * 86400000));
}

// ──────────────────────────────────────────
// Pedir permisos de micrófono
// ──────────────────────────────────────────
export async function pedirPermisoMicrofono() {
  const status = await AudioModule.requestRecordingPermissionsAsync();
  return status.granted;
}

// ──────────────────────────────────────────
// Procesar audio con Gemini
// Convierte el archivo a base64 y extrae monto, categoría, descripción y fecha
// ──────────────────────────────────────────
export async function procesarAudioConGemini(audioUri) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no configurada');

  const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Calcular fechas de referencia antes de armar el prompt
  const d = new Date();
  const HOY = getFechaHoy();
  const AYER = getFechaAyer();
  const ANTEAYER = getFechaHaceNDias(2);
  const ANIO = d.getFullYear();
  const MES = String(d.getMonth() + 1).padStart(2, '0');

  const prompt = `Eres un asistente experto en finanzas personales para México.
Tu ÚNICA función es escuchar el audio y extraer datos de un gasto.

═══════════════════════════════
REFERENCIA DE FECHAS — MUY IMPORTANTE
═══════════════════════════════
Hoy es: ${HOY}
Ayer fue: ${AYER}
Anteayer fue: ${ANTEAYER}
El año actual es: ${ANIO}
El mes actual es: ${MES}

Usa estas fechas para interpretar lo que dice el usuario:
- "hoy" → ${HOY}
- "ayer" → ${AYER}
- "anteayer" → ${ANTEAYER}
- "el lunes", "el martes", etc → calcula el día más reciente de esa semana antes de hoy
- "el 15 de abril" → ${ANIO}-04-15
- "el 10 de marzo" → ${ANIO}-03-10
- "el 3" o "el día 3" → ${ANIO}-${MES}-03
- Si NO menciona fecha → usa ${HOY}
- NUNCA pongas una fecha futura. Si el cálculo da fecha futura, usa el mes o año anterior según corresponda.

═══════════════════════════════
PASO 1 — ¿ES UN GASTO?
═══════════════════════════════
Si the audio es un saludo, pregunta, prueba, ruido o conversación general
que NO menciona ninguna compra, pago o gasto, responde EXACTAMENTE:
{"monto": 0, "categoria_id": "otros", "descripcion": "", "fecha": "${HOY}", "es_gasto": false}

═══════════════════════════════
PASO 2 — EXTRAER MONTO
═══════════════════════════════
Escucha el número con atención. El usuario puede decir:
- "gasté 150", "pagué 80 pesos", "me costó 35", "son 200"
- "ciento cincuenta", "ochenta pesos", "doscientos"
Extrae SOLO el número. Si no se entiende el monto, usa 0.

═══════════════════════════════
PASO 3 — CLASIFICAR CATEGORÍA
════════════───────────────────
Elige UNA categoría: ${LISTA_CATEGORIAS}

REGLAS DE CLASIFICACIÓN (ejemplos comunes en México):
🚗 transporte: Uber, Didi, gasolina, camión, metro, casetas.
🍔 comida: tacos, restaurante, despensa, Walmart, Oxxo, super.
🏠 renta: renta, hipoteca, mantenimiento.
🎬 entretenimiento: cine, bar, fiesta, videojuegos, Spotify.
💊 salud: doctor, farmacia, medicinas, gym.
📚 educacion: colegiatura, libros, cursos.
💡 servicios: luz (CFE), agua, internet, plan celular.
📱 suscripciones: Netflix, Amazon Prime, Disney+.
🏡 hogar: muebles, reparaciones, Amazon, Liverpool.
👕 ropa: Zara, tenis, ropa, accesorios.
🐾 mascotas: veterinario, croquetas.
📦 otros: regalos, viajes, imprevistos.

═══════════════════════════════
PASO 4 — DESCRIPCIÓN
═══════════════════════════════
Escribe una descripción corta y natural en español (máximo 40 caracteres).
Usa el nombre del lugar o producto mencionado.

═══════════════════════════════
PASO 5 — FECHA DEL GASTO
═══════════════════════════════
Determina cuándo ocurrió el gasto. Devuelve YYYY-MM-DD.
Si no menciona fecha, usa: ${HOY}

═══════════════════════════════
FORMATO DE RESPUESTA
═══════════════════════════════
Responde ÚNICAMENTE con JSON válido. Sin explicación, sin markdown.
{"monto": 150, "categoria_id": "transporte", "descripcion": "Uber al trabajo", "fecha": "2025-04-13", "es_gasto": true}`;

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

  if (response.status === 503) {
    throw new Error('Gemini está saturado en este momento. Intenta en unos segundos.');
  }

  if (!response.ok) {
    throw new Error(`Error de IA (${response.status}). Intenta de nuevo.`);
  }

  const data = await response.json();
  const textoRespuesta = data.candidates[0].content.parts[0].text.trim();
  const jsonLimpio = textoRespuesta.replace(/```json|```/g, '').trim();
  const resultado = JSON.parse(jsonLimpio);

  if (resultado.es_gasto === false) {
    throw new Error('NO_ES_GASTO');
  }

  const categoria = CATEGORIAS.find(c => c.id === resultado.categoria_id) || CATEGORIAS[8];

  // Validar que la fecha devuelta por Gemini tenga formato correcto
  const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
  const fechaFinal = resultado.fecha && fechaRegex.test(resultado.fecha)
    ? resultado.fecha
    : HOY;

  // Nunca permitir fechas futuras
  const fechaResultado = fechaFinal > HOY ? HOY : fechaFinal;

  return {
    monto: String(resultado.monto || 0),
    categoria,
    descripcion: resultado.descripcion || '',
    fecha: fechaResultado,
  };
}
