"use client";

import { useState } from "react";

export default function Home() {
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function testConnection() {
    setLoading(true);
    setStatus("Connecting...");

    try {
      const response = await fetch("/api/test", { cache: "no-store" });
      const result = (await response.json()) as {
        data?: unknown;
        error?: string;
      };

      if (!response.ok || result.error) {
        setStatus(`❌ Error: ${result.error ?? "Request failed"}`);
      } else {
        setStatus(`✅ Connected! Data: ${JSON.stringify(result.data)}`);
      }
    } catch (err) {
      setStatus(`❌ Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-zinc-50 dark:bg-black p-8">
      <main className="flex flex-col items-center gap-6 max-w-md w-full">
        <h1 className="text-2xl font-bold text-black dark:text-white">
          Prisma Data Layer Test
        </h1>

        <button
          onClick={testConnection}
          disabled={loading}
          className="px-6 py-3 bg-foreground text-background rounded-full font-medium disabled:opacity-50 hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors"
        >
          {loading ? "Testing..." : "Test Connection"}
        </button>

        {status && (
          <div className="w-full p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-mono break-all">
            {status}
          </div>
        )}

        <p className="text-zinc-500 text-sm text-center">
          Database queries use Prisma on the server. Supabase SDK remains available for Auth, Storage, and Realtime.
        </p>
      </main>
    </div>
  );
}
