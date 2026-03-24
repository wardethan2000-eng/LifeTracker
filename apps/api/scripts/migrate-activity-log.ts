/**
 * migrate-activity-log.ts
 *
 * Node.js migration script that transforms:
 *   - Isolated `await logActivity(app.prisma, { ... })` blocks
 *     → `await createActivityLogger(app.prisma, userId).log(et, id, action, hid, meta)`
 *   - `await Promise.all([logActivity(...), emitDomainEvent(...)])` pairs
 *     → `await logAndEmit(app.prisma, userId, { ... })`
 *
 * Usage: npx tsx apps/api/scripts/migrate-activity-log.ts [--dry-run]
 */

import { readFileSync, writeFileSync } from "fs";
import { readdirSync, statSync } from "fs";
import { join, relative } from "path";

const DRY_RUN = process.argv.includes("--dry-run");

// -------------------------------------------------------------------
// File walker
// -------------------------------------------------------------------
function walkDir(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      result.push(...walkDir(full));
    } else if (full.endsWith(".ts")) {
      result.push(full);
    }
  }
  return result;
}

// -------------------------------------------------------------------
// Extract a balanced-brace block starting at `startLine` / `startCol`
// Returns the raw block text and the index of the last char consumed.
// -------------------------------------------------------------------
function extractBalancedBlock(content: string, openBracePos: number): { block: string; end: number } {
  let depth = 0;
  let i = openBracePos;
  let inString: string | null = null;

  while (i < content.length) {
    const ch = content[i];

    if (inString) {
      if (ch === "\\" && inString !== "`") { i += 2; continue; }
      if (ch === inString) inString = null;
    } else {
      if (ch === '"' || ch === "'" || ch === "`") { inString = ch; }
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return { block: content.slice(openBracePos, i + 1), end: i };
      }
    }
    i++;
  }
  throw new Error(`Unbalanced braces starting at ${openBracePos}`);
}

// -------------------------------------------------------------------
// Parse logActivity call args from the inner object text:
//   { householdId: ..., userId: ..., action: ..., entityType: ..., entityId: ..., metadata?: ... }
// Returns null if the block doesn't match the expected structure.
// -------------------------------------------------------------------
interface LogActivityArgs {
  prismaArg: string;
  householdId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: string | null;
  /** original indentation of the `await logActivity(` line */
  indent: string;
}

function parseLogActivityArgs(
  outerArgs: string   // everything between the outer `(` and `)` of logActivity(...)
): { prismaArg: string; rest: string } | null {
  // outerArgs = `app.prisma, { householdId: ..., ... }`
  const commaIdx = outerArgs.indexOf(",");
  if (commaIdx === -1) return null;
  const prismaArg = outerArgs.slice(0, commaIdx).trim();
  const rest = outerArgs.slice(commaIdx + 1).trim();
  return { prismaArg, rest };
}

function parseInnerObject(obj: string): Map<string, string> | null {
  // obj = `{ householdId: hid, userId: uid, ... }` or shorthand `{ householdId, userId, ... }`
  const body = obj.trim();
  if (!body.startsWith("{") || !body.endsWith("}")) return null;
  const inner = body.slice(1, -1).trim();

  const result = new Map<string, string>();

  // We need to parse key: value pairs where value can be a nested object or expression.
  // Also handles shorthand `{ key, }` where value === key.
  let i = 0;
  while (i < inner.length) {
    // skip whitespace and commas
    while (i < inner.length && /[\s,]/.test(inner[i])) i++;
    if (i >= inner.length) break;

    // read key (up to `:` or `,` or end of object)
    let keyStart = i;
    while (i < inner.length && inner[i] !== ":" && inner[i] !== "," && inner[i] !== "\n") i++;

    const key = inner.slice(keyStart, i).trim();
    if (!key) { i++; continue; }

    if (i >= inner.length || inner[i] !== ":") {
      // shorthand property: value = key
      result.set(key, key);
      continue;
    }

    i++; // skip ':'

    // skip whitespace
    while (i < inner.length && inner[i] === " ") i++;

    // read value – may be a nested object, array, string, or expression
    let value = "";
    if (inner[i] === "{") {
      // balanced brace extraction
      try {
        const { block, end } = extractBalancedBlock(inner, i);
        value = block;
        i = end + 1;
      } catch {
        return null;
      }
    } else if (inner[i] === "[") {
      // balanced bracket
      let depth = 0;
      let start = i;
      while (i < inner.length) {
        if (inner[i] === "[") depth++;
        else if (inner[i] === "]") { depth--; if (depth === 0) { i++; break; } }
        i++;
      }
      value = inner.slice(start, i);
    } else {
      // read until comma at depth 0 (but account for strings)
      let start = i;
      let inStr: string | null = null;
      while (i < inner.length) {
        const ch = inner[i];
        if (inStr) {
          if (ch === "\\" && inStr !== "`") { i += 2; continue; }
          if (ch === inStr) inStr = null;
        } else {
          if (ch === '"' || ch === "'" || ch === "`") inStr = ch;
          else if (ch === ",") break;
          else if (ch === "\n") break; // in case of no trailing comma
        }
        i++;
      }
      value = inner.slice(start, i).trim();
    }

    result.set(key, value.trim());
  }

  return result;
}

// -------------------------------------------------------------------
// Generate the createActivityLogger call
// -------------------------------------------------------------------
function buildLoggerCall(args: LogActivityArgs): string {
  const { prismaArg, userId, entityType, entityId, action, householdId, metadata, indent } = args;
  const metaArg = metadata ? `, ${metadata}` : "";
  const call = `await createActivityLogger(${prismaArg}, ${userId}).log(${entityType}, ${entityId}, ${action}, ${householdId}${metaArg});`;

  // If total line length is reasonable, keep single line
  return `${indent}${call}`;
}

// -------------------------------------------------------------------
// Main transformation: process one file's content
// -------------------------------------------------------------------
function transformContent(content: string, filePath: string): { result: string; changed: boolean; usesLogAndEmit: boolean; usesCreateActivityLogger: boolean } {
  let result = content;
  let usesLogAndEmit = false;
  let usesCreateActivityLogger = false;

  // ---- Pass 1: logAndEmit (Promise.all pairs) ----
  // Pattern:
  //   await Promise.all([
  //     logActivity(prisma, { hid, uid, action, et, eid, meta }),
  //     emitDomainEvent(prisma, { hid, eventType, et, eid, payload })
  //   ]);
  //
  // We find `await Promise.all([` and scan to extract both inner calls.
  
  const promiseAllPattern = /await Promise\.all\(\[/g;
  const positions: number[] = [];
  {
    let m: RegExpExecArray | null;
    while ((m = promiseAllPattern.exec(result)) !== null) {
      positions.push(m.index);
    }
  }

  // Process in reverse so positions stay valid
  for (let pi = positions.length - 1; pi >= 0; pi--) {
    const pos = positions[pi];
    // Find the opening `[`
    const openBracket = result.indexOf("[", pos + "await Promise.all(".length - 1);
    if (openBracket === -1) continue;

    // Find the matching `]`
    let depth = 0;
    let closePos = -1;
    let inStr: string | null = null;
    for (let i = openBracket; i < result.length; i++) {
      const ch = result[i];
      if (inStr) {
        if (ch === "\\" && inStr !== "`") { i++; continue; }
        if (ch === inStr) inStr = null;
      } else {
        if (ch === '"' || ch === "'" || ch === "`") inStr = ch;
        else if (ch === "[") depth++;
        else if (ch === "]") { depth--; if (depth === 0) { closePos = i; break; } }
      }
    }
    if (closePos === -1) continue;

    // Check that the array close is immediately followed by `);`
    const afterClose = result.slice(closePos + 1).match(/^(\s*)\)\s*;/);
    if (!afterClose) continue;

    const fullMatchEnd = closePos + 1 + afterClose[0].length;
    const fullMatch = result.slice(pos, fullMatchEnd);

    // Check it contains logActivity and emitDomainEvent
    if (!fullMatch.includes("logActivity(") || !fullMatch.includes("emitDomainEvent(")) continue;

    // Extract logActivity call
    const laIdx = fullMatch.indexOf("logActivity(");
    const laOpenParen = laIdx + "logActivity".length;
    // Find matching paren for logActivity(
    let laArgs = "";
    {
      let d = 0;
      let start = -1;
      let end = -1;
      let inS: string | null = null;
      for (let i = laOpenParen; i < fullMatch.length; i++) {
        const ch = fullMatch[i];
        if (inS) {
          if (ch === "\\" && inS !== "`") { i++; continue; }
          if (ch === inS) inS = null;
        } else {
          if (ch === '"' || ch === "'" || ch === "`") inS = ch;
          else if (ch === "(") { if (d === 0) start = i + 1; d++; }
          else if (ch === ")") { d--; if (d === 0) { end = i; break; } }
        }
      }
      if (start === -1 || end === -1) continue;
      laArgs = fullMatch.slice(start, end);
    }

    // Extract emitDomainEvent call
    const deIdx = fullMatch.indexOf("emitDomainEvent(");
    const deOpenParen = deIdx + "emitDomainEvent".length;
    let deArgs = "";
    {
      let d = 0;
      let start = -1;
      let end = -1;
      let inS: string | null = null;
      for (let i = deOpenParen; i < fullMatch.length; i++) {
        const ch = fullMatch[i];
        if (inS) {
          if (ch === "\\" && inS !== "`") { i++; continue; }
          if (ch === inS) inS = null;
        } else {
          if (ch === '"' || ch === "'" || ch === "`") inS = ch;
          else if (ch === "(") { if (d === 0) start = i + 1; d++; }
          else if (ch === ")") { d--; if (d === 0) { end = i; break; } }
        }
      }
      if (start === -1 || end === -1) continue;
      deArgs = fullMatch.slice(start, end);
    }

    // Parse logActivity args
    const laParsed = parseLogActivityArgs(laArgs);
    if (!laParsed) continue;
    const laFields = parseInnerObject(laParsed.rest);
    if (!laFields) continue;

    const hid = laFields.get("householdId");
    const uid = laFields.get("userId");
    const action = laFields.get("action");
    const et = laFields.get("entityType");
    const eid = laFields.get("entityId");
    const meta = laFields.get("metadata");

    if (!hid || !uid || !action || !et || !eid) continue;

    // Parse emitDomainEvent args to cross-check
    const deParsed = parseLogActivityArgs(deArgs);
    if (!deParsed) continue;
    const deFields = parseInnerObject(deParsed.rest);
    if (!deFields) continue;

    const deHid = deFields.get("householdId");
    const deEventType = deFields.get("eventType");
    const deEt = deFields.get("entityType");
    const deEid = deFields.get("entityId");
    const dePayload = deFields.get("payload");

    if (!deHid || !deEventType || !deEt || !deEid) continue;

    // Get the indentation of the original `await Promise.all` line
    const lineStart = result.lastIndexOf("\n", pos) + 1;
    const indent = result.slice(lineStart, pos).match(/^(\s*)/)?.[1] ?? "";

    // Build logAndEmit call
    const needsSeparatePayload = dePayload && dePayload !== meta;
    const needsSeparateEventType = deEventType !== action;

    let lines = [
      `${indent}await logAndEmit(${laParsed.prismaArg}, ${uid}, {`,
      `${indent}  householdId: ${hid},`,
      `${indent}  entityType: ${et},`,
      `${indent}  entityId: ${eid},`,
      `${indent}  action: ${action},`,
    ];
    if (meta) {
      lines.push(`${indent}  metadata: ${meta},`);
    }
    if (needsSeparateEventType) {
      lines.push(`${indent}  eventType: ${deEventType},`);
    }
    if (needsSeparatePayload) {
      lines.push(`${indent}  payload: ${dePayload},`);
    }
    lines.push(`${indent}});`);

    const replacement = lines.join("\n");

    result = result.slice(0, pos) + replacement + result.slice(fullMatchEnd);
    usesLogAndEmit = true;
  }

  // ---- Pass 2: isolated logActivity calls ----
  // Pattern: `await logActivity(prisma, { hid, uid, action, et, eid[, meta] })`
  // Can span multiple lines.
  
  const laPattern = /await logActivity\(/g;
  const laPositions: number[] = [];
  {
    let m: RegExpExecArray | null;
    while ((m = laPattern.exec(result)) !== null) {
      laPositions.push(m.index);
    }
  }

  for (let pi = laPositions.length - 1; pi >= 0; pi--) {
    const pos = laPositions[pi];

    // Find the opening paren
    const openParen = pos + "await logActivity(".length - 1;

    // Extract balanced paren content
    let argsContent = "";
    let argsEnd = -1;
    {
      let d = 0;
      let start = -1;
      let inS: string | null = null;
      for (let i = openParen; i < result.length; i++) {
        const ch = result[i];
        if (inS) {
          if (ch === "\\" && inS !== "`") { i++; continue; }
          if (ch === inS) inS = null;
        } else {
          if (ch === '"' || ch === "'" || ch === "`") inS = ch;
          else if (ch === "(") { if (d === 0) start = i + 1; d++; }
          else if (ch === ")") {
            d--;
            if (d === 0) {
              argsContent = result.slice(start, i);
              argsEnd = i;
              break;
            }
          }
        }
      }
    }

    if (argsEnd === -1) continue;

    // Check for trailing semicolon
    let callEnd = argsEnd + 1;
    const afterCallMatch = result.slice(callEnd).match(/^(\s*;)/);
    if (afterCallMatch) {
      callEnd += afterCallMatch[1].length;
    } else {
      // must end with `;`
      continue;
    }

    // Parse the args
    const parsed = parseLogActivityArgs(argsContent);
    if (!parsed) continue;
    const fields = parseInnerObject(parsed.rest);
    if (!fields) continue;

    const hid = fields.get("householdId");
    const uid = fields.get("userId");
    const action = fields.get("action");
    const et = fields.get("entityType");
    const eid = fields.get("entityId");
    const meta = fields.get("metadata");

    if (!hid || !uid || !action || !et || !eid) continue;

    // Get indentation
    const lineStart = result.lastIndexOf("\n", pos) + 1;
    const indent = result.slice(lineStart, pos).match(/^(\s*)/)?.[1] ?? "";

    const args: LogActivityArgs = {
      prismaArg: parsed.prismaArg,
      userId: uid,
      householdId: hid,
      action,
      entityType: et,
      entityId: eid,
      metadata: meta || null,
      indent,
    };

    const replacement = buildLoggerCall(args);
    result = result.slice(0, pos) + replacement + result.slice(callEnd);
    usesCreateActivityLogger = true;
  }

  const changed = result !== content;
  return { result, changed, usesLogAndEmit, usesCreateActivityLogger };
}

// -------------------------------------------------------------------
// Import management
// -------------------------------------------------------------------
function updateImports(
  content: string,
  filePath: string,
  usesCreateActivityLogger: boolean,
  usesLogAndEmit: boolean
): string {
  const routesDir = join(process.cwd(), "apps/api/src/routes");
  const fileDir = filePath.slice(0, filePath.lastIndexOf("/"));

  // Determine relative path depth from routes dir
  const rel = relative(routesDir, fileDir).replace(/\\/g, "/");
  const depth = rel === "" || rel === "." ? 0 : rel.split("/").length;
  const prefix = "../".repeat(depth + 1);
  const activityLogPath = `${prefix}lib/activity-log.js`;

  const newHelpers: string[] = [];
  if (usesCreateActivityLogger) newHelpers.push("createActivityLogger");
  if (usesLogAndEmit) newHelpers.push("logAndEmit");

  if (newHelpers.length === 0) return content;

  // Find existing activity-log import
  const existingImportRegex = /import \{([^}]+)\} from "([^"]*lib\/activity-log\.js)";/;
  const match = existingImportRegex.exec(content);

  if (match) {
    const existingNames = match[1].split(",").map(s => s.trim()).filter(Boolean);
    // Remove logActivity if it's no longer used in the file
    const allNames = [...new Set([...existingNames, ...newHelpers])].sort();
    // Keep logActivity if still present
    const finalNames = allNames.filter(n => n !== "logActivity" || content.includes("logActivity("));
    const newImport = `import { ${finalNames.join(", ")} } from "${match[2]}";`;
    content = content.replace(match[0], newImport);
  } else {
    // Add fresh import after the last import line
    const lines = content.split("\n");
    let lastImportLine = -1;
    let inImport = false;
    for (let i = 0; i < lines.length; i++) {
      if (inImport) {
        if (lines[i].includes(";")) { lastImportLine = i; inImport = false; }
        continue;
      }
      if (/^\s*$/.test(lines[i])) continue;
      if (/^\s*\/\//.test(lines[i])) continue;
      if (/^import /.test(lines[i])) {
        if (lines[i].includes(";")) { lastImportLine = i; }
        else { inImport = true; }
        continue;
      }
      break;
    }
    const newImportLine = `import { ${newHelpers.join(", ")} } from "${activityLogPath}";`;
    if (lastImportLine >= 0) {
      lines.splice(lastImportLine + 1, 0, newImportLine);
    } else {
      lines.unshift(newImportLine);
    }
    content = lines.join("\n");
  }

  return content;
}

// -------------------------------------------------------------------
// Entry point
// -------------------------------------------------------------------
const routesDir = join(process.cwd(), "apps/api/src/routes");
const files = walkDir(routesDir);

let totalChanged = 0;
let totalLogAndEmit = 0;
let totalCreateActivityLogger = 0;

for (const filePath of files) {
  const content = readFileSync(filePath, "utf-8");
  const { result, changed, usesLogAndEmit, usesCreateActivityLogger } = transformContent(content, filePath);

  if (!changed) continue;

  let finalContent = updateImports(result, filePath.replace(/\\/g, "/"), usesCreateActivityLogger, usesLogAndEmit);

  const rel = relative(join(process.cwd(), "apps/api/src"), filePath).replace(/\\/g, "/");
  console.log(`✓ ${rel} (logAndEmit=${usesLogAndEmit}, createActivityLogger=${usesCreateActivityLogger})`);

  if (!DRY_RUN) {
    writeFileSync(filePath, finalContent, "utf-8");
  }

  totalChanged++;
  if (usesLogAndEmit) totalLogAndEmit++;
  if (usesCreateActivityLogger) totalCreateActivityLogger++;
}

console.log(`\nDone. ${totalChanged} file(s) updated.`);
console.log(`  logAndEmit migrations: ${totalLogAndEmit}`);
console.log(`  createActivityLogger migrations: ${totalCreateActivityLogger}`);
if (DRY_RUN) console.log("\n(dry-run mode — no files written)");
