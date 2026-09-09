#!/usr/bin/env node
/**
 * Theme regression guard.
 *
 * Fails the build if a retired colour value reappears in the codebase.
 * These values belong to the old dark-navy/gold theme and to a set of
 * greys that failed WCAG AA contrast on a light ground. They were removed
 * deliberately; if one comes back it is almost always a copy-paste from an
 * old file or a stale snippet.
 *
 * Escape hatch: put `theme-allow` in a comment on the same line. Use it
 * only where the value is genuinely correct (e.g. a light-on-dark element),
 * and say why.
 *
 *   npm run check:theme
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "lib", "components", "scripts"];
const EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js", ".mjs", ".css"]);

// Backups kept intentionally until the redesign is verified live.
const SKIP = [
  /node_modules/,
  /[\\/]\.next[\\/]/,
  /app[\\/]page-old-backup\.tsx$/,
  /app[\\/]preview[\\/]/,
  /scripts[\\/]check-theme\.mjs$/, // this file lists the values on purpose
];

const ALLOW_MARKER = "theme-allow";

/** Retired exact colour values -> why they were retired. */
const RETIRED = {
  "#0E1320": "legacy navy page ground",
  "#141A2E": "legacy navy page ground",
  "#1C2438": "legacy navy card surface",
  "#2A3350": "legacy navy border",
  "#1E2A4A": "legacy navy section",
  "#141E38": "legacy navy section",
  "#19203A": "legacy navy section",
  "#180F2A": "legacy navy section",
  "#3A2550": "legacy navy section",
  "#C9A24B": "legacy gold accent (use #7C3AED)",
  "#F7F5EF": "legacy cream text (use #12101A on light)",
  "#AAB1C4": "legacy muted text (use #6B6577)",
  // greys that failed AA on white
  "#9A94A8": "2.93:1 on white (use #6B6577)",
  "#8A8598": "2.9:1 on white (use #6B6577)",
  "#B0AABE": "2.25:1 on white (use #6B6577)",
  "#8F8998": "3.4:1 on white (use #6B6577)",
  "#7A7488": "4.5:1 borderline (use #6B6577)",
  "#94A3B8": "2.6:1 on white (use #64748B or #6B6577)",
};

/** Retired patterns (regex source, description). */
const RETIRED_PATTERNS = [
  [String.raw`rgba\(\s*201\s*,\s*162\s*,\s*75\s*,`, "legacy gold rgba (use rgba(124,58,237,…))"],
];

const hexAlternation = Object.keys(RETIRED)
  .map((h) => h.slice(1))
  .join("|");
const RETIRED_RE = new RegExp(
  `#(?:${hexAlternation})\\b|${RETIRED_PATTERNS.map(([p]) => p).join("|")}`,
  "gi"
);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (SKIP.some((re) => re.test(full))) continue;
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) out.push(full);
  }
  return out;
}

function describe(match) {
  const upper = match.toUpperCase();
  if (RETIRED[upper]) return RETIRED[upper];
  for (const [pattern, why] of RETIRED_PATTERNS) {
    if (new RegExp(pattern, "i").test(match)) return why;
  }
  return "retired value";
}

const violations = [];
for (const file of SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return;
    const found = line.match(RETIRED_RE);
    if (found) {
      for (const m of new Set(found)) {
        violations.push({ file: relative(ROOT, file), line: i + 1, value: m, why: describe(m) });
      }
    }
  });
}

if (violations.length === 0) {
  console.log("✓ theme guard: no retired colour values found");
  process.exit(0);
}

console.error(`\n✗ theme guard: ${violations.length} retired colour value(s) found\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}`);
  console.error(`    ${v.value}  — ${v.why}`);
}
console.error(
  `\nThese belong to the retired theme. Replace them with the current palette,\n` +
    `or if the usage is genuinely correct add a "${ALLOW_MARKER}" comment on that line\n` +
    `explaining why.\n`
);
process.exit(1);
