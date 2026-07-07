import { useState } from "react";
import RealtimeKitClient from "@cloudflare/realtimekit";
import { RtkMeeting } from "@cloudflare/realtimekit-react-ui";

const WORKER_URL = "http://localhost:8787";

export default function App() {
  const [meeting, setMeeting] = useState<RealtimeKitClient | null>(null);

  async function joinCall() {
    const { data: m } = await fetch(`${WORKER_URL}/meeting`, { method: "POST" }).then(r => r.json());
    const { data: p } = await fetch(`${WORKER_URL}/meeting/${m.id}/join`, {
      method: "POST",
      body: JSON.stringify({ name: "Ding" }),
    }).then(r => r.json());

    const client = await RealtimeKitClient.init({
      authToken: p.token,
      defaults: { audio: true, video: false },
    });
    await client.join();
    setMeeting(client);
  }

  if (!meeting) return <button onClick={joinCall}>Start Voice Call</button>;

  return (
    <div style={{ height: "100vh" }}>
      <RtkMeeting meeting={meeting} />
    </div>
  );
}
