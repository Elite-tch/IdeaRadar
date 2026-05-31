import { readFile } from "node:fs/promises";
import path from "node:path";
import { ensureCompanyCollection, getQdrantClient } from "../lib/qdrant-runtime.js";

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, "data", "yc-companies-all.json");

await loadEnvFile(path.join(ROOT, ".env.local"));
await loadEnvFile(path.join(ROOT, ".env"));

const COLLECTION = process.env.QDRANT_COLLECTION ?? "idea_radar_yc_companies";
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const INFERENCE_MODEL =
  process.env.QDRANT_INFERENCE_MODEL ?? "sentence-transformers/all-MiniLM-L6-v2";
const UPSERT_BATCH_SIZE = 64;

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg
  ? Number(limitArg.replace("--limit=", ""))
  : Number(process.env.INGEST_LIMIT ?? process.env.npm_config_limit);

process.env.QDRANT_URL ??= QDRANT_URL;
const qdrant = getQdrantClient();

const raw = await readFile(DATA_FILE, "utf8");
const companies = JSON.parse(raw)
  .filter((company) => company?.id && company?.name)
  .slice(0, Number.isFinite(limit) ? limit : undefined);

console.log(`Preparing ${companies.length} YC companies for ${COLLECTION}.`);
console.log(`Using Qdrant at ${new URL(QDRANT_URL).host}.`);
console.log(`Using Qdrant Cloud Inference model: ${INFERENCE_MODEL}.`);
await ensureCompanyCollection();

let embedded = 0;
for (let index = 0; index < companies.length; index += UPSERT_BATCH_SIZE) {
  const batch = companies.slice(index, index + UPSERT_BATCH_SIZE);
  const points = batch.map((company) => ({
    id: company.id,
    vector: {
      text: buildCompanyText(company),
      model: INFERENCE_MODEL,
    },
    payload: toPayload(company),
  }));

  await upsertWithRetry(points);

  embedded += batch.length;
  console.log(`Upserted ${embedded}/${companies.length}`);
}

console.log("YC corpus ingestion complete.");

async function loadEnvFile(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  } catch {
    // Env files are optional.
  }
}

async function upsertWithRetry(points, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await qdrant.upsert(COLLECTION, {
        wait: true,
        points,
      });
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }

      const delayMs = 5000 * attempt;
      console.log(`Qdrant upsert retry ${attempt + 1}/${attempts} after ${delayMs / 1000}s.`);
      await sleep(delayMs);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function buildCompanyText(company) {
  return [
    `Company: ${cleanString(company.name)}`,
    `One-liner: ${cleanString(company.one_liner)}`,
    `Description: ${cleanString(company.long_description)}`,
    `Industry: ${cleanString(company.industry)}`,
    `Subindustry: ${cleanString(company.subindustry)}`,
    `Tags: ${cleanArray(company.tags).join(", ")}`,
    `Markets: ${cleanArray(company.industries).join(", ")}`,
    `Regions: ${cleanArray(company.regions).join(", ")}`,
  ]
    .filter((section) => !section.endsWith(": "))
    .join("\n");
}

function toPayload(company) {
  return {
    yc_id: company.id,
    name: cleanString(company.name),
    slug: cleanString(company.slug) || null,
    logo_url: cleanString(company.small_logo_thumb_url) || null,
    website: cleanString(company.website) || null,
    yc_url: cleanString(company.url) || null,
    one_liner: cleanString(company.one_liner),
    long_description: cleanString(company.long_description),
    company_text: buildCompanyText(company),
    industry: cleanString(company.industry) || "Unknown",
    subindustry: cleanString(company.subindustry) || "Unknown",
    batch: cleanString(company.batch) || "Unknown",
    status: cleanString(company.status) || "Unknown",
    stage: cleanString(company.stage) || "Unknown",
    team_size: typeof company.team_size === "number" ? company.team_size : null,
    all_locations: cleanString(company.all_locations),
    launched_at: typeof company.launched_at === "number" ? company.launched_at : null,
    tags: cleanArray(company.tags),
    industries: cleanArray(company.industries),
    regions: cleanArray(company.regions),
    is_hiring: Boolean(company.isHiring),
  };
}
