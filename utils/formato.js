// utils/formato.js
// Helpers de formato de moneda y números compartidos en toda la app

// Formatea número a pesos mexicanos sin decimales — para totales y montos grandes
export function formatMXN(monto) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(monto || 0);
}

// Convierte color hex a rgba con opacidad — usado en categorías y tarjetas
export function hexToRgba(hex, opacity) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${opacity})`;
}
