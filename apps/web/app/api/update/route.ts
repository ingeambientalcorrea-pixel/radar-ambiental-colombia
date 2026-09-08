import { collectSourceById, listCollectableSources } from "@/lib/collector";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const sources = await listCollectableSources();

  return Response.json({
    ok: true,
    total: sources.length,
    sources: sources.map((source) => ({
      id: source.id,
      name: source.name,
      priority: source.priority,
      sourceType: source.source_type,
      status: source.status,
    })),
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ ok: false, error: "Origen no autorizado" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { sourceId?: string };
    const sourceId = body.sourceId?.trim();

    if (!sourceId || !/^\d+$/.test(sourceId)) {
      return Response.json({ ok: false, error: "sourceId inválido" }, { status: 400 });
    }

    const result = await collectSourceById(sourceId);
    return Response.json({ ok: result.status === "success", result }, { status: result.status === "success" ? 200 : 502 });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error ejecutando actualización",
      },
      { status: 500 },
    );
  }
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
