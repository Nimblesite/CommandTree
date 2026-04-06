/**
 * SPEC: tagging
 * Tag configuration using exact command ID matching via junction table.
 * All tag data stored in SQLite tags table (junction table design).
 */

import type { CommandItem } from "../models/TaskItem";
import { getDb } from "../db/lifecycle";
import {
  addTagToCommand,
  removeTagFromCommand,
  getCommandIdsByTag,
  getAllTagNames,
  reorderTagCommands,
} from "../db/db";

export class TagConfig {
  private commandTagsMap = new Map<string, string[]>();

  /**
   * SPEC: tagging
   * Loads all tag assignments from SQLite junction table.
   */
  public load(): void {
    const dbResult = getDb();
    if (!dbResult.ok) {
      this.commandTagsMap = new Map();
      return;
    }

    const tagNames = getAllTagNames(dbResult.value);
    const map = new Map<string, string[]>();
    for (const tagName of tagNames) {
      const commandIds = getCommandIdsByTag({ handle: dbResult.value, tagName });
      for (const commandId of commandIds) {
        const tags = map.get(commandId) ?? [];
        tags.push(tagName);
        map.set(commandId, tags);
      }
    }
    this.commandTagsMap = map;
  }

  /**
   * SPEC: tagging
   * Applies tags to tasks using exact command ID matching (no patterns).
   */
  public applyTags(tasks: CommandItem[]): CommandItem[] {
    return tasks.map((task) => {
      const tags = this.commandTagsMap.get(task.id) ?? [];
      return { ...task, tags };
    });
  }

  /**
   * SPEC: tagging
   * Gets all tag names.
   */
  public getTagNames(): string[] {
    const dbResult = getDb();
    if (!dbResult.ok) {
      return [];
    }
    return getAllTagNames(dbResult.value);
  }

  /**
   * SPEC: tagging/management
   * Adds a task to a tag by creating junction record with exact command ID.
   */
  public addTaskToTag(task: CommandItem, tagName: string): void {
    const dbResult = getDb();
    if (!dbResult.ok) {
      return;
    }
    addTagToCommand({ handle: dbResult.value, commandId: task.id, tagName });
    this.load();
  }

  /**
   * SPEC: tagging/management
   * Removes a task from a tag by deleting junction record.
   */
  public removeTaskFromTag(task: CommandItem, tagName: string): void {
    const dbResult = getDb();
    if (!dbResult.ok) {
      return;
    }
    removeTagFromCommand({ handle: dbResult.value, commandId: task.id, tagName });
    this.load();
  }

  /**
   * SPEC: quick-launch
   * Gets ordered command IDs for a tag (ordered by display_order).
   */
  public getOrderedCommandIds(tagName: string): string[] {
    const dbResult = getDb();
    if (!dbResult.ok) {
      return [];
    }
    return getCommandIdsByTag({ handle: dbResult.value, tagName });
  }

  /**
   * SPEC: quick-launch
   * Reorders commands for a tag by updating display_order in junction table.
   */
  public reorderCommands(tagName: string, orderedCommandIds: string[]): void {
    const dbResult = getDb();
    if (!dbResult.ok) {
      return;
    }
    reorderTagCommands({ handle: dbResult.value, tagName, orderedCommandIds });
    this.load();
  }
}
