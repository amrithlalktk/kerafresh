"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";

type Role = "ADMIN" | "STAFF";
type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch("/api/users");
    setUsers(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setName("");
      setEmail("");
      setPassword("");
      setRole("STAFF");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(u: AppUser) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Could not update user");
      return;
    }
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Users</h1>

      <Card>
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-black/60 dark:text-white/60">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-black/15 px-2 py-1 text-sm dark:border-white/15 dark:bg-transparent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-black/60 dark:text-white/60">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-black/15 px-2 py-1 text-sm dark:border-white/15 dark:bg-transparent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-black/60 dark:text-white/60">Temporary password</label>
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-black/15 px-2 py-1 text-sm dark:border-white/15 dark:bg-transparent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-black/60 dark:text-white/60">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="rounded-md border border-black/15 px-2 py-1 text-sm dark:border-white/15 dark:bg-transparent"
          >
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <button
          disabled={submitting}
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Create user
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>
      </Card>

      <Card className="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-black/60 dark:text-white/60">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-black/10 dark:border-white/10">
                <td className="px-3 py-2">{u.name}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2">{u.active ? "Active" : "Deactivated"}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => toggleActive(u)} className="underline underline-offset-4">
                    {u.active ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </Card>
    </div>
  );
}
