import type { ParamDef } from "../models/TaskItem";

export interface ParamValue {
  readonly def: ParamDef;
  readonly value: string;
}

export function formatParam(def: ParamDef, value: string): string {
  const format = def.format ?? "positional";
  switch (format) {
    case "positional": {
      return `"${value}"`;
    }
    case "flag": {
      const flagName = def.flag ?? `--${def.name}`;
      return `${flagName} "${value}"`;
    }
    case "flag-equals": {
      const flagName = def.flag ?? `--${def.name}`;
      return `${flagName}=${value}`;
    }
    case "dashdash-args": {
      return `-- ${value}`;
    }
    default: {
      const exhaustive: never = format;
      return exhaustive;
    }
  }
}

export function buildCommand(baseCommand: string, params: readonly ParamValue[]): string {
  const parts: string[] = [];
  for (const { def, value } of params) {
    if (value === "") {
      continue;
    }
    const formatted = formatParam(def, value);
    if (formatted !== "") {
      parts.push(formatted);
    }
  }
  if (parts.length === 0) {
    return baseCommand;
  }
  return `${baseCommand} ${parts.join(" ")}`;
}
