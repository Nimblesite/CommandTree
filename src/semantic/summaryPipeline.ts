/**
 * Registers discovered commands and their content hashes in SQLite.
 * AI summary generation has been removed (issue #20): no Copilot calls remain.
 */

import type { CommandItem } from "../models/TaskItem";
import { ok, err } from "../models/Result";
import type { Result } from "../models/Result";
import { computeContentHash, registerCommand } from "../db/db";
import type { FileSystemAdapter } from "./adapters";
import { initDb } from "../db/lifecycle";

async function readTaskContent(params: {
  readonly task: CommandItem;
  readonly fs: FileSystemAdapter;
}): Promise<string> {
  const result = await params.fs.readFile(params.task.filePath);
  return result.ok ? result.value : params.task.command;
}

export async function registerAllCommands(params: {
  readonly tasks: readonly CommandItem[];
  readonly workspaceRoot: string;
  readonly fs: FileSystemAdapter;
}): Promise<Result<number, string>> {
  const initResult = await initDb(params.workspaceRoot);
  if (!initResult.ok) {
    return err(initResult.error);
  }
  const handle = initResult.value;

  let registered = 0;
  for (const task of params.tasks) {
    const content = await readTaskContent({ task, fs: params.fs });
    const hash = computeContentHash(content);
    registerCommand({
      handle,
      commandId: task.id,
      contentHash: hash,
    });
    registered++;
  }
  return ok(registered);
}
