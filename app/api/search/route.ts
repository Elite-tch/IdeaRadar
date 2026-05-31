import { z } from "zod";
import { COLLECTION_NAME } from "@/lib/config";
import { analyzeMatches } from "@/lib/analysis";
import { getQdrantClient } from "@/lib/qdrant-runtime.js";
import { buildIdeaText } from "@/lib/yc";

export const runtime = "nodejs";

const SearchSchema = z.object({
  ideaText: z.string().min(50).max(12000),
  targetUser: z.string().max(500).optional(),
  problem: z.string().max(1000).optional(),
  solution: z.string().max(1000).optional(),
  mode: z
    .enum(["competitors", "alternatives", "adjacent"])
    .default("competitors"),
  industry: z.string().optional(),
  status: z.string().optional(),
  stage: z.string().optional(),
  limit: z.number().int().min(3).max(12).default(8),
});

const INFERENCE_MODEL =
  process.env.QDRANT_INFERENCE_MODEL ?? "sentence-transformers/all-MiniLM-L6-v2";

function buildFilter(input: z.infer<typeof SearchSchema>) {
  const must = [
    input.industry && input.industry !== "All"
      ? { key: "industry", match: { value: input.industry } }
      : null,
    input.status && input.status !== "All"
      ? { key: "status", match: { value: input.status } }
      : null,
    input.stage && input.stage !== "All"
      ? { key: "stage", match: { value: input.stage } }
      : null,
  ].filter(Boolean);

  return must.length ? { must } : undefined;
}

export async function POST(request: Request) {
  const parsed = SearchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid search input.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const ideaText = buildIdeaText(parsed.data);
    const qdrant = getQdrantClient();
    const results = await qdrant.query(COLLECTION_NAME, {
      query: {
        text: ideaText,
        model: INFERENCE_MODEL,
      },
      limit: parsed.data.limit,
      with_payload: true,
      filter: buildFilter(parsed.data),
      score_threshold:
        parsed.data.mode === "competitors"
          ? 0.28
          : parsed.data.mode === "alternatives"
            ? 0.2
            : 0.12,
    });

    const analyses = await analyzeMatches({
      ideaText,
      matches: results.points.map((result: { id: string | number; score: number; payload?: unknown }) => ({
        id: Number(result.id),
        score: result.score,
        payload: result.payload,
      })),
    });

    return Response.json({
      query: {
        mode: parsed.data.mode,
        filters: {
          industry: parsed.data.industry ?? "All",
          status: parsed.data.status ?? "All",
          stage: parsed.data.stage ?? "All",
        },
      },
      results: results.points.map((result: { id: string | number; score: number; payload?: unknown }) => ({
        id: Number(result.id),
        score: result.score,
        payload: result.payload,
        analysis: analyses.find((analysis) => analysis.id === Number(result.id)),
      })),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Search failed. Check your environment variables and Qdrant.",
      },
      { status: 500 },
    );
  }
}
