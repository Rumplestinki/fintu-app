// Layout raíz de la app — decide si mostrar onboarding, login o la app principal
// Al cargar verifica AsyncStorage para saber si el onboarding ya fue visto

import { useEffect, useState } from "react";
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

  // Al montar: verifica sesión de Supabase y si el onboarding ya fue visto
  useEffect(() => {
    const inicializar = async () => {
      try {
        // Verificar si el onboarding ya fue visto
        const visto = await AsyncStorage.getItem("onboarding_visto");
        setOnboardingVisto(visto === "true");

        // Verificar sesión activa de Supabase
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

  // Redirigir según el estado cuando termina de cargar
  useEffect(() => {
    if (cargando) return;

    const enOnboarding = segments[0] === "onboarding";
    const enAuth = segments[0] === "(auth)";

    if (!onboardingVisto) {
      // Primera vez → mostrar onboarding
      if (!enOnboarding) router.replace("/onboarding");
    } else if (!sesion) {
      // Onboarding ya visto pero sin sesión → login
      if (!enAuth) router.replace("/(auth)/login");
    } else {
      // Sesión activa → ir a la app
      if (enAuth || enOnboarding) router.replace("/(tabs)");
    }
  }, [cargando, sesion, onboardingVisto, segments]);

  // Pantalla de carga mientras se inicializa
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