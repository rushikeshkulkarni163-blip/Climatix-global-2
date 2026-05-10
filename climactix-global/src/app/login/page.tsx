"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/";
  const { login, isLoading, error } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "demo">("login");

  const fillDemo = (role: string) => {
    const DEMOS: Record<string, [string, string]> = {
      admin: ["admin@climactixglobal.com", "Climactix2024!"],
      analyst: ["analyst@climactixglobal.com", "Analyst2024!"],
      viewer: ["demo@climactixglobal.com", "Demo2024!"],
    };
    const [e, p] = DEMOS[role] ?? DEMOS.viewer;
    setEmail(e);
    setPassword(p);
    setMode("demo");
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await login({ email, password });
    if (result.success) router.push(redirect);
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-[9px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors mb-6 block">
            ← Back to Climactix Global
          </Link>
          <div className="border-l-2 border-[#1D4ED8] pl-4 mb-6">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#3B82F6] mb-1">
              Institutional Access
            </p>
            <h1 className="text-2xl font-bold text-white">Sign In</h1>
          </div>
          <p className="text-gray-500 text-sm">
            Access the Climate Risk Intelligence Platform.
          </p>
        </div>

        {/* Demo credentials */}
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-4 mb-6">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-3">
            Demo Credentials
          </p>
          <div className="flex gap-2">
            {["admin", "analyst", "viewer"].map((role) => (
              <button
                key={role}
                onClick={() => fillDemo(role)}
                className="flex-1 text-[9px] font-bold uppercase tracking-wider border border-[#2A2A2A] py-1.5 hover:bg-white hover:text-black transition-colors"
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@institution.com"
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm px-4 py-3 focus:outline-none focus:border-[#3B82F6] placeholder-gray-700"
            />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm px-4 py-3 focus:outline-none focus:border-[#3B82F6] placeholder-gray-700"
            />
          </div>

          {error && (
            <div className="border border-[#EF4444]/30 bg-[#EF4444]/5 px-4 py-3">
              <p className="text-[#EF4444] text-xs">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-white text-black font-bold uppercase tracking-widest text-xs py-3.5 hover:bg-gray-100 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Authenticating..." : "Sign In to Platform"}
          </button>
        </form>

        {/* Footer links */}
        <div className="flex items-center justify-between mt-6">
          <Link href="/register" className="text-[10px] text-gray-500 hover:text-white transition-colors">
            Request Access →
          </Link>
          <Link href="/" className="text-[10px] text-gray-500 hover:text-white transition-colors">
            Public Platform →
          </Link>
        </div>

        {/* Role info */}
        <div className="mt-8 border border-[#1F1F1F] bg-[#0A0A0A] p-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-3">
            Access Tiers
          </p>
          <div className="space-y-2">
            {[
              { role: "Admin", desc: "Full platform + CMS access", color: "text-[#EF4444]" },
              { role: "Analyst", desc: "Terminal, simulation, portfolio, ESG scanner", color: "text-[#F97316]" },
              { role: "Viewer", desc: "Read-only dashboard access", color: "text-[#10B981]" },
            ].map(({ role, desc, color }) => (
              <div key={role} className="flex items-start gap-3">
                <span className={`text-[9px] font-bold uppercase tracking-wider flex-shrink-0 mt-0.5 ${color}`}>
                  {role}
                </span>
                <span className="text-[9px] text-gray-500">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
