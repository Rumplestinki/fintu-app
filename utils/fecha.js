// utils/fecha.js
// Helpers de fecha compartidos en toda la app

export const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

// Convierte un Date a string YYYY-MM-DD usando la hora local del dispositivo
export function toLocalISO(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Alias legible para la misma función
export const formatearFechaISO = toLocalISO;

// Formatea "2025-04-13" → "13 abr 2025"
export function formatearFechaLegible(fechaISO) {
  const [año, mes, dia] = fechaISO.split('-');
  return `${dia} ${MESES_CORTOS[parseInt(mes) - 1]} ${año}`;
}

// Formatea "2025-04-13" → "Hoy" / "Ayer" / "13 abr"
export function formatearFechaGasto(fechaISO) {
  if (!fechaISO) return '';
  const hoy = new Date();
  const hoyStr = toLocalISO(hoy);
  const ayerStr = toLocalISO(new Date(Date.now() - 86400000));
  if (fechaISO === hoyStr) return 'Hoy';
  if (fechaISO === ayerStr) return 'Ayer';
  const fecha = new Date(fechaISO + 'T12:00:00');
  return `${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}`;
}
