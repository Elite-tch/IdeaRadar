function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanUrl(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return "";
  }
}

function isGitHubUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "github.com";
  } catch {
    return false;
  }
}

function extractGitHubRepoPath(url) {
  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  return {
    owner: segments[0],
    repo: segments[1].replace(/\.git$/i, ""),
  };
}

function stripHtml(html) {
  return cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function extractMetaContent(html, names) {
  for (const name of names) {
    const regex = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    const match = html.match(regex);
    if (match?.[1]) {
      return cleanText(match[1]);
    }
  }

  return "";
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "IdeaRadar/1.0",
      accept: "text/html,application/json;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not fetch ${url} (${response.status})`);
  }

  return response.text();
}

export async function resolveIdeaSources(input) {
  const sections = [];
  const projectUrl = cleanUrl(input.projectUrl);
  const githubUrl = cleanUrl(input.githubUrl);

  if (input.targetUser) {
    sections.push(`Target user: ${cleanText(input.targetUser)}`);
  }

  if (input.problem) {
    sections.push(`Problem: ${cleanText(input.problem)}`);
  }

  if (input.solution) {
    sections.push(`Solution: ${cleanText(input.solution)}`);
  }

  if (projectUrl) {
    try {
      const html = await fetchText(projectUrl);
      const title = extractMetaContent(html, ["og:title", "twitter:title"]) || /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] || "";
      const description =
        extractMetaContent(html, ["description", "og:description", "twitter:description"]) ||
        "";
      sections.push(
        `Live project URL: ${projectUrl}`,
        title ? `Project title: ${title}` : "",
        description ? `Project description: ${description}` : "",
        `Page summary: ${stripHtml(html).slice(0, 3000)}`,
      );
    } catch {
      sections.push(`Live project URL: ${projectUrl}`, "Project page could not be fetched.");
    }
  }

  if (githubUrl && isGitHubUrl(githubUrl)) {
    try {
      const repo = extractGitHubRepoPath(githubUrl);
      if (!repo) {
        sections.push(`GitHub URL: ${githubUrl}`, "No README found.");
      } else {
        const apiUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/readme`;
        const response = await fetch(apiUrl, {
          headers: {
            "user-agent": "IdeaRadar/1.0",
            accept: "application/vnd.github.raw+json",
          },
        });

        if (!response.ok) {
          sections.push(`GitHub URL: ${githubUrl}`, "No README found.");
        } else {
          const readme = cleanText(await response.text());
          sections.push(
            `GitHub URL: ${githubUrl}`,
            readme ? `README: ${readme.slice(0, 5000)}` : "No README found.",
          );
        }
      }
    } catch {
      sections.push(`GitHub URL: ${githubUrl}`, "No README found.");
    }
  } else if (githubUrl) {
    sections.push(`GitHub URL: ${githubUrl}`, "No README found.");
  }

  return sections.filter(Boolean).join("\n");
}
