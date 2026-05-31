import { QdrantClient } from "@qdrant/js-client-rest";
import { COLLECTION_NAME, DEFAULT_QDRANT_URL, EMBEDDING_SIZE } from "@/lib/config";

let client: QdrantClient | null = null;

export function getQdrantClient() {
  client ??= new QdrantClient({
    url: process.env.QDRANT_URL ?? DEFAULT_QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    checkCompatibility: false,
  });

  return client;
}

export async function ensureCompanyCollection() {
  const qdrant = getQdrantClient();
  const exists = await qdrant.collectionExists(COLLECTION_NAME);

  if (exists.exists) {
    const collection = await qdrant.getCollection(COLLECTION_NAME);
    const vectorConfig = collection.config?.params?.vectors;
    const vectorSize =
      typeof vectorConfig === "object" && vectorConfig && "size" in vectorConfig
        ? Number((vectorConfig as { size?: number }).size)
        : undefined;

    if (vectorSize !== EMBEDDING_SIZE) {
      await qdrant.deleteCollection(COLLECTION_NAME, {});
    }
  }

  const currentExists = await qdrant.collectionExists(COLLECTION_NAME);

  if (!currentExists.exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: EMBEDDING_SIZE,
        distance: "Cosine",
      },
      on_disk_payload: true,
    });
  }

  await Promise.allSettled([
    qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "industry",
      field_schema: "keyword",
      wait: true,
    }),
    qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "status",
      field_schema: "keyword",
      wait: true,
    }),
    qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "stage",
      field_schema: "keyword",
      wait: true,
    }),
    qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "tags",
      field_schema: "keyword",
      wait: true,
    }),
  ]);
}
