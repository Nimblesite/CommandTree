import type { ParamDef } from "../../models/TaskItem";

export interface MiseTask {
  name: string;
  description?: string;
  params: ParamDef[];
}

function parseTomlTaskHeader(trimmed: string): string | undefined {
  const match = /^\[tasks\.([^\]]+)\]$/.exec(trimmed);
  return match?.[1];
}

function parseTomlDescription(trimmed: string): string | undefined {
  const match = /^description\s*=\s*"([^"]*)"/.exec(trimmed);
  return match?.[1];
}

function finishTask(tasks: MiseTask[], current: MiseTask | null): void {
  if (current !== null) {
    tasks.push(current);
  }
}

/**
 * Parses TOML format mise configuration.
 */
export function parseMiseToml(content: string): MiseTask[] {
  const tasks: MiseTask[] = [];
  const lines = content.split("\n");
  let currentTask: MiseTask | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("[tasks.")) {
      finishTask(tasks, currentTask);
      const name = parseTomlTaskHeader(trimmed);
      currentTask = name !== undefined ? { name, params: [] } : null;
      continue;
    }

    if (trimmed.startsWith("[")) {
      finishTask(tasks, currentTask);
      currentTask = null;
      continue;
    }

    if (currentTask !== null && trimmed.startsWith("description")) {
      const desc = parseTomlDescription(trimmed);
      if (desc !== undefined) {
        currentTask.description = desc;
      }
    }
  }

  finishTask(tasks, currentTask);
  return tasks;
}

function parseYamlTaskName(line: string): string | undefined {
  const match = /^\s+([^:]+):\s*$/.exec(line);
  return match?.[1]?.trim();
}

function parseYamlDescription(line: string): string | undefined {
  const match = /^\s+description:\s*["]?([^"]*)["]?\s*$/.exec(line);
  return match?.[1];
}

function isSkippableLine(trimmed: string): boolean {
  return trimmed === "" || trimmed.startsWith("#");
}

function processYamlTaskLine(tasks: MiseTask[], line: string, indent: number): void {
  if (indent === 2 && !line.trim().startsWith("-") && line.includes(":")) {
    const name = parseYamlTaskName(line);
    if (name !== undefined) {
      tasks.push({ name, params: [] });
    }
    return;
  }

  if (indent > 2 && line.includes("description:")) {
    const desc = parseYamlDescription(line);
    const lastTask = tasks[tasks.length - 1];
    if (desc !== undefined && lastTask !== undefined) {
      lastTask.description = desc;
    }
  }
}

/**
 * Parses YAML format mise configuration.
 */
export function parseMiseYaml(content: string): MiseTask[] {
  const tasks: MiseTask[] = [];
  const lines = content.split("\n");
  let inTasks = false;

  for (const line of lines) {
    if (isSkippableLine(line.trim())) {
      continue;
    }

    const indent = line.search(/\S/);

    if (indent === 0 && line.trim() === "tasks:") {
      inTasks = true;
      continue;
    }

    if (inTasks && indent === 0) {
      inTasks = false;
    }

    if (inTasks && indent > 0) {
      processYamlTaskLine(tasks, line, indent);
    }
  }

  return tasks;
}
