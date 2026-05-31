export const COLLECTION_NAME =
  process.env.QDRANT_COLLECTION ?? "idea_radar_yc_companies";

export const INFERENCE_MODEL =
  process.env.QDRANT_INFERENCE_MODEL ?? "sentence-transformers/all-MiniLM-L6-v2";

export const EMBEDDING_SIZE = 384;

export const DEFAULT_QDRANT_URL = "http://localhost:6333";
