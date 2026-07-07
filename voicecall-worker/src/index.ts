export interface Env {
  RTK_API_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  REALTIMEKIT_APP_ID: string;
  ROOM_PASSCODE: string;
  MEETING_ID: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

async function rtkFetch(env: Env, path: string, body?: object) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/realtime/kit/${env.REALTIMEKIT_APP_ID}`;
  const res = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Authorization": `Bearer ${env.RTK_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: Record<string, unknown> = await res.json();
  if (!res.ok || data.success === false) {
    console.error(`RTK API error (${res.status}):`, JSON.stringify(data));
  }
  return data;
}

async function sendTelegram(env: Env, text: string) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: parseInt(env.TELEGRAM_CHAT_ID), text }),
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    // Join a meeting with name + passcode -> returns authToken
    if (url.pathname === "/join" && req.method === "POST") {
      try {
        const { name, passcode } = await req.json<{ name: string; passcode: string }>();

        if (passcode !== env.ROOM_PASSCODE) {
          return Response.json({ success: false, errors: [{ message: "Wrong passcode" }] }, { status: 401, headers: cors });
        }

        const trimmedName = (name || "").trim();
        if (!trimmedName) {
          return Response.json({ success: false, errors: [{ message: "Name required" }] }, { status: 400, headers: cors });
        }

        const data = await rtkFetch(env, `/meetings/${env.MEETING_ID}/participants`, {
          name: trimmedName,
          preset_name: "group_call_participant",
          custom_participant_id: crypto.randomUUID(),
        });

        if (data.success !== false) {
          ctx.waitUntil(sendTelegram(env, `🔊 ${trimmedName} joined the call`));
        }

        return Response.json(data, { headers: cors });
      } catch (err) {
        return Response.json({ success: false, errors: [{ message: err instanceof Error ? err.message : String(err) }] }, { status: 500, headers: cors });
      }
    }

    // Leave notification
    if (url.pathname === "/leave" && req.method === "POST") {
      const { name } = await req.json<{ name: string }>();
      const trimmedName = (name || "").trim();
      if (trimmedName) {
        ctx.waitUntil(sendTelegram(env, `🔇 ${trimmedName} left the call`));
      }
      return Response.json({ success: true }, { headers: cors });
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};