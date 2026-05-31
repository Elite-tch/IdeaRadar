import { pipeline, env } from "@xenova/transformers";

env.allowRemoteModels = true;
env.useBrowserCache = false;

const EMBEDDING_MODEL = process.env.LOCAL_EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2";

let embedderPromise = null;

async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline("feature-extraction", EMBEDDING_MODEL, {
      quantized: true,
    });
  }

  return embedderPromise;
}

export async function embedTexts(texts) {
  const embedder = await getEmbedder();
  const embeddings = [];

  for (const text of texts) {
    const output = await embedder(text, {
      pooling: "mean",
      normalize: true,
    });
    embeddings.push(Array.from(output.data));
  }

  return embeddings;
}

export async function embedText(text) {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
