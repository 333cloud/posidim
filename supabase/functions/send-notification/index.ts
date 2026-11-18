// Supabase Edge Function: send-notification
// Authenticated client may notify only users connected through a verified app action.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const url = Deno.env.get("SUPABASE_URL");
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  // Prefer the legacy JWT service-role key for supabase-js v2 compatibility.
  // New sb_secret_* keys are not JWTs and must not be sent as Bearer tokens.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? secretKeys.default ?? Deno.env.get("POSIDIM_SERVICE_ROLE_KEY");
  const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? publishableKeys.default ?? "";
  const authHeader = req.headers.get("Authorization");
  if (!url || !serviceKey) return Response.json({ error: "Server is not configured" }, { status: 500 });
  if (!authHeader) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const callerClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false }
  });
  const { data: { user }, error: authError } = await callerClient.auth.getUser();
  if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const recipientId = String(body.recipientId ?? "");
    const kind = String(body.kind ?? "");
    const title = String(body.title ?? "ПОСИДИМ").slice(0, 80);
    const message = String(body.body ?? "").slice(0, 180);
    const refId = String(body.refId ?? "");
    if (!recipientId || recipientId === user.id || !message || !["direct_message","group_message","like","invitation"].includes(kind)) {
      return Response.json({ error: "Invalid notification" }, { status: 400 });
    }

    let allowed = false;
    if (kind === "direct_message") {
      const { data } = await admin.from("direct_conversations").select("id,user_one,user_two").eq("id", refId).maybeSingle();
      allowed = !!data && [data.user_one,data.user_two].includes(user.id) && [data.user_one,data.user_two].includes(recipientId);
    } else if (kind === "like") {
      const { data } = await admin.from("profile_reactions").select("actor_id,target_id,liked").eq("actor_id",user.id).eq("target_id",recipientId).eq("liked",true).maybeSingle();
      allowed = !!data;
    } else if (kind === "invitation") {
      const { data } = await admin.from("event_invitations").select("id,inviter_id,invitee_id").eq("id",refId).eq("inviter_id",user.id).eq("invitee_id",recipientId).maybeSingle();
      allowed = !!data;
    } else if (kind === "group_message") {
      const [{ data: event }, { data: senderMember }, { data: recipientMember }] = await Promise.all([
        admin.from("events").select("id,host_id").eq("id",refId).maybeSingle(),
        admin.from("event_members").select("event_id").eq("event_id",refId).eq("user_id",user.id).eq("status","accepted").maybeSingle(),
        admin.from("event_members").select("event_id").eq("event_id",refId).eq("user_id",recipientId).eq("status","accepted").maybeSingle()
      ]);
      allowed = !!event && (event.host_id === user.id || !!senderMember) && (event.host_id === recipientId || !!recipientMember);
    }
    if (!allowed) return Response.json({ error: "Notification relationship not verified" }, { status: 403 });

    const { data: tokens, error: tokenError } = await admin.from("push_tokens").select("expo_push_token").eq("user_id",recipientId);
    if (tokenError) throw tokenError;
    if (!tokens?.length) return Response.json({ success: true, delivered: 0 });
    const messages = tokens.map(t => ({ to:t.expo_push_token, sound:"default", title, body:message, data:{ kind, refId } }));
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method:"POST", headers:{ "Content-Type":"application/json", "Accept":"application/json" },
      body:JSON.stringify(messages)
    });
    if (!response.ok) throw new Error("Expo Push service returned " + response.status);
    const result = await response.json();
    return Response.json({ success:true, delivered:messages.length, result });
  } catch (error) {
    console.error("send-notification failed", error);
    return Response.json({ error:"Notification delivery failed" }, { status:500 });
  }
});
