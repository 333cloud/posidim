import React, { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function SocialAuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string | string[]; error?: string | string[]; error_description?: string | string[] }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const rawError = Array.isArray(params.error) ? params.error[0] : params.error;
  const linkError = Array.isArray(params.error_description) ? params.error_description[0] : params.error_description;
  const authError = linkError || rawError;
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const finish = async () => {
      if (authError || !code) {
        if (active) {
          setMessage(authError ? "Авторизация отменена или не завершилась. Попробуй войти ещё раз." : "В ссылке авторизации нет кода. Попробуй войти ещё раз.");
          setBusy(false);
        }
        return;
      }
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        if (active) router.replace("/");
      } catch (error: any) {
        if (active) {
          setMessage(error?.message || "Не удалось завершить вход. Попробуй ещё раз.");
          setBusy(false);
        }
      }
    };
    void finish();
    return () => { active = false; };
  }, [code, authError]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0D12" }}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, justifyContent: "center", padding: 24, width: "100%", maxWidth: 560, alignSelf: "center" }}>
        <Text style={{ color: "#F5F5F7", fontSize: 26, fontWeight: "900", letterSpacing: 1 }}>ПОСИДИМ<Text style={{ color: "#A78BFA" }}>.</Text></Text>
        <Text style={{ color: "#F5F5F7", fontSize: 23, fontWeight: "800", marginTop: 28 }}>Вход через соцсеть</Text>
        {busy ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20 }}>
            <ActivityIndicator color="#A78BFA" />
            <Text style={{ color: "#9CA2AE", fontSize: 13 }}>Завершаем авторизацию...</Text>
          </View>
        ) : (
          <>
            <Text style={{ color: "#F0A0A0", fontSize: 13, lineHeight: 20, marginTop: 14 }}>{message}</Text>
            <TouchableOpacity onPress={() => router.replace("/")} style={{ backgroundColor: "#A78BFA", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 18 }}>
              <Text style={{ color: "#191426", fontWeight: "900" }}>Вернуться ко входу</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
