// Layout raíz de la app — decide si mostrar onboarding, login o la app principal
import { useEffect, useState, useCallback } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import { supabase } from "../services/supabase";
import { View, ActivityIndicator } from "react-native";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState(null);
  const [onboardingVisto, setOnboardingVisto] = useState(false);

  // Función para releer AsyncStorage — se llama al montar y cuando cambian segments
  const verificarEstado = useCallback(async () => {
    try {
      const visto = await AsyncStorage.getItem("onboarding_visto");
      setOnboardingVisto(visto === "true");
    } catch (error) {
      console.error("Error leyendo onboarding:", error);
    }
  }, []);

  // Inicialización: sesión + onboarding
  useEffect(() => {
    const inicializar = async () => {
      try {
        await verificarEstado();
        const { data: { session } } = await supabase.auth.getSession();
        setSesion(session);
      } catch (error) {
        console.error("Error inicializando app:", error);
      } finally {
        setCargando(false);
      }
    };

    inicializar();

    // Escuchar cambios de sesión (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSesion(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Releer AsyncStorage cada vez que cambia la ruta activa
  // Esto detecta cuando el onboarding escribe "onboarding_visto" y navega
  useEffect(() => {
    if (!cargando) {
      verificarEstado();
    }
  }, [segments]);

  // Redirigir según el estado
  useEffect(() => {
    if (cargando) return;

    const enOnboarding = segments[0] === "onboarding";
    const enAuth = segments[0] === "(auth)";

    if (!onboardingVisto) {
      if (!enOnboarding) router.replace("/onboarding");
    } else if (!sesion) {
      if (!enAuth) router.replace("/(auth)/login");
    } else {
      if (enAuth || enOnboarding) router.replace("/(tabs)");
    }
  }, [cargando, sesion, onboardingVisto, segments]);

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: "#1A1035", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#6C63FF" size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}