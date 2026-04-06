/**
 * TREEVIEW E2E TESTS
 * TODO: No corresponding section in spec
 *
 * Tests tree view behavior by observing CommandTreeItem properties.
 * Verifies click behavior, item rendering, etc.
 */

import * as assert from "assert";
import * as vscode from "vscode";
import {
  activateExtension,
  sleep,
  getCommandTreeProvider,
  getLabelString,
  collectLeafTasks,
  collectLeafItems,
} from "../helpers/helpers";
import { type CommandTreeItem, isCommandItem } from "../../models/TaskItem";

// TODO: No corresponding section in spec
suite("TreeView E2E Tests", () => {
  suiteSetup(async function () {
    this.timeout(30000);
    await activateExtension();
    await sleep(3000);
  });

  /**
   * Searches a node's children and grandchildren for the first command item.
   */
  async function findTaskInCategory(
    provider: ReturnType<typeof getCommandTreeProvider>,
    category: CommandTreeItem
  ): Promise<CommandTreeItem | undefined> {
    const children = await provider.getChildren(category);
    for (const child of children) {
      if (isCommandItem(child.data)) {
        return child;
      }
      const grandChildren = await provider.getChildren(child);
      const match = grandChildren.find((gc) => isCommandItem(gc.data));
      if (match !== undefined) {
        return match;
      }
    }
    return undefined;
  }

  /**
   * Finds the first task item (leaf node with a task) in the tree.
   */
  async function findFirstTaskItem(): Promise<CommandTreeItem | undefined> {
    const provider = getCommandTreeProvider();
    const categories = await provider.getChildren();

    for (const category of categories) {
      const found = await findTaskInCategory(provider, category);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }

  // TODO: No corresponding section in spec
  suite("Click Behavior", () => {
    test("clicking a task item opens the file in editor, NOT runs it", async function () {
      this.timeout(15000);

      const taskItem = await findFirstTaskItem();
      assert.ok(taskItem !== undefined, "Should find at least one task item in the tree");
      assert.ok(taskItem.command !== undefined, "Task item should have a click command");
      assert.strictEqual(
        taskItem.command.command,
        "vscode.open",
        "Clicking a task MUST open the file (vscode.open), NOT run it (commandtree.run)"
      );
      // Non-quick task must have 'task' contextValue so the EMPTY star icon shows
      assert.strictEqual(
        taskItem.contextValue,
        "task",
        "Non-quick task MUST have contextValue 'task' (empty star icon)"
      );
    });

    test("click command points to the task file path", async function () {
      this.timeout(15000);

      const taskItem = await findFirstTaskItem();
      assert.ok(taskItem !== undefined, "Should find a task item");
      assert.ok(taskItem.command !== undefined, "Should have click command");

      const args = taskItem.command.arguments;
      assert.ok(args !== undefined && args.length > 0, "Click command should have arguments (file URI)");

      const uri = args[0] as { fsPath?: string; scheme?: string };
      assert.ok(
        uri.fsPath !== undefined && uri.fsPath !== "",
        "Click command argument should be a file URI with fsPath"
      );
      assert.strictEqual(uri.scheme, "file", "URI scheme should be 'file'");
    });
  });

  suite("Folder Hierarchy", () => {
    test("root-level items appear directly under category — no Root folder node", async function () {
      this.timeout(15000);
      const provider = getCommandTreeProvider();
      const categories = await provider.getChildren();

      for (const category of categories) {
        const topChildren = await provider.getChildren(category);
        for (const child of topChildren) {
          const label = getLabelString(child.label);
          assert.notStrictEqual(
            label,
            "Root",
            `Category "${getLabelString(category.label)}" must NOT have a "Root" folder — root items should appear directly under the category`
          );
        }
      }
    });

    test("folders must come before files in tree — normal file/folder rules", async function () {
      this.timeout(15000);
      const provider = getCommandTreeProvider();
      const categories = await provider.getChildren();
      const shellCategory = categories.find((c) => getLabelString(c.label).includes("Shell Scripts"));
      assert.ok(shellCategory !== undefined, "Should find Shell Scripts category");

      const topChildren = await provider.getChildren(shellCategory);
      const mixedFolder = topChildren.find(
        (c) =>
          !isCommandItem(c.data) &&
          c.children.some((gc) => isCommandItem(gc.data)) &&
          c.children.some((gc) => !isCommandItem(gc.data))
      );
      assert.ok(mixedFolder !== undefined, "Should find a folder containing both files and subfolders");

      const kids = mixedFolder.children;
      let seenTask = false;
      for (const child of kids) {
        if (isCommandItem(child.data)) {
          seenTask = true;
        } else {
          assert.ok(!seenTask, "Folder node must not appear after a file node — folders come first");
        }
      }
    });
  });

  suite("Make Target Line Navigation", () => {
    test("clicking a make target opens the Makefile at the target's line", async function () {
      this.timeout(15000);
      const provider = getCommandTreeProvider();
      const allItems = await collectLeafItems(provider);
      const makeItems = allItems.filter((i) => isCommandItem(i.data) && i.data.type === "make");
      assert.ok(makeItems.length > 0, "Should discover at least one make target");

      for (const item of makeItems) {
        assert.ok(isCommandItem(item.data), "Item data must be a CommandItem");
        assert.ok(item.data.line !== undefined, `Make target "${item.data.label}" must have a line number`);
        assert.ok(item.data.line > 0, `Make target "${item.data.label}" line must be positive`);

        assert.ok(item.command !== undefined, "Make target must have a click command");
        assert.strictEqual(item.command.command, "vscode.open", "Click must use vscode.open");
        const args = item.command.arguments;
        assert.ok(args !== undefined && args.length === 2, "Click command must have URI and options arguments");

        const uri = args[0] as vscode.Uri;
        assert.ok(uri.fsPath.endsWith("Makefile"), "URI must point to a Makefile");

        const options = args[1] as { selection: vscode.Range };
        assert.ok(options.selection !== undefined, "Options must include a selection range");
        assert.strictEqual(
          options.selection.start.line,
          item.data.line - 1,
          `Selection must start at line ${item.data.line - 1} (0-indexed) for target "${item.data.label}"`
        );
      }
    });

    test("make targets have correct line numbers matching the Makefile", async function () {
      this.timeout(15000);
      const provider = getCommandTreeProvider();
      const allTasks = await collectLeafTasks(provider);
      const makeTasks = allTasks.filter((t) => t.type === "make");

      // Verify specific targets from the fixture Makefile
      const allTarget = makeTasks.find((t) => t.label === "all");
      assert.ok(allTarget !== undefined, "Should find 'all' target");
      assert.strictEqual(allTarget.line, 3, "'all' target is on line 3 of the fixture Makefile");

      const buildTarget = makeTasks.find((t) => t.label === "build");
      assert.ok(buildTarget !== undefined, "Should find 'build' target");
      assert.strictEqual(buildTarget.line, 5, "'build' target is on line 5 of the fixture Makefile");

      const testTarget = makeTasks.find((t) => t.label === "test");
      assert.ok(testTarget !== undefined, "Should find 'test' target");
      assert.strictEqual(testTarget.line, 8, "'test' target is on line 8 of the fixture Makefile");

      const cleanTarget = makeTasks.find((t) => t.label === "clean");
      assert.ok(cleanTarget !== undefined, "Should find 'clean' target");
      assert.strictEqual(cleanTarget.line, 11, "'clean' target is on line 11 of the fixture Makefile");
    });
  });

  suite("AI Summaries", () => {
    test("@exclude-ci Copilot summarisation produces summaries for discovered tasks", async function () {
      this.timeout(15000);
      const provider = getCommandTreeProvider();
      // AI summaries: extension activation triggers summarisation via Copilot.
      // If Copilot auth fails (GitHubLoginFailed), tasks will have no summaries.
      // This MUST fail if the integration is broken.
      const allTasks = await collectLeafTasks(provider);
      const withSummary = allTasks.filter((t) => t.summary !== undefined && t.summary !== "");
      assert.ok(
        withSummary.length > 0,
        `Copilot summarisation must produce summaries — got 0 out of ${allTasks.length} tasks. ` +
          "Check for GitHubLoginFailed errors above."
      );
    });
  });
});
