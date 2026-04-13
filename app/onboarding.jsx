// Pantalla de onboarding — se muestra solo la primera vez que el usuario abre la app
// Usa FlatList horizontal para los slides deslizables
// Al terminar guarda en AsyncStorage que ya fue visto

import React, { useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

// ── Datos de cada slide ─────────────────────────────────────────────────────
const SLIDES = [
  {
    id: "1",
    emoji: "💸",
    titulo: "Tus finanzas, sin complicaciones",
    descripcion:
      "Registra tus gastos en segundos, a mano o por voz. Fintú los organiza automáticamente por categoría.",
    color: ["#1A1035", "#2D1B69"],
    acento: "#6C63FF",
  },
  {
    id: "2",
    emoji: "🎯",
    titulo: "Siempre en control",
    descripcion:
      "Fija presupuestos por categoría y recibe alertas antes de pasarte. Tu dinero, tus reglas.",
    color: ["#0D1F3C", "#1A3A5C"],
    acento: "#4ECDC4",
  },
  {
    id: "3",
    emoji: "✨",
    titulo: "Fintú, tus finanzas contigo",
    descripcion:
      "Empieza gratis hoy, sin tarjeta de crédito. Todo lo que necesitas para tomar el control de tu dinero.",
    color: ["#1A1035", "#2D1B69"],
    acento: "#6C63FF",
  },
];

// ── Componente de un slide individual ───────────────────────────────────────
const Slide = ({ item }) => (
  <LinearGradient colors={item.color} style={styles.slide}>
    {/* Círculo decorativo de fondo */}
    <View style={[styles.circuloFondo, { borderColor: item.acento + "30" }]} />
    <View style={[styles.circuloFondoSmall, { borderColor: item.acento + "20" }]} />

    {/* Emoji principal */}
    <View style={[styles.emojiContainer, { backgroundColor: item.acento + "20" }]}>
      <Text style={styles.emoji}>{item.emoji}</Text>
    </View>

    {/* Textos */}
    <Text style={[styles.titulo, { color: "#FFFFFF" }]}>{item.titulo}</Text>
    <Text style={styles.descripcion}>{item.descripcion}</Text>
  </LinearGradient>
);

// ── Componente principal de Onboarding ──────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef(null);
  const [indiceActual, setIndiceActual] = useState(0);

  // Detecta en qué slide estamos según el scroll
  const alDesplazar = (evento) => {
    const indice = Math.round(evento.nativeEvent.contentOffset.x / width);
    setIndiceActual(indice);
  };

  // Avanza al siguiente slide o termina el onboarding
  const siguientePaso = async () => {
    if (indiceActual < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: indiceActual + 1 });
    } else {
      await terminarOnboarding();
    }
  };

  // Guarda en AsyncStorage que el onboarding ya fue visto y navega al login
  const terminarOnboarding = async () => {
    try {
      await AsyncStorage.setItem("onboarding_visto", "true");
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("Error guardando estado del onboarding:", error);
      router.replace("/(auth)/login");
    }
  };

  const esUltimoSlide = indiceActual === SLIDES.length - 1;
  const slideActual = SLIDES[indiceActual];

  return (
    <View style={styles.contenedor}>
      <StatusBar barStyle="light-content" />

      {/* Slides deslizables */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Slide item={item} />}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={alDesplazar}
        scrollEventThrottle={16}
      />

      {/* Controles inferiores: puntos + botón */}
      <View style={styles.controles}>
        {/* Indicadores de punto */}
        <View style={styles.puntos}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.punto,
                {
                  backgroundColor:
                    i === indiceActual ? slideActual.acento : "#FFFFFF40",
                  width: i === indiceActual ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Botón principal */}
        <TouchableOpacity
          style={[styles.boton, { backgroundColor: slideActual.acento }]}
          onPress={siguientePaso}
          activeOpacity={0.85}
        >
          <Text style={styles.botonTexto}>
            {esUltimoSlide ? "¡Empezar gratis! 🚀" : "Siguiente →"}
          </Text>
        </TouchableOpacity>

        {/* Saltar onboarding (solo en los primeros pasos) */}
        {!esUltimoSlide && (
          <TouchableOpacity
            style={styles.saltarBtn}
            onPress={terminarOnboarding}
          >
            <Text style={styles.saltarTexto}>Saltar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Estilos ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: "#1A1035",
  },

  // ── Slide ──
  slide: {
    width,
    height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 200, // Espacio para los controles inferiores
  },

  // Círculos decorativos de fondo
  circuloFondo: {
    position: "absolute",
    width: 380,
    height: 380,
    borderRadius: 190,
    borderWidth: 1,
    top: height * 0.08,
    right: -80,
  },
  circuloFondoSmall: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    top: height * 0.05,
    left: -50,
  },

  // Contenedor del emoji
  emojiContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  emoji: {
    fontSize: 64,
  },

  // Textos del slide
  titulo: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  descripcion: {
    fontSize: 16,
    color: "#FFFFFFB0",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
  },

  // ── Controles inferiores ──
  controles: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    paddingBottom: 52,
    paddingTop: 24,
    alignItems: "center",
    backgroundColor: "transparent",
  },

  // Indicadores de punto
  puntos: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
  },
  punto: {
    height: 8,
    borderRadius: 4,
    // width se pone dinámicamente arriba
  },

  // Botón principal
  boton: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#6C63FF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  botonTexto: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Botón saltar
  saltarBtn: {
    marginTop: 16,
    padding: 8,
  },
  saltarTexto: {
    color: "#FFFFFF60",
    fontSize: 14,
  },
});