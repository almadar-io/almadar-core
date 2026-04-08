#!/usr/bin/env npx tsx
/**
 * build-lolo-type-metadata.ts
 *
 * Walks @almadar/core's own `src/types/*.ts` source files with the
 * TypeScript Compiler API and extracts a runtime-importable metadata
 * snapshot used by `@almadar-tools/lolo-types-sync`.
 *
 * Output: `src/generated/lolo-type-metadata.ts` — a TypeScript module
 * exporting `LOLO_TYPE_METADATA`, then re-exported from the package's
 * `index.ts`. Consumers `import { LOLO_TYPE_METADATA } from '@almadar/core'`
 * and never read the package's source files directly.
 *
 * Run on demand whenever `field.ts`, `entity.ts`, `trait.ts`, `effect.ts`,
 * or `bindings.ts` changes:
 *
 *     npx tsx scripts/build-lolo-type-metadata.ts
 *
 * The output file is committed to git so the package ships ready-to-import
 * metadata without requiring consumers (or CI) to run the script.
 *
 * This script is the inverse of the old workspace-reading pattern in
 * `tools/almadar-lolo-types-sync/src/readers/read-core.ts`. The extraction
 * logic was relocated INTO the package that owns the source files; the
 * tool now consumes the result via a normal npm import.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const TYPES_DIR = path.join(PKG_ROOT, "src", "types");
const OUTPUT_FILE = path.join(PKG_ROOT, "src", "generated", "lolo-type-metadata.ts");

// ============================================================================
// Output shape
// ============================================================================

interface EnumDef {
  name: string;
  values: string[];
  source: string;
}

interface StructFieldDef {
  name: string;
  type: string;
  optional: boolean;
}

interface StructDef {
  name: string;
  fields: StructFieldDef[];
  source: string;
}

interface BindingRulesDef {
  guard: string[];
  effect: string[];
  tick: string[];
  source: string;
}

interface EffectTupleParam {
  name: string;
  type: string;
  optional: boolean;
}

interface EffectTupleSignature {
  operator: string;
  params: EffectTupleParam[];
  variadic: boolean;
}

interface EffectOperatorDef {
  name: string;
  minArity: number;
  maxArity: number | null;
  params: EffectTupleParam[];
  description: string;
  source: string;
}

interface LoloTypeMetadata {
  generatedAt: string;
  enums: EnumDef[];
  structs: StructDef[];
  bindingRules: BindingRulesDef;
  effectOperators: EffectOperatorDef[];
}

// ============================================================================
// Type expression rendering
// ============================================================================

function renderTypeNode(node: ts.TypeNode | undefined, sourceFile: ts.SourceFile): string {
  if (!node) return "any";
  if (node.kind === ts.SyntaxKind.StringKeyword) return "string";
  if (node.kind === ts.SyntaxKind.NumberKeyword) return "number";
  if (node.kind === ts.SyntaxKind.BooleanKeyword) return "boolean";
  if (node.kind === ts.SyntaxKind.AnyKeyword) return "any";
  if (node.kind === ts.SyntaxKind.UnknownKeyword) return "any";
  if (node.kind === ts.SyntaxKind.VoidKeyword) return "void";
  if (node.kind === ts.SyntaxKind.NullKeyword) return "null";
  if (node.kind === ts.SyntaxKind.UndefinedKeyword) return "undefined";

  if (ts.isArrayTypeNode(node)) {
    return `[${renderTypeNode(node.elementType, sourceFile)}]`;
  }
  if (ts.isUnionTypeNode(node)) {
    const parts: string[] = [];
    for (const member of node.types) {
      if (member.kind === ts.SyntaxKind.UndefinedKeyword) continue;
      if (member.kind === ts.SyntaxKind.NullKeyword) continue;
      parts.push(renderTypeNode(member, sourceFile));
    }
    if (parts.length === 0) return "any";
    if (parts.length === 1) return parts[0];
    return parts.join(" | ");
  }
  if (ts.isLiteralTypeNode(node)) {
    if (ts.isStringLiteral(node.literal)) return `"${node.literal.text}"`;
    if (ts.isNumericLiteral(node.literal)) return node.literal.text;
    if (node.literal.kind === ts.SyntaxKind.TrueKeyword) return "true";
    if (node.literal.kind === ts.SyntaxKind.FalseKeyword) return "false";
    return "any";
  }
  if (ts.isTypeReferenceNode(node)) {
    return node.typeName.getText(sourceFile);
  }
  if (ts.isParenthesizedTypeNode(node)) {
    return renderTypeNode(node.type, sourceFile);
  }
  if (ts.isTupleTypeNode(node)) {
    const parts = node.elements.map((e) => renderTypeNode(e, sourceFile));
    return `[${parts.join(", ")}]`;
  }
  if (ts.isFunctionTypeNode(node)) return "function";
  if (ts.isTypeLiteralNode(node)) return "object";
  return "any";
}

// ============================================================================
// Enum extraction
// ============================================================================

function extractStringUnionFromAlias(decl: ts.TypeAliasDeclaration): string[] | null {
  const node = decl.type;
  if (ts.isUnionTypeNode(node)) {
    const values: string[] = [];
    for (const member of node.types) {
      if (ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal)) {
        values.push(member.literal.text);
      } else {
        return null;
      }
    }
    return values;
  }
  return null;
}

function extractStringArrayFromConst(stmt: ts.VariableStatement): { name: string; values: string[] } | null {
  for (const decl of stmt.declarationList.declarations) {
    if (!decl.initializer) continue;
    let init: ts.Expression = decl.initializer;
    if (ts.isAsExpression(init)) init = init.expression;
    if (!ts.isArrayLiteralExpression(init)) continue;

    const values: string[] = [];
    let allStrings = true;
    for (const el of init.elements) {
      if (ts.isStringLiteral(el)) {
        values.push(el.text);
      } else {
        allStrings = false;
        break;
      }
    }
    if (!allStrings) continue;

    const name = ts.isIdentifier(decl.name) ? decl.name.text : null;
    if (!name) continue;
    return { name, values };
  }
  return null;
}

function extractEnumsFromFile(
  sourceFile: ts.SourceFile,
  filePath: string,
  wantedNames: Set<string>,
  constArrayBacks: Record<string, string>,
): EnumDef[] {
  const enums: EnumDef[] = [];
  const constArrays = new Map<string, { values: string[]; line: number }>();

  for (const stmt of sourceFile.statements) {
    if (ts.isVariableStatement(stmt)) {
      const result = extractStringArrayFromConst(stmt);
      if (result) {
        const line = sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1;
        constArrays.set(result.name, { values: result.values, line });
      }
    }
  }

  for (const stmt of sourceFile.statements) {
    if (!ts.isTypeAliasDeclaration(stmt)) continue;
    const name = stmt.name.text;
    if (!wantedNames.has(name)) continue;

    const line = sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1;
    const relPath = path.relative(PKG_ROOT, filePath);

    const directValues = extractStringUnionFromAlias(stmt);
    if (directValues && directValues.length > 0) {
      enums.push({ name, values: directValues, source: `${relPath}:${line}` });
      continue;
    }

    const constName = constArrayBacks[name];
    if (constName) {
      const arr = constArrays.get(constName);
      if (arr) {
        enums.push({ name, values: arr.values, source: `${relPath}:${arr.line}` });
        continue;
      }
    }
  }

  return enums;
}

// ============================================================================
// Struct extraction (EntityField)
// ============================================================================

function extractStructFromInterface(
  sourceFile: ts.SourceFile,
  filePath: string,
  interfaceName: string,
): StructDef | null {
  for (const stmt of sourceFile.statements) {
    if (!ts.isInterfaceDeclaration(stmt)) continue;
    if (stmt.name.text !== interfaceName) continue;

    const line = sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1;
    const fields: StructFieldDef[] = [];

    for (const member of stmt.members) {
      if (!ts.isPropertySignature(member)) continue;
      if (!member.name) continue;
      const name = member.name.getText(sourceFile);
      const type = renderTypeNode(member.type, sourceFile);
      const optional = !!member.questionToken;
      fields.push({ name, type, optional });
    }

    return {
      name: interfaceName,
      fields,
      source: `${path.relative(PKG_ROOT, filePath)}:${line}`,
    };
  }
  return null;
}

// ============================================================================
// Binding rules extraction
// ============================================================================

function extractBindingRules(
  sourceFile: ts.SourceFile,
  filePath: string,
): BindingRulesDef {
  const result: BindingRulesDef = {
    guard: [],
    effect: [],
    tick: [],
    source: path.relative(PKG_ROOT, filePath),
  };

  for (const stmt of sourceFile.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== "BINDING_CONTEXT_RULES") continue;
      if (!decl.initializer) continue;

      let init: ts.Expression = decl.initializer;
      if (ts.isAsExpression(init)) init = init.expression;
      if (!ts.isObjectLiteralExpression(init)) continue;

      const line = sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1;
      result.source = `${path.relative(PKG_ROOT, filePath)}:${line}`;

      for (const prop of init.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const key = prop.name.getText(sourceFile);
        if (!ts.isObjectLiteralExpression(prop.initializer)) continue;

        for (const inner of prop.initializer.properties) {
          if (!ts.isPropertyAssignment(inner)) continue;
          const innerKey = inner.name.getText(sourceFile);
          if (innerKey !== "allowed") continue;

          let arrExpr: ts.Expression = inner.initializer;
          if (ts.isAsExpression(arrExpr)) arrExpr = arrExpr.expression;
          if (!ts.isArrayLiteralExpression(arrExpr)) continue;

          const values: string[] = [];
          for (const el of arrExpr.elements) {
            if (ts.isStringLiteral(el)) values.push(el.text);
          }
          if (key === "guard") result.guard = values;
          else if (key === "effect") result.effect = values;
          else if (key === "tick") result.tick = values;
        }
      }
    }
  }

  return result;
}

// ============================================================================
// Effect tuple extraction
// ============================================================================

function extractSignaturesFromEffectAlias(
  decl: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
): EffectTupleSignature[] {
  const signatures: EffectTupleSignature[] = [];

  function visitTuple(tuple: ts.TupleTypeNode): void {
    if (tuple.elements.length === 0) return;
    const first = tuple.elements[0];

    let operator: string | null = null;
    if (ts.isLiteralTypeNode(first) && ts.isStringLiteral(first.literal)) {
      operator = first.literal.text;
    } else if (
      ts.isNamedTupleMember(first) &&
      ts.isLiteralTypeNode(first.type) &&
      ts.isStringLiteral(first.type.literal)
    ) {
      operator = first.type.literal.text;
    }
    if (operator === null) return;

    const params: EffectTupleParam[] = [];
    let variadic = false;
    for (let i = 1; i < tuple.elements.length; i++) {
      const el = tuple.elements[i];
      if (ts.isRestTypeNode(el)) {
        variadic = true;
        const inner = el.type;
        const typeStr = ts.isArrayTypeNode(inner)
          ? renderTypeNode(inner.elementType, sourceFile)
          : renderTypeNode(inner, sourceFile);
        params.push({ name: `args${i}`, type: typeStr, optional: false });
        break;
      }
      let typeNode: ts.TypeNode = el;
      let name = `arg${i}`;
      let optional = false;
      if (ts.isNamedTupleMember(el)) {
        if (el.questionToken) optional = true;
        name = el.name.text;
        typeNode = el.type;
        if (ts.isRestTypeNode(typeNode)) {
          variadic = true;
          const inner = typeNode.type;
          const typeStr = ts.isArrayTypeNode(inner)
            ? renderTypeNode(inner.elementType, sourceFile)
            : renderTypeNode(inner, sourceFile);
          params.push({ name, type: typeStr, optional: false });
          break;
        }
      } else if (ts.isOptionalTypeNode(el)) {
        optional = true;
        typeNode = el.type;
      }
      params.push({ name, type: renderTypeNode(typeNode, sourceFile), optional });
    }

    signatures.push({ operator, params, variadic });
  }

  function visitTypeNode(node: ts.TypeNode): void {
    if (ts.isTupleTypeNode(node)) {
      visitTuple(node);
      return;
    }
    if (ts.isUnionTypeNode(node)) {
      for (const member of node.types) visitTypeNode(member);
      return;
    }
    if (ts.isParenthesizedTypeNode(node)) {
      visitTypeNode(node.type);
      return;
    }
  }

  visitTypeNode(decl.type);
  return signatures;
}

function unifySignatures(
  operator: string,
  signatures: EffectTupleSignature[],
  effectAliasName: string,
  filePath: string,
  line: number,
): EffectOperatorDef {
  let minArity = Number.MAX_SAFE_INTEGER;
  let maxArity = 0;
  let variadic = false;
  let canonical: EffectTupleSignature | null = null;

  for (const sig of signatures) {
    const len = sig.params.length;
    if (len < minArity) minArity = len;
    if (len > maxArity) maxArity = len;
    if (sig.variadic) variadic = true;
    if (!canonical || sig.params.length > canonical.params.length) {
      canonical = sig;
    }
  }
  if (minArity === Number.MAX_SAFE_INTEGER) minArity = 0;

  const params: EffectTupleParam[] = canonical
    ? canonical.params.map((p, i) => ({
        name: p.name,
        type: p.type,
        optional: p.optional || i >= minArity,
      }))
    : [];

  return {
    name: operator,
    minArity,
    maxArity: variadic ? null : maxArity,
    params,
    description: `Effect tuple from ${effectAliasName}`,
    source: `${path.relative(PKG_ROOT, filePath)}:${line} ${effectAliasName}`,
  };
}

function extractEffectOperators(sourceFile: ts.SourceFile, filePath: string): EffectOperatorDef[] {
  const byOperator = new Map<string, EffectTupleSignature[]>();
  const aliasMeta = new Map<string, { name: string; line: number }>();

  for (const stmt of sourceFile.statements) {
    if (!ts.isTypeAliasDeclaration(stmt)) continue;
    if (!stmt.name.text.endsWith("Effect")) continue;
    if (stmt.name.text === "TypedEffect") continue;
    if (stmt.name.text === "Effect") continue;

    const line = sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1;
    const sigs = extractSignaturesFromEffectAlias(stmt, sourceFile);
    for (const sig of sigs) {
      if (!byOperator.has(sig.operator)) {
        byOperator.set(sig.operator, []);
        aliasMeta.set(sig.operator, { name: stmt.name.text, line });
      }
      byOperator.get(sig.operator)!.push(sig);
    }
  }

  const operators: EffectOperatorDef[] = [];
  for (const [operator, sigs] of byOperator) {
    const meta = aliasMeta.get(operator)!;
    operators.push(unifySignatures(operator, sigs, meta.name, filePath, meta.line));
  }
  return operators;
}

// ============================================================================
// Main
// ============================================================================

function loadSource(filePath: string): ts.SourceFile {
  const text = fs.readFileSync(filePath, "utf-8");
  return ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function main(): void {
  const fieldFile = path.join(TYPES_DIR, "field.ts");
  const entityFile = path.join(TYPES_DIR, "entity.ts");
  const traitFile = path.join(TYPES_DIR, "trait.ts");
  const effectFile = path.join(TYPES_DIR, "effect.ts");
  const bindingsFile = path.join(TYPES_DIR, "bindings.ts");

  const wantedNames = new Set([
    "FieldType",
    "FieldFormat",
    "EntityPersistence",
    "TraitCategory",
    "EventScope",
    "RelationCardinality",
    "UISlot",
  ]);
  const constArrayBacks: Record<string, string> = {
    UISlot: "UI_SLOTS",
  };

  const fieldSf = loadSource(fieldFile);
  const entitySf = loadSource(entityFile);
  const traitSf = loadSource(traitFile);
  const effectSf = loadSource(effectFile);
  const bindingsSf = loadSource(bindingsFile);

  const enums: EnumDef[] = [];
  enums.push(...extractEnumsFromFile(fieldSf, fieldFile, wantedNames, constArrayBacks));
  enums.push(...extractEnumsFromFile(entitySf, entityFile, wantedNames, constArrayBacks));
  enums.push(...extractEnumsFromFile(traitSf, traitFile, wantedNames, constArrayBacks));
  enums.push(...extractEnumsFromFile(effectSf, effectFile, wantedNames, constArrayBacks));
  enums.sort((a, b) => a.name.localeCompare(b.name, "en"));

  const structs: StructDef[] = [];
  const entityField = extractStructFromInterface(fieldSf, fieldFile, "EntityField");
  if (entityField) structs.push(entityField);

  const bindingRules = extractBindingRules(bindingsSf, bindingsFile);
  const effectOperators = extractEffectOperators(effectSf, effectFile);
  effectOperators.sort((a, b) => a.name.localeCompare(b.name, "en"));

  const metadata: LoloTypeMetadata = {
    generatedAt: new Date().toISOString(),
    enums,
    structs,
    bindingRules,
    effectOperators,
  };

  const tsHeader = `/**
 * lolo-type-metadata.ts
 *
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * Regenerate with:
 *   cd packages/almadar-core && npx tsx scripts/build-lolo-type-metadata.ts
 *
 * This module ships @almadar/core's type metadata as a runtime constant
 * so consumers like @almadar-tools/lolo-types-sync can import it via the
 * package's public API instead of walking workspace source files.
 */

`;
  const tsBody = `export const LOLO_TYPE_METADATA = ${JSON.stringify(metadata, null, 2)} as const;

export type LoloTypeMetadata = typeof LOLO_TYPE_METADATA;
`;

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, tsHeader + tsBody, "utf-8");

  console.log(`✓ wrote ${path.relative(PKG_ROOT, OUTPUT_FILE)}`);
  console.log(`  enums: ${metadata.enums.length}`);
  console.log(`  structs: ${metadata.structs.length}`);
  console.log(`  effect operators: ${metadata.effectOperators.length}`);
  console.log(`  binding rules: guard=${metadata.bindingRules.guard.length} effect=${metadata.bindingRules.effect.length} tick=${metadata.bindingRules.tick.length}`);
}

main();
