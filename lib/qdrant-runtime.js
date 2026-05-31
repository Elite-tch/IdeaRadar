import { QdrantClient } from "@qdrant/js-client-rest";

const COLLECTION_NAME =
  process.env.QDRANT_COLLECTION ?? "idea_radar_yc_companies";
const DEFAULT_QDRANT_URL = "http://localhost:6333";
const EMBEDDING_SIZE = 384;
const IMAGE_EMBEDDING_SIZE = 512;

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
    const sparseConfig = collection.config?.params?.sparse_vectors;
    const denseSize =
      typeof vectorConfig === "object" && vectorConfig && "dense" in vectorConfig
        ? Number(vectorConfig.dense?.size)
        : undefined;
    const visualSize =
      typeof vectorConfig === "object" && vectorConfig && "visual" in vectorConfig
        ? Number(vectorConfig.visual?.size)
        : undefined;
    const hasSparseKeywords = Boolean(
      sparseConfig && typeof sparseConfig === "object" && "keywords" in sparseConfig,
    );

    if (denseSize !== EMBEDDING_SIZE || visualSize !== IMAGE_EMBEDDING_SIZE || !hasSparseKeywords) {
      await qdrant.deleteCollection(COLLECTION_NAME, {});
    }
  }

  const currentExists = await qdrant.collectionExists(COLLECTION_NAME);

  if (!currentExists.exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        dense: {
          size: EMBEDDING_SIZE,
          distance: "Cosine",
        },
        visual: {
          size: IMAGE_EMBEDDING_SIZE,
          distance: "Cosine",
        },
      },
      sparse_vectors: {
        keywords: {
          sparse: {
            modifier: "idf",
          },
        },
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
