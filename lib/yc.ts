export type YcCompany = {
  id: number;
  name: string;
  slug?: string;
  small_logo_thumb_url?: string;
  website?: string;
  all_locations?: string;
  long_description?: string;
  one_liner?: string;
  team_size?: number;
  industry?: string;
  subindustry?: string;
  launched_at?: number;
  tags?: string[];
  batch?: string;
  status?: string;
  industries?: string[];
  regions?: string[];
  stage?: string;
  isHiring?: boolean;
  url?: string;
};

export type CompanyPayload = {
  yc_id: number;
  name: string;
  slug: string | null;
  logo_url: string | null;
  website: string | null;
  yc_url: string | null;
  one_liner: string;
  long_description: string;
  company_text: string;
  industry: string;
  subindustry: string;
  batch: string;
  status: string;
  stage: string;
  team_size: number | null;
  all_locations: string;
  launched_at: number | null;
  tags: string[];
  industries: string[];
  regions: string[];
  is_hiring: boolean;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function buildCompanyText(company: YcCompany): string {
  const sections = [
    `Company: ${asString(company.name)}`,
    `One-liner: ${asString(company.one_liner)}`,
    `Description: ${asString(company.long_description)}`,
    `Industry: ${asString(company.industry)}`,
    `Subindustry: ${asString(company.subindustry)}`,
    `Tags: ${asStringArray(company.tags).join(", ")}`,
    `Markets: ${asStringArray(company.industries).join(", ")}`,
    `Regions: ${asStringArray(company.regions).join(", ")}`,
  ];

  return sections.filter((section) => !section.endsWith(": ")).join("\n");
}

export function toCompanyPayload(company: YcCompany): CompanyPayload {
  return {
    yc_id: company.id,
    name: asString(company.name),
    slug: asString(company.slug) || null,
    logo_url: asString(company.small_logo_thumb_url) || null,
    website: asString(company.website) || null,
    yc_url: asString(company.url) || null,
    one_liner: asString(company.one_liner),
    long_description: asString(company.long_description),
    company_text: buildCompanyText(company),
    industry: asString(company.industry) || "Unknown",
    subindustry: asString(company.subindustry) || "Unknown",
    batch: asString(company.batch) || "Unknown",
    status: asString(company.status) || "Unknown",
    stage: asString(company.stage) || "Unknown",
    team_size: typeof company.team_size === "number" ? company.team_size : null,
    all_locations: asString(company.all_locations),
    launched_at:
      typeof company.launched_at === "number" ? company.launched_at : null,
    tags: asStringArray(company.tags),
    industries: asStringArray(company.industries),
    regions: asStringArray(company.regions),
    is_hiring: Boolean(company.isHiring),
  };
}

export function buildIdeaText(input: {
  ideaText: string;
  targetUser?: string;
  problem?: string;
  solution?: string;
}): string {
  return [
    input.targetUser ? `Target user: ${input.targetUser}` : "",
    input.problem ? `Problem: ${input.problem}` : "",
    input.solution ? `Solution: ${input.solution}` : "",
    `Idea document: ${input.ideaText}`,
  ]
    .filter(Boolean)
    .join("\n");
}
