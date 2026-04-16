// app/_layout.jsx
// Layout raíz — decide si mostrar onboarding, login o la app principal

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

  const verificarEstado = useCallback(async () => {
    try {
      const visto = await AsyncStorage.getItem("onboarding_visto");
      setOnboardingVisto(visto === "true");
    } catch (error) {
      console.error("Error leyendo onboarding:", error);
    }
  }, []);

  useEffect(() => {
    const inicializar = async () => {
      try {
        await verificarEstado();
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          await supabase.auth.signOut();
          setSesion(null);
        } else {
          setSesion(session);
        }
      } catch (error) {
        console.error("Error inicializando app:", error);
        setSesion(null);
      } finally {
        setCargando(false);
      }
    };

    inicializar();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'TOKEN_REFRESHED' && !session) {
          supabase.auth.signOut();
          setSesion(null);
          return;
        }
        if (event === 'SIGNED_OUT') {
          setSesion(null);
          return;
        }
        setSesion(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!cargando) verificarEstado();
  }, [segments]);

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
