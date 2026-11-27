// Supabase Edge Function: send-notification
// Only authenticated users may notify recipients through verified app actions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonResponse = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });

const isBlockedBetween = async (admin: any, userA: string, userB: string) => {
  const [{ data: blockA, error: errorA }, { data: blockB, error: errorB }] = await Promise.all([
    admin.from("user_blocks").select("blocker_id").eq("blocker_id", userA).eq("blocked_id", userB).maybeSingle(),
    admin.from("user_blocks").select("blocker_id").eq("blocker_id", userB).eq("blocked_id", userA).maybeSingle(),
  ]);
  if (errorA || errorB) throw errorA || errorB;
  return !!blockA || !!blockB;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL");
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? secretKeys.default ?? Deno.env.get("POSIDIM_SERVICE_ROLE_KEY");
  const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? publishableKeys.default ?? "";
  const authHeader = req.headers.get("Authorization");
  if (!url || !serviceKey) return jsonResponse({ error: "Server is not configured" }, 500);
  if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const callerClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error: authError } = await callerClient.auth.getUser();
  if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json();
    const recipientId = String(body.recipientId ?? "");
    const kind = String(body.kind ?? "");
    const refId = String(body.refId ?? "");
    const messageId = String(body.messageId ?? "");
    if (!recipientId || recipientId === user.id || !["direct_message","group_message","like","invitation","event_cancelled"].includes(kind)) {
      return jsonResponse({ error: "Invalid notification" }, 400);
    }
    if (["direct_message","group_message"].includes(kind) && (!refId || !messageId)) {
      return jsonResponse({ error: "Message notification requires a verified message" }, 400);
    }
    if (["invitation","event_cancelled"].includes(kind) && !refId) {
      return jsonResponse({ error: "Notification reference is required" }, 400);
    }

    let allowed = false;
    let title = "ПОСИДИМ";
    let message = "";
    if (kind === "direct_message") {
      const low = [user.id,recipientId].sort()[0];
      const high = [user.id,recipientId].sort()[1];
      const [{ data: conversation }, { data: sent }, { data: match }] = await Promise.all([
        admin.from("direct_conversations").select("id,user_one,user_two").eq("id",refId).maybeSingle(),
        admin.from("direct_messages").select("id,body,created_at").eq("id",messageId).eq("conversation_id",refId).eq("sender_id",user.id).maybeSingle(),
        admin.from("profile_matches").select("user_low,user_high").eq("user_low",low).eq("user_high",high).maybeSingle()
      ]);
      const isPair = !!conversation && [conversation.user_one,conversation.user_two].includes(user.id) && [conversation.user_one,conversation.user_two].includes(recipientId);
      const ageMs = sent ? Date.now() - new Date(sent.created_at).getTime() : -1;
      const fresh = ageMs >= 0 && ageMs < 120000;
      allowed = isPair && fresh && !!match && !(await isBlockedBetween(admin, user.id, recipientId));
      if (allowed && sent) { title = "Новое сообщение"; message = sent.body.slice(0,180); }
    } else if (kind === "like") {
      const { data: reaction } = await admin.from("profile_reactions").select("actor_id,target_id,liked").eq("actor_id",user.id).eq("target_id",recipientId).eq("liked",true).maybeSingle();
      allowed = !!reaction && !(await isBlockedBetween(admin, user.id, recipientId));
      if (allowed) { title = "Новая симпатия"; message = "Кому-то понравился твой профиль."; }
    } else if (kind === "invitation") {
      const { data: invite, error: inviteError } = await admin.from("event_invitations").select("id,inviter_id,invitee_id,event_id,status")
        .eq("id",refId).eq("inviter_id",user.id).eq("invitee_id",recipientId).eq("status","pending").maybeSingle();
      const { data: event, error: eventError } = invite ? await admin.from("events").select("id,title,status").eq("id",invite.event_id).eq("status","open").maybeSingle() : { data: null, error: null };
      if (inviteError || eventError) throw inviteError || eventError;
      allowed = !!invite && !!event && !(await isBlockedBetween(admin, user.id, recipientId));
      if (allowed && event) { title = "Приглашение на встречу"; message = `Тебя пригласили: ${String(event.title || "встреча").slice(0,120)}`; }
    } else if (kind === "group_message") {
      const [{ data: sent }, { data: event }, { data: senderMember }, { data: recipientMember }] = await Promise.all([
        admin.from("messages").select("id,body,created_at").eq("id",messageId).eq("event_id",refId).eq("sender_id",user.id).maybeSingle(),
        admin.from("events").select("id,host_id,status").eq("id",refId).eq("status","open").maybeSingle(),
        admin.from("event_members").select("event_id").eq("event_id",refId).eq("user_id",user.id).eq("status","accepted").maybeSingle(),
        admin.from("event_members").select("event_id").eq("event_id",refId).eq("user_id",recipientId).eq("status","accepted").maybeSingle()
      ]);
      const ageMs = sent ? Date.now() - new Date(sent.created_at).getTime() : -1;
      const fresh = ageMs >= 0 && ageMs < 120000;
      allowed = !!event && fresh && (event.host_id === user.id || !!senderMember) && (event.host_id === recipientId || !!recipientMember) && !(await isBlockedBetween(admin, user.id, recipientId));
      if (allowed && sent) { title = "Новое сообщение во встрече"; message = sent.body.slice(0,180); }
    } else if (kind === "event_cancelled") {
      const [{ data: event }, { data: recipientMember }] = await Promise.all([
        admin.from("events").select("id,host_id,status").eq("id",refId).eq("status","cancelled").maybeSingle(),
        admin.from("event_members").select("event_id").eq("event_id",refId).eq("user_id",recipientId).eq("status","accepted").maybeSingle()
      ]);
      allowed = !!event && event.host_id === user.id && !!recipientMember && !(await isBlockedBetween(admin, user.id, recipientId));
      if (allowed) { title = "Встреча отменена"; message = "Организатор отменил встречу. Открой чат, чтобы увидеть подробности."; }
    }
    if (!allowed) return jsonResponse({ error: "Notification relationship not verified" }, 403);

    const { data: tokens, error: tokenError } = await admin.from("push_tokens").select("expo_push_token").eq("user_id",recipientId);
    if (tokenError) throw tokenError;
    if (!tokens?.length) return jsonResponse({ success: true, delivered: 0 });
    const messages = tokens.map(t => ({ to:t.expo_push_token, sound:"default", title, body:message, data:{ kind, refId } }));
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method:"POST", headers:{ "Content-Type":"application/json", "Accept":"application/json" },
      body:JSON.stringify(messages)
    });
    if (!response.ok) throw new Error("Expo Push service returned " + response.status);
    const result = await response.json();
    return jsonResponse({ success:true, delivered:messages.length, result });
  } catch (error) {
    console.error("send-notification failed", error);
    return jsonResponse({ error:"Notification delivery failed" }, 500);
  }
});
