import { QdrantClient } from "@qdrant/js-client-rest";

const COLLECTION_NAME =
  process.env.QDRANT_COLLECTION ?? "idea_radar_yc_companies";
const DEFAULT_QDRANT_URL = "http://localhost:6333";
const EMBEDDING_SIZE = 384;

let client = null;
let clientSignature = null;

export function getQdrantClient() {
  const normalized = normalizeQdrantConnection(process.env.QDRANT_URL ?? DEFAULT_QDRANT_URL);
  const signature = `${normalized.protocol}//${normalized.host}:${normalized.port}::${process.env.QDRANT_API_KEY ?? ""}`;

  if (!client || clientSignature !== signature) {
    clientSignature = signature;
    client = new QdrantClient({
      host: normalized.host,
      https: normalized.protocol === "https:",
      port: normalized.port,
      apiKey: process.env.QDRANT_API_KEY,
      checkCompatibility: false,
    });
  }

  return client;
}

function normalizeQdrantConnection(rawUrl) {
  const url = new URL(rawUrl);
  return {
    protocol: url.protocol,
    host: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === "https:" ? 6333 : 6333,
  };
}

export async function ensureCompanyCollection() {
  const qdrant = getQdrantClient();
  const exists = await qdrant.collectionExists(COLLECTION_NAME);

  if (exists.exists) {
    const collection = await qdrant.getCollection(COLLECTION_NAME);
    const vectorConfig = collection.config?.params?.vectors;
    const vectorSize =
      typeof vectorConfig === "object" && vectorConfig && "size" in vectorConfig
        ? Number(vectorConfig.size)
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

  await Promise.allSettled(
    ["industry", "status", "stage", "tags"].map((fieldName) =>
      qdrant.createPayloadIndex(COLLECTION_NAME, {
        field_name: fieldName,
        field_schema: "keyword",
        wait: true,
      }),
    ),
  );
}
