import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonResponse = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });

async function deleteFolderContents(admin: any, bucket: string, folder: string, depth = 0): Promise<void> {
  if (depth > 12) throw new Error("Storage folder nesting limit reached");
  const limit = 100;
  let offset = 0;
  let total = 0;
  const filePaths: string[] = [];
  const subfolders: string[] = [];
  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit, offset });
    if (error) throw error;
    const entries = data ?? [];
    if (!entries.length) break;
    total += entries.length;
    if (total > 10000) throw new Error("Account storage object limit exceeded; deletion stopped safely");
    for (const entry of entries) {
      if (!entry.name) continue;
      const path = folder ? folder + "/" + entry.name : entry.name;
      if (entry.id) filePaths.push(path);
      else subfolders.push(path);
    }
    if (entries.length < limit) break;
    offset += entries.length;
  }
  for (let i = 0; i < filePaths.length; i += 100) {
    const { error } = await admin.storage.from(bucket).remove(filePaths.slice(i, i + 100));
    if (error) throw error;
  }
  for (const subfolder of subfolders) await deleteFolderContents(admin, bucket, subfolder, depth + 1);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? secretKeys.default ?? Deno.env.get("POSIDIM_SERVICE_ROLE_KEY");
    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? publishableKeys.default ?? "";
    const authHeader = req.headers.get("Authorization");
    if (!url || !serviceKey || !publishableKey) return jsonResponse({ error: "Server is not configured" }, 500);
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const userClient = createClient(url, publishableKey, {
      global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    // Private profile-gallery and avatar files are removed recursively, in bounded batches,
    // before deleting the Auth user. Never silently leave a page of orphaned files.
    await deleteFolderContents(admin, "profile-photos", user.id);
    await deleteFolderContents(admin, "avatars", user.id);
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return jsonResponse({ success: true });
  } catch (error) {
    console.error("delete-account failed", error);
    return jsonResponse({ error: "Account deletion failed. Contact support before retrying." }, 500);
  }
});
