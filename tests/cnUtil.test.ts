import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { cn, copyTextToClipboard } from "../client/src/lib/utils";

function resetDomGlobals() {
  delete (globalThis as any).navigator;
  delete (globalThis as any).window;
  delete (globalThis as any).document;
}

beforeEach(() => {
  resetDomGlobals();
  mock.restoreAll();
});

afterEach(() => {
  resetDomGlobals();
  mock.restoreAll();
});

describe("cn utility", () => {
  it("merges conditional classes", () => {
    assert.equal(
      cn("base", ["btn", undefined], { active: true, disabled: false }),
      "base btn active",
    );
  });

  it("returns an empty string with no inputs", () => {
    assert.equal(cn(), "");
  });
});

function createDocumentStub(execSuccess: boolean) {
  const selection = {
    rangeCount: 1,
    getRangeAt: () => ({ cloneRange: () => ({}) }),
    removeAllRanges: () => {
      selection.rangeCount = 0;
    },
    addRange: () => undefined,
  };
  const textarea = {
    value: "",
    style: {} as Record<string, string>,
    setAttribute: () => undefined,
    focus: () => undefined,
    select: () => undefined,
    setSelectionRange: () => undefined,
  };
  return {
    body: {
      appendChild: () => undefined,
      removeChild: () => undefined,
    },
    createElement: () => textarea,
    getSelection: () => selection,
    execCommand: mock.fn(() => execSuccess),
  };
}

describe("copyTextToClipboard", () => {
  it("prefers clipboard API when available", async () => {
    const writeText = mock.fn(async () => undefined);
    (globalThis as any).window = {
      isSecureContext: true,
      location: { hostname: "localhost" },
    };
    (globalThis as any).navigator = {
      clipboard: {
        writeText,
      },
    };

    const result = await copyTextToClipboard("hello");
    assert.equal(result, "copied");
    assert.equal(writeText.mock.callCount(), 1);
  });

  it("falls back to document.execCommand copy when clipboard API fails", async () => {
    (globalThis as any).window = {
      location: { hostname: "localhost" },
      isSecureContext: undefined,
    };
    (globalThis as any).navigator = {
      clipboard: {
        writeText: async () => {
          throw new Error("no clipboard");
        },
      },
    };
    const documentStub = createDocumentStub(true);
    (globalThis as any).document = documentStub;

    const result = await copyTextToClipboard("fallback");
    assert.equal(result, "copied");
    assert.equal(documentStub.execCommand.mock.callCount(), 1);
  });

  it("shows prompt when fallback copy fails", async () => {
    const promptFn = mock.fn(() => undefined);
    (globalThis as any).window = {
      location: { hostname: "localhost" },
      prompt: promptFn,
    };
    const documentStub = createDocumentStub(false);
    (globalThis as any).document = documentStub;

    const result = await copyTextToClipboard("prompt");

    assert.equal(result, "prompt");
    assert.equal(promptFn.mock.callCount(), 1);
    const [message, value] = promptFn.mock.calls[0].arguments;
    assert.ok(String(message).includes("Copy the text"));
    assert.equal(value, "prompt");
  });
});
