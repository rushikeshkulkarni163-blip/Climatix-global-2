"use client";

import { useEffect, useState } from "react";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  plan: string;
  organization?: string;
  createdAt: string;
  lastLoginAt?: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "text-[#EF4444]",
  analyst: "text-[#F97316]",
  enterprise: "text-[#F59E0B]",
  viewer: "text-[#10B981]",
};

export default function UsersAdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setUsers(d.users ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">USER MANAGEMENT</p>
        <h1 className="text-2xl font-bold text-white">Platform Users</h1>
        <p className="text-gray-500 text-sm mt-1">All registered accounts stored in <code className="text-[#3B82F6]">data/users.json</code></p>
      </div>

      <div className="border border-[#1F1F1F]">
        <div className="grid grid-cols-12 bg-[#0A0A0A] px-4 py-3 border-b border-[#1F1F1F]">
          {["Name", "Email", "Role", "Plan", "Org", "Last Login"].map((h, i) => (
            <div key={h} className={`text-[9px] font-bold uppercase tracking-widest text-gray-500 ${i === 0 ? "col-span-2" : i === 1 ? "col-span-3" : i === 4 ? "col-span-2" : i === 5 ? "col-span-2" : "col-span-1"}`}>
              {h}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-gray-500 text-xs">Loading users…</div>
        ) : users.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-xs">No users found</div>
        ) : users.map((u) => (
          <div key={u.id} className="grid grid-cols-12 px-4 py-3 border-b border-[#0D0D0D] hover:bg-[#0A0A0A] items-center">
            <div className="col-span-2 text-xs font-semibold text-white truncate">{u.name}</div>
            <div className="col-span-3 text-[10px] text-gray-400 truncate">{u.email}</div>
            <div className="col-span-1">
              <span className={`text-[9px] font-bold uppercase ${ROLE_COLORS[u.role] ?? "text-gray-400"}`}>
                {u.role}
              </span>
            </div>
            <div className="col-span-1 text-[9px] text-gray-500 capitalize">{u.plan}</div>
            <div className="col-span-2 text-[9px] text-gray-500 truncate">{u.organization ?? "—"}</div>
            <div className="col-span-2 text-[9px] text-gray-600">
              {u.lastLoginAt
                ? new Date(u.lastLoginAt).toLocaleDateString()
                : "Never"}
            </div>
          </div>
        ))}
      </div>

      <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-3">DEMO ACCOUNTS</p>
        <div className="space-y-2">
          {[
            { email: "admin@climactixglobal.com", pw: "Climactix2024!", role: "admin" },
            { email: "analyst@climactixglobal.com", pw: "Analyst2024!", role: "analyst" },
            { email: "demo@climactixglobal.com", pw: "Demo2024!", role: "viewer" },
          ].map(({ email, pw, role }) => (
            <div key={email} className="flex items-center gap-4 text-[10px]">
              <span className={`font-bold uppercase w-16 ${ROLE_COLORS[role]}`}>{role}</span>
              <span className="text-gray-400">{email}</span>
              <span className="text-gray-600 font-mono">{pw}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
