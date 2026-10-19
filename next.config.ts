import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Statussidan läser reparationsfilen från disk; se till att den följer med till Vercel.
  outputFileTracingIncludes: {
    "/status/sql": ["./supabase/migrations/20261019000000_repair_setup.sql"],
  },
};

export default nextConfig;
