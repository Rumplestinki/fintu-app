// constants/categorias.js
// Categorías de Fintú con su ID numérico que coincide con la tabla "categorias" en Supabase
// dbId es el int4 que se guarda en gastos.categoria_id

export const CATEGORIAS = [
  { id: 'comida',          dbId: 1, nombre: 'Comida',    icono: '🍔', color: '#FF6B6B' },
  { id: 'transporte',      dbId: 2, nombre: 'Transporte',icono: '🚗', color: '#4ECDC4' },
  { id: 'renta',           dbId: 3, nombre: 'Renta',     icono: '🏠', color: '#45B7D1' },
  { id: 'entretenimiento', dbId: 4, nombre: 'Entrete.',  icono: '🎬', color: '#96CEB4' },
  { id: 'salud',           dbId: 5, nombre: 'Salud',     icono: '💊', color: '#88D8A3' },
  { id: 'educacion',       dbId: 6, nombre: 'Educación', icono: '📚', color: '#FFD93D' },
  { id: 'servicios',       dbId: 7, nombre: 'Servicios', icono: '💡', color: '#C9B1FF' },
  { id: 'suscripciones',   dbId: 8, nombre: 'Suscripc.', icono: '📱', color: '#FFB347' },
  { id: 'otros',           dbId: 9, nombre: 'Otros',     icono: '📦', color: '#B0B0B0' },
];

export const getCategoriaById = (id) =>
  CATEGORIAS.find((c) => c.id === id) || CATEGORIAS[8];

// Busca por dbId (número) — útil al leer gastos de Supabase
export const getCategoriaByDbId = (dbId) =>
  CATEGORIAS.find((c) => c.dbId === dbId) || CATEGORIAS[8];