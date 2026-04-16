// services/haptics.js
// Servicio centralizado de feedback háptico para Fintú
// Proporciona una interfaz simplificada para expo-haptics con manejo de errores

import * as Haptics from 'expo-haptics';

export const hap = {
  /**
   * Impacto ligero: Ideal para navegación entre tabs, selección de elementos
   * secundarios o clics en el teclado.
   */
  suave: async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Silencioso en dispositivos que no lo soporten
    }
  },

  /**
   * Impacto medio: Para confirmar acciones principales, como abrir el micrófono
   * o guardar un formulario (clic inicial).
   */
  guardar: async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
    }
  },

  /**
   * Impacto pesado: Para hitos importantes, como completar un reto, 
   * cumplir una meta de ahorro o alcanzar un hito financiero.
   */
  meta: async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (e) {
    }
  },

  /**
   * Notificación de Error: Para validaciones fallidas, campos vacíos o
   * problemas de conexión.
   */
  error: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (e) {
    }
  },

  /**
   * Notificación de Éxito: Cuando un gasto se guarda correctamente o 
   * una operación finaliza con éxito.
   */
  logro: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
    }
  },

  /**
   * Notificación de Advertencia: Para alertas de presupuesto al límite o
   * recordatorios de pagos vencidos.
   */
  advertencia: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (e) {
    }
  },
};
