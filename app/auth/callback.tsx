import React, { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function PasswordRecoveryScreen() {
  const params = useLocalSearchParams<{ code?: string | string[]; error?: string | string[]; error_description?: string | string[] }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const linkError = Array.isArray(params.error_description) ? params.error_description[0] : params.error_description;
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    const prepare = async () => {
      if (linkError) {
        if (active) {
          setMessage("Ссылка не сработала или уже истекла. Запроси новое письмо для восстановления пароля.");
          setChecking(false);
        }
        return;
      }
      if (!code) {
        if (active) {
          setMessage("В ссылке нет кода восстановления. Вернись ко входу и запроси новое письмо.");
          setChecking(false);
        }
        return;
      }
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        if (active) setReady(true);
      } catch (error: any) {
        if (active) setMessage(error?.message || "Ссылка недействительна или уже использована. Запроси новую.");
      } finally {
        if (active) setChecking(false);
      }
    };
    void prepare();
    return () => { active = false; };
  }, [code, linkError]);

  const savePassword = async () => {
    setMessage("");
    if (password.length < 8) {
      setMessage("Новый пароль должен содержать минимум 8 символов.");
      return;
    }
    if (password !== confirmation) {
      setMessage("Пароли не совпадают.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setPassword("");
      setConfirmation("");
    } catch (error: any) {
      setMessage(error?.message || "Не удалось обновить пароль. Запроси новую ссылку и попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  const fieldStyle = { backgroundColor: "#171A22", borderWidth: 1 as const, borderColor: "#39314F", borderRadius: 12, color: "#F5F5F7", padding: 14, marginTop: 10, fontSize: 15 };
  const buttonStyle = { backgroundColor: "#A78BFA", borderRadius: 12, padding: 14, alignItems: "center" as const, marginTop: 16 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0D12" }}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, width: "100%", maxWidth: 560, alignSelf: "center" }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: "#F5F5F7", fontSize: 26, fontWeight: "900", letterSpacing: 1 }}>ПОСИДИМ<Text style={{ color: "#A78BFA" }}>.</Text></Text>
        <Text style={{ color: "#F5F5F7", fontSize: 23, fontWeight: "800", marginTop: 28 }}>{success ? "Пароль обновлён" : "Восстановление пароля"}</Text>
        {checking ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20 }}>
            <ActivityIndicator color="#A78BFA" />
            <Text style={{ color: "#9CA2AE", fontSize: 13 }}>Проверяем ссылку...</Text>
          </View>
        ) : success ? (
          <>
            <Text style={{ color: "#9CA2AE", fontSize: 14, lineHeight: 21, marginTop: 12 }}>Новый пароль сохранён. Теперь можно вернуться в приложение.</Text>
            <TouchableOpacity onPress={() => router.replace("/")} style={buttonStyle}><Text style={{ color: "#191426", fontWeight: "900" }}>Продолжить</Text></TouchableOpacity>
          </>
        ) : ready ? (
          <>
            <Text style={{ color: "#9CA2AE", fontSize: 14, lineHeight: 21, marginTop: 12 }}>Придумай новый пароль. Используй не менее 8 символов.</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" maxLength={128} placeholder="Новый пароль" placeholderTextColor="#777D8C" style={fieldStyle} />
            <TextInput value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" maxLength={128} placeholder="Повтори новый пароль" placeholderTextColor="#777D8C" style={fieldStyle} />
            {!!message && <Text style={{ color: "#F0A0A0", fontSize: 13, lineHeight: 19, marginTop: 12 }}>{message}</Text>}
            <TouchableOpacity disabled={busy} onPress={() => void savePassword()} style={[buttonStyle, busy && { opacity: 0.55 }]}><Text style={{ color: "#191426", fontWeight: "900" }}>{busy ? "Сохраняем..." : "Сохранить новый пароль"}</Text></TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={{ color: "#F0A0A0", fontSize: 13, lineHeight: 20, marginTop: 14 }}>{message}</Text>
            <TouchableOpacity onPress={() => router.replace("/")} style={buttonStyle}><Text style={{ color: "#191426", fontWeight: "900" }}>Вернуться ко входу</Text></TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
