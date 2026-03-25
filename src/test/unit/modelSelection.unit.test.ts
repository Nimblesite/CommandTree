import * as assert from "assert";
import { pickConcreteModel, resolveModel, AUTO_MODEL_ID } from "../../semantic/modelSelection";
import type { ModelRef, ModelSelectionDeps } from "../../semantic/modelSelection";

/**
 * PURE UNIT TESTS for model selection logic.
 * Tests pickConcreteModel and resolveModel — no VS Code dependency.
 */
suite("Model Selection Unit Tests", function () {
  this.timeout(5000);

  const GPT4: ModelRef = { id: "gpt-4o", name: "GPT-4o" };
  const CLAUDE: ModelRef = { id: "claude-sonnet", name: "Claude Sonnet" };
  const AUTO: ModelRef = { id: AUTO_MODEL_ID, name: "Auto" };

  suite("pickConcreteModel", function () {
    test("returns specific model when preferredId matches", function () {
      const result = pickConcreteModel({
        models: [GPT4, CLAUDE],
        preferredId: "claude-sonnet",
      });
      assert.strictEqual(result?.id, "claude-sonnet");
      assert.strictEqual(result?.name, "Claude Sonnet");
    });

    test("returns undefined when preferredId not found", function () {
      const result = pickConcreteModel({
        models: [GPT4, CLAUDE],
        preferredId: "nonexistent-model",
      });
      assert.strictEqual(result, undefined);
    });

    test("auto picks first non-auto model", function () {
      const result = pickConcreteModel({
        models: [AUTO, GPT4, CLAUDE],
        preferredId: AUTO_MODEL_ID,
      });
      assert.strictEqual(result?.id, "gpt-4o");
    });

    test("auto falls back to first model if all are auto", function () {
      const result = pickConcreteModel({
        models: [AUTO],
        preferredId: AUTO_MODEL_ID,
      });
      assert.strictEqual(result?.id, AUTO_MODEL_ID);
    });

    test("returns undefined for empty model list", function () {
      const result = pickConcreteModel({
        models: [],
        preferredId: "gpt-4o",
      });
      assert.strictEqual(result, undefined);
    });

    test("auto with empty list returns undefined", function () {
      const result = pickConcreteModel({
        models: [],
        preferredId: AUTO_MODEL_ID,
      });
      assert.strictEqual(result, undefined);
    });
  });

  suite("resolveModel", function () {
    function createDeps(overrides: Partial<ModelSelectionDeps> = {}): ModelSelectionDeps {
      return {
        getSavedId: () => "",
        fetchById: async () => [],
        fetchAll: async () => [GPT4, CLAUDE],
        promptUser: async (models) => models[0],
        saveId: async () => {},
        ...overrides,
      };
    }

    test("uses saved model ID when it exists and fetches successfully", async function () {
      const deps = createDeps({
        getSavedId: () => "claude-sonnet",
        fetchById: async () => [CLAUDE],
      });
      const result = await resolveModel(deps);
      assert.ok(result.ok);
      assert.strictEqual(result.value.id, "claude-sonnet");
    });

    test("prompts user when no saved ID", async function () {
      let prompted = false;
      const deps = createDeps({
        getSavedId: () => "",
        promptUser: async (models) => {
          prompted = true;
          return models[0];
        },
      });
      const result = await resolveModel(deps);
      assert.ok(result.ok);
      assert.ok(prompted, "User must be prompted when no saved ID");
    });

    test("prompts user when saved ID no longer available", async function () {
      let prompted = false;
      const deps = createDeps({
        getSavedId: () => "deleted-model",
        fetchById: async () => [],
        promptUser: async (models) => {
          prompted = true;
          return models[0];
        },
      });
      const result = await resolveModel(deps);
      assert.ok(result.ok);
      assert.ok(prompted, "User must be prompted when saved model is gone");
    });

    test("saves the user's choice after prompting", async function () {
      let savedId = "";
      const deps = createDeps({
        promptUser: async () => CLAUDE,
        saveId: async (id) => {
          savedId = id;
        },
      });
      const result = await resolveModel(deps);
      assert.ok(result.ok);
      assert.strictEqual(savedId, "claude-sonnet", "Chosen model ID must be persisted");
    });

    test("returns error when user cancels picker", async function () {
      const deps = createDeps({
        promptUser: async () => undefined,
      });
      const result = await resolveModel(deps);
      assert.ok(!result.ok);
      assert.strictEqual(result.error, "Model selection cancelled");
    });

    test("returns error when no models available", async function () {
      const deps = createDeps({
        fetchAll: async () => [],
      });
      const result = await resolveModel(deps);
      assert.ok(!result.ok);
      assert.strictEqual(result.error, "No Copilot model available after retries");
    });
  });
});
