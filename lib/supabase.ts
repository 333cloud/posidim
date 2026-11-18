import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Publishable key is designed for use in client apps.
// Never put a service_role or secret key in this file.
const supabaseUrl = "https://romsqawhikabdtwsrxkb.supabase.co";
const supabasePublishableKey = "sb_publishable_B13KUXNIwMk-bBmhITLd3Q_Au4gW8GE";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});
