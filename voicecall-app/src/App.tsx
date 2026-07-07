import { useState, useCallback, useRef, useEffect } from "react";
import RealtimeKitClient from "@cloudflare/realtimekit";
import { RtkMeeting } from "@cloudflare/realtimekit-react-ui";
import type { States } from "@cloudflare/realtimekit-ui";

export default function App() {
  const [meeting, setMeeting] = useState<RealtimeKitClient | null>(null);
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const notifiedLeave = useRef(false);

  const joinCall = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, passcode }),
      });
      const body = await res.json();
      if (!res.ok || body.success === false) {
        const msg = body.errors?.[0]?.message || "Failed to join";
        setError(msg);
        return;
      }
      const client = await RealtimeKitClient.init({
        authToken: body.data.token,
        defaults: { audio: true, video: false },
      });
      await client.join();
      setMeeting(client);
      notifiedLeave.current = false;
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [name, passcode]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (meeting && !notifiedLeave.current) {
        notifiedLeave.current = true;
        navigator.sendBeacon("/leave", new Blob([JSON.stringify({ name })], { type: "application/json" }));
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [meeting, name]);

  const handleStatesUpdate = useCallback(
    (e: CustomEvent<States>) => {
      if (e.detail.meeting === "ended" && !notifiedLeave.current) {
        notifiedLeave.current = true;
        meeting?.leave();
        fetch("/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        setMeeting(null);
      }
    },
    [meeting, name]
  );

  if (!meeting) {
    return (
      <div className="login-container">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            joinCall();
          }}
        >
          <h1>Voice Call</h1>
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            disabled={loading}
            required
          />
          <input
            type="password"
            placeholder="Passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.currentTarget.value)}
            disabled={loading}
            required
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "Joining..." : "Join"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh" }}>
      <RtkMeeting
        meeting={meeting}
        leaveOnUnmount
        onRtkStatesUpdate={handleStatesUpdate}
      />
    </div>
  );
}
