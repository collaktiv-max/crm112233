import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createCrmServer, mcpConfigError } from "@/lib/mcp/server";
import { secretMatches } from "@/lib/mcp/rules";

// MCP-server för Claude (claude.ai → Inställningar → Kopplingar → Lägg till egen koppling).
// Hemligheten ligger i URL:en: /api/mcp/<MCP_SECRET>. Behandla URL:en som ett lösenord.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!secretMatches(token, process.env.MCP_SECRET)) {
    return new Response("Not found", { status: 404 });
  }
  const configError = mcpConfigError();
  if (configError) {
    return Response.json({ jsonrpc: "2.0", error: { code: -32000, message: configError }, id: null }, { status: 500 });
  }

  // Tillståndslöst: en ny server per anrop passar serverless på Vercel.
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  const server = await createCrmServer();
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // Svaret är redan buffrat (enableJsonResponse), så servern kan stängas.
    void server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };
