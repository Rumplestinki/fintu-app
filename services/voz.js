// services/voz.js
// Grabación de audio y extracción de datos del gasto con Gemini
// Usa expo-audio + expo-file-system/legacy (SDK 54+)

import { AudioModule } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { CATEGORIAS } from '../constants/categorias';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
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
Si el audio es cualquiera de estos casos, NO es un gasto:
- Saludo o prueba: "hola", "probando", "uno dos tres"
- Pregunta: "¿cuánto tengo?", "¿cómo funciona?"
- Ruido de fondo sin voz clara
- Voz pero sin mencionar compra, pago, gasto o costo

Si NO es un gasto, responde EXACTAMENTE esto y nada más:
{"monto": 0, "categoria_id": "otros", "descripcion": "", "fecha": "${HOY}", "es_gasto": false}

Si SÍ es un gasto (menciona cualquier compra, pago o costo), continúa con los pasos siguientes.

═══════════════════════════════
PASO 2 — EXTRAER MONTO
═══════════════════════════════
Escucha el número con atención. El usuario puede decir:
- "gasté 150", "pagué 80 pesos", "me costó 35", "son 200"
- "ciento cincuenta", "ochenta pesos", "doscientos"
- "como unos 100", "más o menos 50" → extrae el número (100, 50)
- "me salió en 250" → extrae 250
- "puse 500" → extrae 500
- "me lo dieron en 30" → extrae 30

MONTOS EN PALABRAS (español mexicano):
- "un peso" → 1, "diez" → 10, "veinte" → 20, "treinta" → 30
- "cincuenta" → 50, "cien" / "ciento" → 100, "ciento cincuenta" → 150
- "doscientos" → 200, "trescientos" → 300, "quinientos" → 500
- "mil" → 1000, "mil quinientos" → 1500, "dos mil" → 2000

Si hay DOS montos (ej: "50 de tacos y 30 de agua"), extrae SOLO el primero.
Si el monto genuinamente no se entiende, usa 0.

═══════════════════════════════
PASO 3 — CLASIFICAR CATEGORÍA
════════════───────────────────
Elige UNA categoría: ${LISTA_CATEGORIAS}

REGLAS DE CLASIFICACIÓN — Lee cuidadosamente antes de clasificar:

🍔 comida: SOLO si es algo que se COME o BEBE.
  SÍ: tacos, restaurante, Oxxo (comida), Starbucks, despensa, super,
      Walmart (comida), McDonald's, pizza, café, agua, refresco, frituras.
  NO: si es cualquier otra cosa comprada en esos lugares.

🚗 transporte: moverse de un lugar a otro o pagar por ello.
  SÍ: Uber, Didi, gasolina, camión, metro, taxi, casetas, estacionamiento,
      Cabify, Beat, verificación vehicular, tenencia.

🏠 renta: pagos relacionados con vivir en un lugar.
  SÍ: renta, hipoteca, predial, mantenimiento del edificio o fraccionamiento.

🏡 hogar: artículos o servicios PARA la casa (no la renta en sí).
  SÍ: foco, lámpara, pila, escoba, detergente, cloro, papel de baño,
      muebles, colchón, televisión, licuadora, sartén, maceta, cortina,
      herramientas, pintura para pared, plomero, electricista, IKEA,
      Home Depot, Sodimac, The Home Depot, artículos de limpieza.

🎬 entretenimiento: diversión, cultura, deporte como espectador.
  SÍ: cine, bar, antro, concierto, fiesta, videojuegos, Steam, PlayStation,
      Xbox, boliche, karaoke, parque de diversiones.

💊 salud: cuerpo y bienestar físico.
  SÍ: doctor, hospital, farmacia, medicamentos, vitaminas, lentes,
      dentista, psicólogo, gym, yoga, CrossFit, Farmacias del Ahorro,
      Farmacia Guadalajara, similares.

📚 educacion: aprender algo.
  SÍ: colegiatura, libros, cursos online, Udemy, Coursera, útiles escolares,
      universidad, clases particulares, Duolingo (suscripción educativa).

💡 servicios: servicios básicos del hogar facturados mensualmente.
  SÍ: luz (CFE), agua (SACMEX, SAPAS), gas, internet (Telmex, Izzi, Totalplay),
      plan de celular (Telcel, AT&T, Movistar), teléfono fijo.

📱 suscripciones: pagos recurrentes de plataformas digitales.
  SÍ: Netflix, Spotify, Disney+, Amazon Prime, HBO Max, Apple TV,
      YouTube Premium, iCloud, Google One, Notion, ChatGPT Plus,
      Adobe, Microsoft 365, antivirus, VPN.

👕 ropa: vestir el cuerpo.
  SÍ: ropa, tenis, zapatos, bolsa, cinturón, accesorios de moda,
      Zara, H&M, Pull&Bear, Liverpool (ropa), Nike, Adidas, Shein.

🐾 mascotas: gastos relacionados con animales.
  SÍ: veterinario, medicamento para mascotas, croquetas, arena para gato,
      correa, juguete para mascota, estética canina, Pet Food.

📦 otros: solo si genuinamente no encaja en ninguna categoría anterior.
  SÍ: regalo, viaje (boleto de avión, hotel), seguro, inversión,
      multa, donación, trámites (IMSS, SAT), artículo muy específico
      que no encaja en nada.

TRUCO CRÍTICO: Si mencionan un OBJETO FÍSICO que se usa en casa
(foco, pila, escoba, sartén, mueble, electrodoméstico, herramienta)
→ SIEMPRE es 🏡 hogar, aunque lo hayan comprado en Walmart o Oxxo.

Si mencionan algo de VESTIR → 👕 ropa.
Si mencionan PLATAFORMA DIGITAL de entretenimiento → 📱 suscripciones.
Si mencionan PLATAFORMA DIGITAL de herramienta/trabajo → 📱 suscripciones.

═══════════════════════════════
PASO 4 — DESCRIPCIÓN
═══════════════════════════════
Escribe una descripción corta, natural y específica en español (máximo 50 caracteres).
Incluye los detalles relevantes que el usuario mencionó:
- Especificaciones técnicas: "Foco LED 45W", "Aceite 10W-40", "Cable USB-C 2m"
- Marca o tienda: "Foco Philips en Home Depot", "Tenis Nike en Liverpool"
- Cantidad si es relevante: "Despensa Costco", "6 cervezas Corona"
- Característica importante: "Medicamento para tos", "Libro de cocina"

IMPORTANTE:
- Primera letra en MAYÚSCULA siempre
- NO escribas solo el objeto genérico — incluye el detalle que lo hace útil
- Máximo 50 caracteres

Ejemplos BUENOS:
- "Foco LED 45W Mercado Libre" (no solo "Foco")
- "Uber del aeropuerto" (no solo "Uber")
- "Tacos de canasta x3" (no solo "Tacos")
- "Netflix mes de abril" (no solo "Netflix")
- "Medicamento para fiebre" (no solo "Medicina")
- "Gasolina Pemex Magna" (no solo "Gasolina")

Ejemplos MALOS (demasiado genéricos):
- "Foco" ❌
- "Comida" ❌
- "Transporte" ❌
- "Compra" ❌

═══════════════════════════════
PASO 5 — FECHA DEL GASTO
═══════════════════════════════
Determina cuándo ocurrió el gasto. Devuelve YYYY-MM-DD.
Si no menciona fecha, usa: ${HOY}

═══════════════════════════════
FORMATO DE RESPUESTA
═══════════════════════════════
Responde ÚNICAMENTE con JSON válido. Sin explicación, sin markdown.
{
  "monto": 150,
  "categoria_id": "transporte",
  "descripcion": "Uber al trabajo",
  "fecha": "2025-04-13",
  "transcripcion": "el texto completo que escuchaste",
  "es_gasto": true
}`;

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
      generationConfig: { maxOutputTokens: 800, temperature: 0.1 },
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
    descripcion: resultado.descripcion ? resultado.descripcion.charAt(0).toUpperCase() + resultado.descripcion.slice(1) : '',
    fecha: fechaResultado,
    transcripcion: resultado.transcripcion || '',
  };
}
