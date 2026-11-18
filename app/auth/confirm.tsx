import React, { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function EmailConfirmationScreen() {
  const params = useLocalSearchParams<{ code?: string | string[]; error?: string | string[]; error_description?: string | string[] }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const linkError = Array.isArray(params.error_description) ? params.error_description[0] : params.error_description;
  const [checking, setChecking] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const confirm = async () => {
      if (linkError || !code) {
        if (active) {
          setMessage("Не удалось подтвердить адрес. Ссылка могла истечь или быть уже использована. Попробуй зарегистрироваться ещё раз или запросить новое письмо.");
          setChecking(false);
        }
        return;
      }
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        if (active) setConfirmed(true);
      } catch (error: any) {
        if (active) setMessage(error?.message || "Не удалось подтвердить адрес электронной почты.");
      } finally {
        if (active) setChecking(false);
      }
    };
    void confirm();
    return () => { active = false; };
  }, [code, linkError]);

  const buttonStyle = { backgroundColor: "#A78BFA", borderRadius: 12, padding: 14, alignItems: "center" as const, marginTop: 18 };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0D12" }}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, width: "100%", maxWidth: 560, alignSelf: "center" }}>
        <Text style={{ color: "#F5F5F7", fontSize: 26, fontWeight: "900", letterSpacing: 1 }}>ПОСИДИМ<Text style={{ color: "#A78BFA" }}>.</Text></Text>
        <Text style={{ color: "#F5F5F7", fontSize: 23, fontWeight: "800", marginTop: 28 }}>{confirmed ? "Почта подтверждена" : "Подтверждение почты"}</Text>
        {checking ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20 }}>
            <ActivityIndicator color="#A78BFA" />
            <Text style={{ color: "#9CA2AE", fontSize: 13 }}>Проверяем ссылку...</Text>
          </View>
        ) : (
          <>
            <Text style={{ color: confirmed ? "#9CA2AE" : "#F0A0A0", fontSize: 14, lineHeight: 21, marginTop: 14 }}>{confirmed ? "Адрес электронной почты подтверждён. Теперь можно пользоваться ПОСИДИМ." : message}</Text>
            <TouchableOpacity onPress={() => router.replace("/")} style={buttonStyle}><Text style={{ color: "#191426", fontWeight: "900" }}>Перейти в приложение</Text></TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
