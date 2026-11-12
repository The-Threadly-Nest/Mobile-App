"use client";
import { useState, type FormEvent } from "react";
import { api, errorMessage, ApiError } from "../lib/api";
type User = { id: string; email: string; name: string | null; role: string; active: boolean; fashionHouseOwned: { shopName: string; _count: { staff: number; orders: number; customers: number } } | null };
type Page = { users: User[]; total: number; page: number };
export default function UsersAdmin() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<Page | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  async function load(session: string, page = 1) { setData(await api<Page>(`/api/platform/users?${new URLSearchParams({ search, page: String(page) })}`, {}, session)); }
  async function run(task: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await task(); } catch (e) { if (e instanceof ApiError && [401, 403].includes(e.status)) { setToken(""); setData(null); setTarget(null); } setMessage(errorMessage(e)); } finally { setBusy(false); }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    await run(async () => { const session = await api<{ token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) }); await load(session.token); setToken(session.token); });
  }
  const button = "rounded-full bg-[#F96951] px-5 py-3 text-white disabled:opacity-40";
  const field = "rounded-xl border border-[#453332]/30 bg-white p-3 text-[#453332]";
  return <main className="min-h-screen bg-white p-6 text-[#453332] sm:p-10">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl">User accounts</h1><a href="/admin">Waitlist admin</a>{token && <button onClick={() => { setToken(""); setData(null); setTarget(null); }}>Sign out</button>}</header>
    <p role="status" className="mb-4">{message}</p>
    {!data ? <form onSubmit={login} className="mx-auto grid max-w-md gap-4"><p>Sign in with your platform administrator account.</p><input className={field} name="email" type="email" autoComplete="username" required placeholder="Email" aria-label="Email" /><input className={field} name="password" type="password" autoComplete="current-password" required placeholder="Password" aria-label="Password" /><button className={button} disabled={busy}>Sign in</button></form> : <>
      <form className="mb-6 flex gap-3" onSubmit={e => { e.preventDefault(); void run(() => load(token)); }}><input className={`${field} min-w-0 flex-1`} value={search} maxLength={254} onChange={e => setSearch(e.target.value)} placeholder="Search name or email" aria-label="Search users" /><button className={button} disabled={busy}>Search</button></form>
      <p className="mb-4">{data.total} accounts</p><div className="grid gap-4">{data.users.map(user => <article key={user.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#F9E8D3] p-5"><div><h2>{user.name || "Unnamed account"}</h2><p>{user.email}</p><p>{user.role} · {user.active ? "Active" : "Pending activation"}</p>{user.fashionHouseOwned && <p>{user.fashionHouseOwned.shopName} · {user.fashionHouseOwned._count.staff} staff · {user.fashionHouseOwned._count.orders} orders</p>}</div><button className={button} disabled={busy} onClick={() => { setTarget(user); setEmail(""); setConfirmation(""); }}>Delete account</button></article>)}{!data.users.length && <p>No accounts match your search.</p>}</div>
      <div className="mt-6 flex items-center gap-4"><button disabled={busy || data.page === 1} onClick={() => void run(() => load(token, data.page - 1))}>Previous</button><span>Page {data.page}</span><button disabled={busy || data.page * 25 >= data.total} onClick={() => void run(() => load(token, data.page + 1))}>Next</button></div>
    </>}
    {target && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5"><section role="dialog" aria-modal="true" aria-labelledby="delete-title" className="grid max-w-lg gap-4 rounded-3xl bg-white p-6"><h2 id="delete-title" className="text-xl">Permanently delete {target.name || target.email}?</h2><p>This cannot be undone. Related orders, invoices, measurements, messages, bookings and waitlist registration will be deleted. {target.fashionHouseOwned && `Their fashion house and ${target.fashionHouseOwned._count.staff} staff accounts will also be deleted. Other customers' login accounts remain.`}</p><p>Uploaded files are queued for removal. Shared house catalog images are kept when deleting staff only. App data clears when the device reconnects; offline devices and external CDN copies cannot be erased immediately.</p><label className="grid gap-2">Type the account email<input className={field} value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" /></label><label className="grid gap-2">Type DELETE<input className={field} value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" /></label><div className="flex gap-3"><button disabled={busy} onClick={() => setTarget(null)}>Cancel</button><button className={button} disabled={busy || email !== target.email || confirmation !== "DELETE"} onClick={() => void run(async () => { const result = await api<{ message: string }>(`/api/platform/users/${target.id}/delete`, { method: "POST", body: JSON.stringify({ email, confirmation }) }, token); setTarget(null); await load(token); setMessage(result.message); })}>Delete permanently</button></div></section></div>}
  </main>;
}
