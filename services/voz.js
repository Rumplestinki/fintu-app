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

  const prompt = `Eres un asistente experto en finanzas personales para México.
Tu ÚNICA función es escuchar el audio y extraer datos de un gasto.

═══════════════════════════════
PASO 1 — ¿ES UN GASTO?
═══════════════════════════════
Si el audio es un saludo, pregunta, prueba, ruido o conversación general
que NO menciona ninguna compra, pago o gasto, responde EXACTAMENTE:
{"monto": 0, "categoria_id": "otros", "descripcion": "", "es_gasto": false}

═══════════════════════════════
PASO 2 — EXTRAER MONTO
═══════════════════════════════
Escucha el número con atención. El usuario puede decir:
- "gasté 150", "pagué 80 pesos", "me costó 35", "son 200"
- "ciento cincuenta", "ochenta pesos", "doscientos"
- "150 de uber", "50 en tacos", "32 al Oxxo"
- "mil quinientos", "dos mil", "quinientos pesos"
Extrae SOLO el número. Si no se entiende el monto, usa 0.

═══════════════════════════════
PASO 3 — CLASIFICAR CATEGORÍA
═══════════════════════════════
Elige UNA categoría: ${LISTA_CATEGORIAS}

REGLAS DE CLASIFICACIÓN:

🚗 transporte:
  Uber, Didi, Cabify, taxi, camión, combi, microbús, metro, metrobús,
  tren, Cablebús, trolebús, gasolina, gas para el carro, estacionamiento,
  caseta, peaje, llanta, taller mecánico, aceite, verificación, tenencia,
  pasaje, boleto de autobús, ADO, ETN, Estrella Blanca

🍔 comida:
  tacos, tortas, burritos, tamales, quesadillas, gorditas, enchiladas,
  pozole, birria, carnitas, sopes, tostadas, hamburguesa, pizza, sushi,
  McDonald's, Burger King, KFC, Domino's, Pizza Hut, Subway, Starbucks,
  café, restaurante, comida corrida, cocina económica, fonda,
  Walmart, Chedraui, Soriana, La Comer, Costco, Sam's Club,
  Oxxo, 7-Eleven, tienda, abarrotes, mercado, verduras, frutas,
  carne, pollo, pescado, despensa, mandado, super, supermercado,
  Rappi, Uber Eats, DiDi Food, Sin Delantal, comida a domicilio,
  snack, botana, dulce, refresco, agua, cerveza, mezcal, vino

🏠 renta:
  renta, departamento, cuarto, casa, alquiler, hipoteca,
  mensualidad de la casa, mantenimiento, condominio, fraccionamiento,
  predial, cuota vecinal, administración del edificio

🎬 entretenimiento:
  cine, Cinépolis, Cinemex, concierto, teatro, evento, partido,
  estadio, museo, parque, zoológico, antro, bar, discoteca, billar,
  boliche, escape room, karaoke, arcade, videojuego, juego,
  Steam, PlayStation Store, Xbox Game Pass, Nintendo eShop,
  salida, paseo, diversión, bebidas en bar, cover

💊 salud:
  doctor, médico, dentista, consulta, farmacia, medicamento,
  medicina, pastilla, cápsula, jarabe, Farmacias del Ahorro,
  Farmacias Guadalajara, Benavides, Cruz Verde, hospital, clínica,
  laboratorio, análisis, radiografía, ultrasonido, psicólogo,
  terapia, óptica, lentes, audífono, gym, gimnasio, CrossFit,
  yoga, pilates, vitaminas, suplementos, proteína, creatina

📚 educacion:
  colegio, escuela, universidad, UNAM, Tec, IPN, Ibero, UAM,
  colegiatura, inscripción, curso, clase, taller, diplomado,
  certificación, libro, libreta, cuaderno, útiles, papelería,
  Udemy, Coursera, Platzi, LinkedIn Learning, idiomas, inglés,
  capacitación, examen, TOEFL, GRE

💡 servicios:
  CFE, luz, electricidad, Telmex, internet, cable, Izzi, Megacable,
  Total Play, Sky, Dish, teléfono, celular, Telcel, AT&T, Movistar,
  Bait, Virgin Mobile, agua, SACMEX, gas del hogar, Biogas,
  Zeta Gas, Gas Natural Fenosa, plomero, electricista, albañil,
  carpintero, servicio técnico, limpieza, lavandería, tintorería,
  mensajería, paquetería, FedEx, DHL, Estafeta, J&T,
  seguro de carro, seguro de gastos médicos, seguro de vida,
  IMSS, ISSSTE, SAT, impuestos, predial, tenencia

📱 suscripciones:
  Netflix, Spotify, Disney+, HBO Max, Max, Apple TV+, Amazon Prime,
  Crunchyroll, Paramount+, Vix, DAZN, YouTube Premium, Twitch,
  iCloud, Google One, Microsoft 365, Office 365, Adobe Creative Cloud,
  Canva Pro, ChatGPT Plus, Claude, Notion, Figma, Dropbox,
  Duolingo Plus, membresía, suscripción mensual, renovación anual,
  Apple Music, Deezer, Tidal

🏡 hogar:
  mueble, silla, mesa, sillón, sofá, cama, colchón, almohada,
  refrigerador, lavadora, secadora, microondas, estufa, horno,
  licuadora, cafetera, batidora, aspiradora, ventilador, aire acondicionado,
  televisión, TV, pantalla, bocina, audífonos, auriculares, cables,
  foco, foquito, lámpara, cortinas, tapete, alfombra, toallas,
  sábanas, almohada, edredón, cojín, decoración, cuadro, planta,
  maceta, electrodoméstico, aparato, herramienta, ferretería,
  Home Depot, Ace Hardware, Truper, arreglo del hogar, plomería,
  pintura, impermeabilizante, loseta, material de construcción,
  Amazon (electrónica o hogar), Liverpool, El Palacio de Hierro,
  IKEA, Coppel (electrónica o muebles)

👕 ropa:
  ropa, camisa, pantalón, vestido, falda, blusa, playera, sudadera,
  chamarra, abrigo, zapatos, tenis, botas, sandalias, calcetines,
  ropa interior, cinturón, bolsa, mochila, cartera, sombrero, gorra,
  Zara, H&M, Shein, Forever 21, Pull & Bear, Bershka, Stradivarius,
  Nike, Adidas, Puma, New Balance, Under Armour, C&A, Old Navy,
  Gap, Liverpool (ropa), Coppel (ropa), Suburbia, accesorios, joyería,
  pulsera, collar, aretes, anillo, reloj, lentes de sol

🐾 mascotas:
  veterinario, veterinaria, consulta veterinaria, vacuna para mascota,
  medicamento para perro, medicamento para gato, antiparasitario,
  pulguicida, comida para perro, croquetas, alimento para gato,
  juguete para mascota, collar, correa, cama para mascota,
  estética canina, baño para perro, guardería de mascotas,
  Petco, PetSmart, accesorios para mascota

📦 otros:
  regalo, transferencia, préstamo, ahorro, inversión, donación,
  hotel, viaje, aeropuerto, pasaje de avión, AICM, NAICM, Volaris,
  Aeromexico, Viva Aerobus, maleta, equipaje,
  Amazon (si no es claro qué compró), Mercado Libre,
  todo lo que no encaje claramente en las otras categorías

═══════════════════════════════
PASO 4 — DESCRIPCIÓN
═══════════════════════════════
Escribe una descripción corta y natural en español (máximo 40 caracteres).
Usa el nombre del lugar o producto mencionado.
Ejemplos: "Uber al trabajo", "Tacos en el mercado", "Netflix mensual",
"Despensa Walmart", "Consulta médica", "Gasolina Pemex", "Foco para sala",
"Tenis Nike", "Croquetas Purina", "Crunchyroll mensual"

═══════════════════════════════
FORMATO DE RESPUESTA
═══════════════════════════════
Responde ÚNICAMENTE con JSON válido. Sin explicación, sin markdown, sin backticks.
Si es gasto:    {"monto": 150, "categoria_id": "transporte", "descripcion": "Uber al trabajo", "es_gasto": true}
Si no es gasto: {"monto": 0, "categoria_id": "otros", "descripcion": "", "es_gasto": false}`;

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

  return {
    monto: String(resultado.monto || 0),
    categoria,
    descripcion: resultado.descripcion || '',
  };
}