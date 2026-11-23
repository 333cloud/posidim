import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonResponse = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });
const isBlocked = async (admin: any, senderId: string, recipientId: string) => {
  const [{ data: a, error: ea }, { data: b, error: eb }] = await Promise.all([
    admin.from("user_blocks").select("blocker_id").eq("blocker_id", senderId).eq("blocked_id", recipientId).maybeSingle(),
    admin.from("user_blocks").select("blocker_id").eq("blocker_id", recipientId).eq("blocked_id", senderId).maybeSingle(),
  ]);
  if (ea || eb) throw ea || eb;
  return !!a || !!b;
};
const isFresh = (createdAt: string) => {
  const age = Date.now() - new Date(createdAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < 120000;
};

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
    const caller = createClient(url, publishableKey, {
      global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const recipientId = String(body.recipientId ?? "");
    const kind = String(body.kind ?? "");
    const refId = String(body.refId ?? "");
    if (!recipientId || recipientId === user.id || !["direct_message", "group_message", "like", "invitation", "event_cancelled"].includes(kind)) {
      return jsonResponse({ error: "Invalid notification" }, 400);
    }

    let allowed = false;
    let title = "ПОСИДИМ";
    let message = "";
    if (kind === "direct_message") {
      const [{ data: conversation, error: conversationError }, { data: sent, error: sentError }] = await Promise.all([
        admin.from("direct_conversations").select("id,user_one,user_two").eq("id", refId).maybeSingle(),
        admin.from("direct_messages").select("id,body,created_at").eq("conversation_id", refId).eq("sender_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (conversationError || sentError) throw conversationError || sentError;
      const isPair = !!conversation && [conversation.user_one, conversation.user_two].includes(user.id) && [conversation.user_one, conversation.user_two].includes(recipientId);
      allowed = isPair && !!sent && isFresh(sent.created_at) && !(await isBlocked(admin, user.id, recipientId));
      if (allowed) { title = "Новое сообщение"; message = String(sent.body ?? "").slice(0, 180); }
    } else if (kind === "like") {
      const { data: reaction, error } = await admin.from("profile_reactions").select("actor_id,target_id,liked").eq("actor_id", user.id).eq("target_id", recipientId).eq("liked", true).maybeSingle();
      if (error) throw error;
      allowed = !!reaction && !(await isBlocked(admin, user.id, recipientId));
      if (allowed) { title = "Новая симпатия"; message = "Кому-то понравился твой профиль."; }
    } else if (kind === "invitation") {
      const { data: invite, error: inviteError } = await admin.from("event_invitations").select("id,inviter_id,invitee_id,event_id,status").eq("id", refId).eq("inviter_id", user.id).eq("invitee_id", recipientId).eq("status", "pending").maybeSingle();
      if (inviteError) throw inviteError;
      const { data: event, error: eventError } = invite ? await admin.from("events").select("id,title,status").eq("id", invite.event_id).eq("status", "open").maybeSingle() : { data: null, error: null };
      if (eventError) throw eventError;
      allowed = !!invite && !!event && !(await isBlocked(admin, user.id, recipientId));
      if (allowed) { title = "Приглашение на встречу"; message = `Тебя пригласили: ${String(event.title || "встреча").slice(0, 120)}`; }
    } else if (kind === "group_message" || kind === "event_cancelled") {
      const [{ data: event, error: eventError }, { data: sent, error: sentError }, { data: senderMember, error: senderError }, { data: recipientMember, error: recipientError }] = await Promise.all([
        admin.from("events").select("id,host_id,status").eq("id", refId).maybeSingle(),
        admin.from("messages").select("id,body,created_at").eq("event_id", refId).eq("sender_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        admin.from("event_members").select("event_id").eq("event_id", refId).eq("user_id", user.id).eq("status", "accepted").maybeSingle(),
        admin.from("event_members").select("event_id").eq("event_id", refId).eq("user_id", recipientId).eq("status", "accepted").maybeSingle(),
      ]);
      if (eventError || sentError || senderError || recipientError) throw eventError || sentError || senderError || recipientError;
      if (event?.status === "cancelled") {
        allowed = event.host_id === user.id && !!recipientMember && !(await isBlocked(admin, user.id, recipientId));
        if (allowed) { title = "Встреча отменена"; message = "Организатор отменил встречу. Открой чат, чтобы увидеть подробности."; }
      } else {
        const senderIsMember = event?.host_id === user.id || !!senderMember;
        const recipientIsMember = event?.host_id === recipientId || !!recipientMember;
        allowed = event?.status === "open" && !!sent && isFresh(sent.created_at) && senderIsMember && recipientIsMember && !(await isBlocked(admin, user.id, recipientId));
        if (allowed) { title = "Новое сообщение во встрече"; message = String(sent.body ?? "").slice(0, 180); }
      }
    }
    if (!allowed) return jsonResponse({ error: "Notification relationship not verified" }, 403);

    const { data: budget, error: budgetError } = await admin.rpc("consume_push_notification_budget", { p_user_id: user.id });
    if (budgetError) throw budgetError;
    if (Number(budget) > 60) return jsonResponse({ error: "Notification rate limit exceeded" }, 429);

    const { data: tokens, error: tokenError } = await admin.from("push_tokens").select("expo_push_token").eq("user_id", recipientId);
    if (tokenError) throw tokenError;
    if (!tokens?.length) return jsonResponse({ success: true, accepted: 0, tickets: [] });

    const ticketSummary: any[] = [];
    const pushTokens = [...new Set(tokens.map((t: any) => t.expo_push_token).filter(Boolean))];
    for (let offset = 0; offset < pushTokens.length; offset += 100) {
      const chunk = pushTokens.slice(offset, offset + 100);
      const payload = chunk.map(to => ({ to, sound: "default", title, body: message, data: { kind, refId } }));
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Expo Push service returned " + response.status);
      const result = await response.json();
      const tickets = Array.isArray(result.data) ? result.data : [];
      ticketSummary.push(...tickets.map((ticket: any) => ({ status: ticket.status, error: ticket.details?.error ?? ticket.message })));
      const badTokens = chunk.filter((_, i) => tickets[i]?.status === "error" && tickets[i]?.details?.error === "DeviceNotRegistered");
      if (badTokens.length) {
        const { error: cleanupError } = await admin.from("push_tokens").delete().in("expo_push_token", badTokens);
        if (cleanupError) console.warn("Failed to remove stale push tokens", cleanupError.message);
      }
    }
    const accepted = ticketSummary.filter(t => t.status === "ok").length;
    const rejected = ticketSummary.length - accepted;
    return jsonResponse({ success: true, accepted, rejected, tickets: ticketSummary });
  } catch (error) {
    console.error("send-notification failed", error);
    return jsonResponse({ error: "Notification delivery failed" }, 500);
  }
});
