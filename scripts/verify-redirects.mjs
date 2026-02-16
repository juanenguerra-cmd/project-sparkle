import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const redirectsPath = path.resolve("dist/_redirects");

if (!existsSync(redirectsPath)) {
  console.error(
    "ERROR: dist/_redirects missing. Put _redirects in public/ so Vite copies it into dist.",
  );
  process.exit(1);
}

const content = readFileSync(redirectsPath, "utf8");

const rules = content
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"))
  .map((line) => line.split(/\s+/));

const hasRule = (from, to, status) =>
  rules.some((parts) => parts[0] === from && parts[1] === to && parts[2] === status);

const requiredRules = [
  ["/assets/*", "/assets/:splat", "200"],
  ["/index.html", "/index.html", "200"],
  ["/*", "/index.html", "200"],
];

const missingRules = requiredRules.filter(([from, to, status]) => !hasRule(from, to, status));

if (missingRules.length > 0) {
  console.error("ERROR: dist/_redirects is missing required SPA-safe Cloudflare Pages rule(s):");
  for (const [from, to, status] of missingRules) {
    console.error(`  ${from}   ${to}   ${status}`);
  }
  process.exit(1);
}

const hasCatchAllFallback = hasRule("/*", "/index.html", "200");
const hasAssetPassthrough = hasRule("/assets/*", "/assets/:splat", "200");
const hasRootRewrite = hasRule("/", "/index.html", "200");

if (hasCatchAllFallback && !hasAssetPassthrough) {
  console.error(
    "ERROR: Found catch-all SPA fallback (/* /index.html 200) without /assets/* passthrough. This can trigger Cloudflare Pages redirect loop warnings and break static assets.",
  );
  process.exit(1);
}

if (hasRootRewrite) {
  console.error(
    "ERROR: Found unsafe root rewrite rule '/ /index.html 200'. Remove it to avoid Cloudflare Pages infinite loop warnings.",
  );
  process.exit(1);
}

console.log("Redirects verification passed: dist/_redirects contains SPA-safe Cloudflare Pages rules.");
