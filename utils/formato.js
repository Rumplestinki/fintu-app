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
