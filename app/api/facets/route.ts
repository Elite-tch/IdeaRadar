import { COLLECTION_NAME } from "@/lib/config";
import { getQdrantClient } from "@/lib/qdrant-runtime.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function facetValues(key: string) {
  const qdrant = getQdrantClient();
  const response = await qdrant.facet(COLLECTION_NAME, {
    key,
    limit: 200,
    exact: true,
  });

  const values = response.hits
    .map((hit: { value: string | number | boolean }) => hit.value)
    .filter((value: string | number | boolean): value is string => typeof value === "string" && value.trim().length > 0)
    .sort((first: string, second: string) => first.localeCompare(second));

  return ["All", ...values];
}

export async function GET() {
  try {
    const qdrant = getQdrantClient();
    const [collection, industries, statuses, stages] = await Promise.all([
      qdrant.getCollection(COLLECTION_NAME),
      facetValues("industry"),
      facetValues("status"),
      facetValues("stage"),
    ]);

    return Response.json({
      industries,
      statuses,
      stages,
      totalCompanies: collection.points_count ?? 0,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load facets from Qdrant.",
        industries: ["All"],
        statuses: ["All"],
        stages: ["All"],
        totalCompanies: 0,
      },
      { status: 500 },
    );
  }
}
