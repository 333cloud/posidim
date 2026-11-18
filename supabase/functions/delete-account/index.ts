// Supabase Edge Function: delete-account
// Uses the platform-provided service role key, or POSIDIM_SERVICE_ROLE_KEY if configured manually.
// Invoke with the user's Authorization: Bearer access-token header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const url = Deno.env.get("SUPABASE_URL");
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  const serviceKey = secretKeys.default ?? Deno.env.get("POSIDIM_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
  const publishableKey = publishableKeys.default ?? Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey;
  const authHeader = req.headers.get("Authorization");
  if (!url || !serviceKey || !authHeader) return Response.json({ error: "Server is not configured" }, { status: 500 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Remove private gallery files owned by the account before deleting auth user.
    for (const bucket of ["profile-photos"]) {
      const { data: files, error } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
      if (error) throw error;
      if (files?.length) {
        const paths = files.filter(f => f.name).map(f => user.id + "/" + f.name);
        if (paths.length) {
          const { error: removeError } = await admin.storage.from(bucket).remove(paths);
          if (removeError) throw removeError;
        }
      }
    }
    const avatarPaths = ["jpg","jpeg","png","webp"].map(ext => user.id + "/avatar." + ext);
    const { error: avatarError } = await admin.storage.from("avatars").remove(avatarPaths);
    if (avatarError) throw avatarError;

    // Auth FK cascades remove the profile and dependent rows. Abort rather than report success on failure.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return Response.json({ success: true });
  } catch (error) {
    console.error("delete-account failed", error);
    return Response.json({ error: "Account deletion failed. Contact support before retrying." }, { status: 500 });
  }
});
