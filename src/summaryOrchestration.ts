/**
 * Registers discovered commands in SQLite and refreshes views after task changes.
 * AI summary generation has been removed (issue #20): no Copilot calls happen here.
 */
import type { CommandTreeProvider } from "./CommandTreeProvider";
import type { QuickTasksProvider } from "./QuickTasksProvider";
import { logger } from "./utils/logger";
import { registerAllCommands } from "./semantic/summaryPipeline";
import { createVSCodeFileSystem } from "./semantic/vscodeAdapters";

export interface SummaryDeps {
  readonly workspaceRoot: string;
  readonly treeProvider: CommandTreeProvider;
  readonly quickTasksProvider: QuickTasksProvider;
}

export async function registerDiscoveredCommands(params: SummaryDeps): Promise<void> {
  const tasks = params.treeProvider.getAllTasks();
  if (tasks.length === 0) {
    return;
  }
  const result = await registerAllCommands({
    tasks,
    workspaceRoot: params.workspaceRoot,
    fs: createVSCodeFileSystem(),
  });
  if (!result.ok) {
    logger.warn("Command registration failed", { error: result.error });
    return;
  }
  logger.info("Commands registered in DB", { count: result.value });
}

export async function syncAndSummarise(params: SummaryDeps): Promise<void> {
  await params.treeProvider.refresh();
  params.quickTasksProvider.updateTasks(params.treeProvider.getAllTasks());
  await registerDiscoveredCommands(params);
}
