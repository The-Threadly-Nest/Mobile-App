"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError, errorMessage } from "../lib/api";
import type { AudienceFilter, StatusFilter, WaitlistStatus, WaitlistEntry, WaitlistResponse, InviteResponse } from "../lib/waitlist-types";

const statuses: readonly WaitlistStatus[] = ["waiting", "invited", "joined", "unsubscribed"];
const tabs: ReadonlyArray<readonly [AudienceFilter, string]> = [["all", "All"], ["customer", "Customers"], ["fashion_house", "Fashion Houses"]];
type Filters = { audience: AudienceFilter; status: StatusFilter; search: string };

export default function WaitlistAdmin() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<WaitlistResponse | null>(null);
  const [filters, setFilters] = useState<Filters>({ audience: "all", status: "all", search: "" });
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function signOut() {
    setToken(""); setData(null); setSelected([]); setMessage("");
  }

  async function load(session: string, nextFilters = filters, page = 1) {
    const params = new URLSearchParams({ ...nextFilters, page: String(page), limit: "25" });
    const result = await api<WaitlistResponse>(`/api/waitlist/admin?${params}`, {}, session);
    setData(result); setSelected([]);
  }

  async function run(task: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await task(); }
    catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.status)) signOut();
      setMessage(errorMessage(error));
    } finally { setBusy(false); }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const credentials = { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") };
    await run(async () => {
      const result = await api<{ token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify(credentials) });
      await load(result.token); setToken(result.token);
    });
  }

  function changeFilters(next: Filters) {
    setFilters(next);
    void run(() => load(token, next));
  }

  function inviteEligible(entry: WaitlistEntry) {
    return Boolean(entry.verifiedAt) && ["waiting", "invited"].includes(entry.status);
  }

  const eligible = data?.entries.filter(inviteEligible).map((entry) => entry.id) ?? [];
  const allSelected = eligible.length > 0 && eligible.every((id) => selected.includes(id));

  return <div className="min-h-screen bg-[#f7f5f4] py-px">
    {!data ? <section className="login-card">
      <a className="wordmark dark" href="/">Owuja</a>
      <p className="eyebrow coral mt-7">PLATFORM ADMINISTRATION</p>
      <h1 className="my-6 font-display text-4xl">Waitlist access</h1>
      <form onSubmit={login}>
        <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="username" required /></label>
        <label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required /></label>
        <button className="primary-button" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      </form>
      {message && <p className="form-message" role="alert">{message}</p>}
    </section> : <main className="admin-shell">
      <header className="admin-header"><div><a className="wordmark dark" href="/">Owuja</a><p>Waitlist administration</p></div><button className="text-button" disabled={busy} onClick={signOut}>Sign out</button></header>
      <section className="summary-grid" aria-label="Waitlist summary">
        {([ ["total", "Total"], ["customers", "Customers"], ["fashionHouses", "Fashion houses"], ["waiting", "Waiting"], ["invited", "Invited"], ["joined", "Joined"] ] as const).map(([key, label]) => <article key={key}><span>{label}</span><strong>{data.summary[key]}</strong></article>)}
      </section>
      <section className="admin-card" aria-busy={busy}>
        <div className="toolbar">
          <div className="tabs" aria-label="Filter by account type">{tabs.map(([value, label]) => <button key={value} className={`tab ${filters.audience === value ? "active" : ""}`} aria-pressed={filters.audience === value} disabled={busy} onClick={() => changeFilters({ ...filters, audience: value })}>{label}</button>)}</div>
          <form className="filters" onSubmit={(event) => { event.preventDefault(); void run(() => load(token)); }}>
            <input type="search" aria-label="Search waitlist" placeholder="Search name, email or location" value={filters.search} maxLength={100} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
            <select aria-label="Filter by status" value={filters.status} disabled={busy} onChange={(event) => changeFilters({ ...filters, status: event.target.value as StatusFilter })}><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
            <button className="text-button" disabled={busy}>Search</button>
          </form>
        </div>
        <div className="bulk-bar"><span>{selected.length} selected</span><button className="secondary-button" disabled={busy || !selected.length} onClick={() => void run(async () => {
          const result = await api<InviteResponse>("/api/waitlist/admin/invite", { method: "POST", body: JSON.stringify({ ids: selected }) }, token);
          await load(token, filters, data.pagination.page);
          setMessage(`${result.delivered.length} invitations sent. ${result.failed.length} failed.`);
        })}>Invite selected</button></div>
        {message && <p className="form-message" role="status">{message}</p>}
        <div className="table-wrap"><table><thead><tr>
          <th><input type="checkbox" aria-label="Select all verified entries" checked={allSelected} disabled={busy || !eligible.length} onChange={(event) => setSelected(event.target.checked ? eligible : [])} /></th>
          <th>Name</th><th>Type</th><th>Location</th><th>Verified</th><th>Status</th><th>Joined waitlist</th>
        </tr></thead><tbody>{data.entries.map((entry) => <tr key={entry.id}>
          <td><input type="checkbox" aria-label={`Select ${entry.name}`} checked={selected.includes(entry.id)} disabled={busy || !inviteEligible(entry)} onChange={(event) => setSelected(event.target.checked ? [...selected, entry.id] : selected.filter((id) => id !== entry.id))} /></td>
          <td><strong>{entry.name}</strong><small>{entry.email}</small>{entry.businessName && <small>{entry.businessName}</small>}</td>
          <td>{entry.audience === "fashion_house" ? "Fashion House" : "Customer"}</td><td>{entry.city || "—"}</td><td>{entry.verifiedAt ? "Verified" : "Pending"}</td>
          <td><select className="status-select" aria-label={`Status for ${entry.name}`} value={entry.status} disabled={busy} onChange={(event) => {
            const status = event.target.value as WaitlistStatus;
            void run(async () => {
              await api<WaitlistEntry>(`/api/waitlist/admin/${entry.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token);
              await load(token, filters, data.pagination.page);
            });
          }}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
          <td>{new Date(entry.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</td>
        </tr>)}</tbody></table></div>
        {!data.entries.length && <div className="empty-state">No waitlist entries match these filters.</div>}
        <footer className="pagination"><button disabled={busy || data.pagination.page <= 1} onClick={() => void run(() => load(token, filters, data.pagination.page - 1))}>Previous</button><span>Page {data.pagination.page} of {Math.max(1, data.pagination.pages)}</span><button disabled={busy || data.pagination.page >= data.pagination.pages} onClick={() => void run(() => load(token, filters, data.pagination.page + 1))}>Next</button></footer>
      </section>
    </main>}
  </div>;
}
