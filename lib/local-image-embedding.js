import { pipeline } from "@xenova/transformers";

const MODEL_ID = "Xenova/clip-vit-base-patch32";

let extractorPromise;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("image-feature-extraction", MODEL_ID, {
      quantized: true,
    });
  }

  return extractorPromise;
}

export async function embedImage(source) {
  if (typeof source !== "string" || !source.trim()) {
    return null;
  }

  const extractor = await getExtractor();
  try {
    const output = await extractor(source, { pooling: "mean", normalize: true });
    const vector = Array.isArray(output) ? output : typeof output.tolist === "function" ? output.tolist() : null;

    if (Array.isArray(vector) && Array.isArray(vector[0])) {
      return vector[0];
    }

    if (Array.isArray(vector)) {
      return vector;
    }

    if (output?.data && Array.isArray(output.data)) {
      return output.data;
    }

    return null;
  } catch {
    return null;
  }
}
