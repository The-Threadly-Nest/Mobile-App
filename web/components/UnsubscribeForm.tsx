"use client";

import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import type { MessageResponse } from "../lib/waitlist-types";

export default function UnsubscribeForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function unsubscribe() {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setMessage("This unsubscribe link is incomplete."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await api<MessageResponse>("/api/waitlist/unsubscribe", { method: "POST", body: JSON.stringify({ token }) });
      setMessage(result.message); setDone(true);
      window.history.replaceState(null, "", window.location.pathname);
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return <div className="min-h-screen bg-[#f7f5f4] py-px"><main className="login-card">
    <a className="wordmark dark" href="/">Owuja</a><p className="eyebrow coral mt-7">WAITLIST PREFERENCES</p>
    <h1 className="my-6 font-display text-4xl">Leave the waitlist?</h1>
    <p className="intro">You will stop receiving Owuja waitlist and launch updates.</p>
    {message && <p className="form-message" role="status">{message}</p>}
    {!done && <button className="primary-button" disabled={busy} onClick={() => void unsubscribe()}>{busy ? "Updating..." : "Remove me from the waitlist"}</button>}
  </main></div>;
}
