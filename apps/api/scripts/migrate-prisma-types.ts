/**
 * migrate-prisma-types.ts
 *
 * Replaces every local `type PrismaExecutor = PrismaClient | Prisma.TransactionClient`
 * (or the `PrismaLike` variant) with an import from the canonical prisma-types.ts.
 *
 * Handles:
 *  - lib/*.ts files: import from "./prisma-types.js"
 *  - services/*.ts files: import from "../lib/prisma-types.js"
 *  - routes/**\/*.ts simple union: import from "../../lib/prisma-types.js" (depth-adjusted)
 *
 * Skips:
 *  - lib/prisma-types.ts itself
 *  - lib/hobby-presets.ts (narrow Prisma.TransactionClient — handled separately)
 *  - routes/comments/index.ts and routes/hobbies/projects.ts (structural Pick types)
 *
 * Renames PrismaLike → PrismaExecutor in function signatures in the same pass.
 */

import { readFileSync, writeFileSync } from "fs";
import { readdirSync, statSync } from "fs";
import { join, relative } from "path";

const DRY_RUN = process.argv.includes("--dry-run");

function walkDir(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) result.push(...walkDir(full));
    else if (full.endsWith(".ts")) result.push(full);
  }
  return result;
}

const apiSrc = join(process.cwd(), "apps/api/src");

// Files to skip entirely
const SKIP = new Set([
  join(apiSrc, "lib/prisma-types.ts"),
  join(apiSrc, "lib/hobby-presets.ts"),
  join(apiSrc, "routes/comments/index.ts"),
  join(apiSrc, "routes/hobbies/projects.ts"),
]);

// Patterns for the local type definition (one-liner)
// Matches: type PrismaExecutor = PrismaClient | Prisma.TransactionClient;
//      or: type PrismaLike = PrismaClient | Prisma.TransactionClient;
const LOCAL_TYPE_PATTERN =
  /^(type (PrismaExecutor|PrismaLike) = PrismaClient \| Prisma\.TransactionClient;?\s*)$/m;

function getImportPath(filePath: string): string {
  const fileDir = filePath.replace(/\\/g, "/").slice(0, filePath.replace(/\\/g, "/").lastIndexOf("/"));
  const libDir = join(apiSrc, "lib").replace(/\\/g, "/");
  const servicesDir = join(apiSrc, "services").replace(/\\/g, "/");
  const routesDir = join(apiSrc, "routes").replace(/\\/g, "/");

  if (fileDir === libDir) return "./prisma-types.js";
  if (fileDir === servicesDir) return "../lib/prisma-types.js";
  if (fileDir.startsWith(routesDir)) {
    const rel = fileDir.slice(routesDir.length + 1);  // e.g. "households" or ""
    const depth = rel === "" ? 0 : rel.split("/").length;
    return "../".repeat(depth + 1) + "lib/prisma-types.js";
  }
  // fallback
  const relPath = relative(fileDir, libDir).replace(/\\/g, "/");
  return relPath + "/prisma-types.js";
}

function findImportSectionEnd(lines: string[]): number {
  let last = -1;
  let inImport = false;
  for (let i = 0; i < lines.length; i++) {
    if (inImport) {
      if (lines[i].includes(";")) { last = i; inImport = false; }
      continue;
    }
    if (/^\s*$/.test(lines[i])) continue;
    if (/^\s*\/\//.test(lines[i])) continue;
    if (/^\s*\/\*/.test(lines[i])) continue;
    if (/^\s*\*/.test(lines[i])) continue;
    if (/^import /.test(lines[i])) {
      if (lines[i].includes(";")) last = i;
      else inImport = true;
      continue;
    }
    break;
  }
  return last;
}

const allFiles = walkDir(apiSrc);
let changedCount = 0;

for (const filePath of allFiles) {
  if (SKIP.has(filePath)) continue;

  const content = readFileSync(filePath, "utf-8");

  // Quick pre-check
  if (!LOCAL_TYPE_PATTERN.test(content)) continue;

  const match = LOCAL_TYPE_PATTERN.exec(content);
  if (!match) continue;

  const localTypeName = match[2] as "PrismaExecutor" | "PrismaLike";
  const importPath = getImportPath(filePath.replace(/\\/g, "/"));

  let result = content;

  // 1. Remove the local type definition line
  result = result.replace(LOCAL_TYPE_PATTERN, "");

  // 2. Rename PrismaLike → PrismaExecutor in function signatures (if needed)
  if (localTypeName === "PrismaLike") {
    result = result.replace(/\bPrismaLike\b/g, "PrismaExecutor");
  }

  // 3. Remove the `PrismaClient` import if it was only used for the type alias
  //    Count usages OUTSIDE of import lines
  const nonImportContent = afterTypeRemoval.replace(/^import [^\n]+\n/gm, "");
  const prismaClientUsagesOutsideImports = (nonImportContent.match(/\bPrismaClient\b/g) || []).length;

  // Only remove PrismaClient from imports if it's not used anywhere else in the file body
  if (prismaClientUsagesOutsideImports === 0) {
    // Try to remove `PrismaClient` from the existing Prisma client import line
    const prismaImportRegex = /^(import type \{)([^}]+)(\} from "@prisma\/client";)/m;
    const prismaImportMatch = prismaImportRegex.exec(result);

    if (prismaImportMatch) {
      const importedNames = prismaImportMatch[2].split(",").map(s => s.trim()).filter(Boolean);
      const filteredNames = importedNames.filter(n => n !== "PrismaClient");

      if (filteredNames.length === 0) {
        // Remove the entire import line
        result = result.replace(prismaImportMatch[0] + "\n", "");
        result = result.replace(prismaImportMatch[0], "");
      } else {
        // Rebuild import without PrismaClient
        result = result.replace(
          prismaImportMatch[0],
          `${prismaImportMatch[1]} ${filteredNames.join(", ")} ${prismaImportMatch[3]}`
        );
      }
    }
  }

  // 4. Add the canonical import
  const newImportLine = `import type { PrismaExecutor } from "${importPath}";`;

  // Check if a prisma-types import already exists (shouldn't, but be safe)
  if (result.includes('"./prisma-types.js"') || result.includes('"../lib/prisma-types.js"')) {
    // Already imported, skip adding
  } else {
    const lines = result.split("\n");
    const insertAfter = findImportSectionEnd(lines);
    if (insertAfter >= 0) {
      lines.splice(insertAfter + 1, 0, newImportLine);
    } else {
      lines.unshift(newImportLine);
    }
    result = lines.join("\n");
  }

  // 5. Clean up any trailing blank lines introduced by the deletion
  result = result.replace(/\n{3,}/g, "\n\n");

  if (result === content) continue;

  const rel = relative(apiSrc, filePath).replace(/\\/g, "/");
  console.log(`✓ ${rel} (was: ${localTypeName}, importPath: ${importPath})`);

  if (!DRY_RUN) {
    writeFileSync(filePath, result, "utf-8");
  }
  changedCount++;
}

console.log(`\nDone. ${changedCount} file(s) updated.`);
if (DRY_RUN) console.log("(dry-run mode — no files written)");
