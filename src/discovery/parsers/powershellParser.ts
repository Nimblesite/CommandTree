/**
 * Pure parsing functions for PowerShell and Batch scripts.
 * No vscode dependency — safe for unit testing.
 */

interface ParsedParam {
  readonly name: string;
  readonly description?: string;
  readonly default?: string;
}

const PARAM_COMMENT_PREFIX = "# @param ";
const PARAM_BLOCK_KEYWORD = "param";
const DEFAULT_PREFIX = "(default:";
const DOLLAR_SIGN = "$";
const BLOCK_COMMENT_START = "<#";
const BLOCK_COMMENT_END = "#>";
const SINGLE_COMMENT = "#";

function extractDefault(desc: string): { cleanDesc: string; defaultVal: string | undefined } {
  const lower = desc.toLowerCase();
  const start = lower.indexOf(DEFAULT_PREFIX);
  if (start === -1) {
    return { cleanDesc: desc, defaultVal: undefined };
  }
  const end = desc.indexOf(")", start + DEFAULT_PREFIX.length);
  if (end === -1) {
    return { cleanDesc: desc, defaultVal: undefined };
  }
  const defaultVal = desc.slice(start + DEFAULT_PREFIX.length, end).trim();
  const cleanDesc = (desc.slice(0, start) + desc.slice(end + 1)).trim();
  return { cleanDesc, defaultVal: defaultVal === "" ? undefined : defaultVal };
}

function parseParamComment(line: string): ParsedParam | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith(PARAM_COMMENT_PREFIX)) {
    return undefined;
  }
  const rest = trimmed.slice(PARAM_COMMENT_PREFIX.length).trim();
  const spaceIdx = rest.indexOf(" ");
  const paramName = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);
  const descText = spaceIdx === -1 ? "" : rest.slice(spaceIdx + 1);
  if (paramName === "") {
    return undefined;
  }
  const { cleanDesc, defaultVal } = extractDefault(descText);
  return {
    name: paramName,
    ...(cleanDesc !== "" ? { description: cleanDesc } : {}),
    ...(defaultVal !== undefined ? { default: defaultVal } : {}),
  };
}

function extractParamBlock(content: string): string | undefined {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(PARAM_BLOCK_KEYWORD);
  if (idx === -1) {
    return undefined;
  }
  const afterKeyword = content.slice(idx + PARAM_BLOCK_KEYWORD.length).trimStart();
  if (!afterKeyword.startsWith("(")) {
    return undefined;
  }
  const closeIdx = afterKeyword.indexOf(")");
  if (closeIdx === -1) {
    return undefined;
  }
  return afterKeyword.slice(1, closeIdx);
}

function isWordChar(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c === "_";
}

function takeWord(s: string): string {
  let i = 0;
  while (i < s.length) {
    const c = s.charAt(i);
    if (!isWordChar(c)) {
      break;
    }
    i++;
  }
  return s.slice(0, i);
}

function extractParamBlockVars(block: string, existing: ParsedParam[]): ParsedParam[] {
  const results: ParsedParam[] = [];
  let remaining = block;
  while (remaining.includes(DOLLAR_SIGN)) {
    const dollarIdx = remaining.indexOf(DOLLAR_SIGN);
    const afterDollar = remaining.slice(dollarIdx + 1);
    const varName = takeWord(afterDollar);
    remaining = afterDollar.slice(varName.length);
    if (varName === "") {
      continue;
    }
    const alreadyExists = existing.some((p) => p.name.toLowerCase() === varName.toLowerCase());
    if (!alreadyExists) {
      results.push({ name: varName });
    }
  }
  return results;
}

export function parsePowerShellParams(content: string): ParsedParam[] {
  const lines = content.split("\n");
  const params: ParsedParam[] = [];
  for (const line of lines) {
    const param = parseParamComment(line);
    if (param !== undefined) {
      params.push(param);
    }
  }
  const block = extractParamBlock(content);
  if (block !== undefined) {
    params.push(...extractParamBlockVars(block, params));
  }
  return params;
}

function stripBlockEnd(text: string): string {
  const endIdx = text.indexOf(BLOCK_COMMENT_END);
  return endIdx === -1 ? text : text.slice(0, endIdx);
}

function handleBlockLine(trimmed: string): { done: boolean; result: string | undefined } {
  if (trimmed.includes(BLOCK_COMMENT_END)) {
    const desc = trimmed.slice(0, trimmed.indexOf(BLOCK_COMMENT_END)).trim();
    return { done: true, result: desc === "" ? undefined : desc };
  }
  if (!trimmed.startsWith(".") && trimmed !== "") {
    return { done: true, result: trimmed };
  }
  return { done: false, result: undefined };
}

function handleBlockStart(trimmed: string): string | undefined {
  const afterStart = trimmed.slice(BLOCK_COMMENT_START.length).trim();
  if (afterStart !== "" && !afterStart.startsWith(".")) {
    return stripBlockEnd(afterStart).trim();
  }
  return undefined;
}

function extractSingleLineDesc(trimmed: string): string | undefined {
  const afterHash = trimmed.slice(SINGLE_COMMENT.length);
  const desc = afterHash.startsWith(" ") ? afterHash.slice(1).trim() : afterHash.trim();
  if (desc === "" || desc.startsWith("@") || desc.startsWith(".")) {
    return undefined;
  }
  return desc;
}

function scanBlockForDescription(lines: readonly string[], startIdx: number): string | undefined {
  const remaining = lines.slice(startIdx);
  for (const line of remaining) {
    const { done, result } = handleBlockLine(line.trim());
    if (done) {
      return result;
    }
  }
  return undefined;
}

function scanOutsideBlock(lines: readonly string[]): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) {
      break;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith(BLOCK_COMMENT_START)) {
      const inlineDesc = handleBlockStart(trimmed);
      if (inlineDesc !== undefined && inlineDesc !== "") {
        return inlineDesc;
      }
      return scanBlockForDescription(lines, i + 1);
    }
    if (trimmed === "") {
      continue;
    }
    if (trimmed.startsWith(SINGLE_COMMENT)) {
      const desc = extractSingleLineDesc(trimmed);
      if (desc !== undefined) {
        return desc;
      }
      continue;
    }
    break;
  }
  return undefined;
}

export function parsePowerShellDescription(content: string): string | undefined {
  return scanOutsideBlock(content.split("\n"));
}

export function parseBatchDescription(content: string): string | undefined {
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }
    if (trimmed.toLowerCase().startsWith("@echo")) {
      continue;
    }
    if (trimmed.toLowerCase().startsWith("rem ")) {
      const desc = trimmed.slice(4).trim();
      return desc === "" ? undefined : desc;
    }
    if (trimmed.startsWith("::")) {
      const desc = trimmed.slice(2).trim();
      return desc === "" ? undefined : desc;
    }
    break;
  }

  return undefined;
}
