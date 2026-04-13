// Categorías de gastos — con emoji, color de fondo y color de texto
// Es la fuente de verdad para íconos en toda la app
export const CATEGORIAS = [
  {
    id: 1,
    nombre: 'Comida',
    emoji: '🍔',
    color: '#FF6B6B',
    colorFondo: 'rgba(255, 107, 107, 0.15)',
  },
  {
    id: 2,
    nombre: 'Transporte',
    emoji: '🚌',
    color: '#6C63FF',
    colorFondo: 'rgba(108, 99, 255, 0.15)',
  },
  {
    id: 3,
    nombre: 'Renta',
    emoji: '🏠',
    color: '#FFC107',
    colorFondo: 'rgba(255, 193, 7, 0.15)',
  },
  {
    id: 4,
    nombre: 'Entretenimiento',
    emoji: '🎬',
    color: '#FF4081',
    colorFondo: 'rgba(255, 64, 129, 0.15)',
  },
  {
    id: 5,
    nombre: 'Salud',
    emoji: '💊',
    color: '#4CAF50',
    colorFondo: 'rgba(76, 175, 80, 0.15)',
  },
  {
    id: 6,
    nombre: 'Educación',
    emoji: '📚',
    color: '#00BCD4',
    colorFondo: 'rgba(0, 188, 212, 0.15)',
  },
  {
    id: 7,
    nombre: 'Servicios',
    emoji: '💡',
    color: '#FF9800',
    colorFondo: 'rgba(255, 152, 0, 0.15)',
  },
  {
    id: 8,
    nombre: 'Suscripciones',
    emoji: '📱',
    color: '#9C27B0',
    colorFondo: 'rgba(156, 39, 176, 0.15)',
  },
  {
    id: 9,
    nombre: 'Otros',
    emoji: '📦',
    color: '#607D8B',
    colorFondo: 'rgba(96, 125, 139, 0.15)',
  },
]

// Función auxiliar: buscar categoría por ID
export const getCategoriaById = (id) =>
  CATEGORIAS.find((c) => c.id === id) || CATEGORIAS[8] // fallback: Otros