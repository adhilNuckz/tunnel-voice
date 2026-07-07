export interface Env {
  RTK_API_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  REALTIMEKIT_APP_ID: string;
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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    // Create a new meeting (call room)
    if (url.pathname === "/meeting" && req.method === "POST") {
      const data = await rtkFetch(env, "/meetings", { title: "Voice Call" });
      return Response.json(data, { headers: cors });
    }

    // Join a meeting -> returns authToken
    if (url.pathname.match(/^\/meeting\/[\w-]+\/join$/) && req.method === "POST") {
      const meetingId = url.pathname.split("/")[2];
      const { name } = await req.json<{ name: string }>();
      const data = await rtkFetch(env, `/meetings/${meetingId}/participants`, {
        name,
        preset_name: "group_call_participant",
        custom_participant_id: crypto.randomUUID(),
      });
      return Response.json(data, { headers: cors });
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};