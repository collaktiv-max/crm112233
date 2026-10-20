import { SUPABASE_URL } from "@/lib/supabase/env";

export function serviceKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? null;
}

/** Vad som saknas för att Claude-kopplingen ska fungera, eller null om allt finns. */
export function mcpConfigError(): string | null {
  if (!SUPABASE_URL) return "NEXT_PUBLIC_SUPABASE_URL saknas.";
  if (!serviceKey()) return "SUPABASE_SERVICE_ROLE_KEY saknas i Vercel.";
  if (!process.env.MCP_SECRET || process.env.MCP_SECRET.length < 24) return "MCP_SECRET saknas i Vercel (minst 24 tecken).";
  if (!process.env.MCP_USER_EMAIL) return "MCP_USER_EMAIL saknas i Vercel.";
  return null;
}
