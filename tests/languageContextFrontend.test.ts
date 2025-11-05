import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  coerceLanguage,
  readLanguageFromStorage,
  persistLanguageToStorage,
  translateKey,
  LanguageProvider,
  useLanguage,
  Language,
} from "../client/src/contexts/language-context.tsx";

describe("language context helpers", () => {
  it("normalizes arbitrary values to supported languages", () => {
    assert.equal(coerceLanguage("hi"), "hi");
    assert.equal(coerceLanguage("unknown"), "en");
    assert.equal(coerceLanguage(null, "ta"), "ta");
  });

  it("reads languages from storage with error handling", () => {
    const storage = {
      getItem(key: string) {
        assert.equal(key, "language");
        return "ta";
      },
    };

    assert.equal(readLanguageFromStorage(storage), "ta");
    assert.equal(readLanguageFromStorage(null), "en");

    const throwingStorage = {
      getItem() {
        throw new Error("boom");
      },
    };

    assert.equal(readLanguageFromStorage(throwingStorage as any, "hi"), "hi");
  });

  it("persists languages to storage safely", () => {
    const writes: Language[] = [];
    const storage = {
      setItem(_key: string, value: string) {
        writes.push(value as Language);
      },
    };

    persistLanguageToStorage(storage, "hi");
    assert.deepEqual(writes, ["hi"]);

    const throwingStorage = {
      setItem() {
        throw new Error("nope");
      },
    };

    assert.doesNotThrow(() => persistLanguageToStorage(throwingStorage as any, "ta"));
  });

  it("translates keys with fallbacks", () => {
    assert.equal(translateKey("hi", "welcome"), "स्वागत है");
    assert.equal(translateKey("hi", "mark_all_read"), "Mark all as read");
    assert.equal(translateKey("hi", "__missing__"), "__missing__");
  });

  it("provides language context with storage persistence", () => {
    const originalWindow = globalThis.window;
    const storage: Record<string, string> = {};
    globalThis.window = {
      localStorage: {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, value: string) => {
          storage[key] = value;
        },
      },
    } as unknown as Window;

    const captured: Array<ReturnType<typeof useLanguage>> = [];

    function Capture() {
      const ctx = useLanguage();
      captured.push(ctx);
      return React.createElement("span", null, ctx.t("welcome"));
    }

    renderToStaticMarkup(
      React.createElement(LanguageProvider, null, React.createElement(Capture)),
    );

    assert.equal(captured.length, 1);
    const ctx = captured[0]!;
    assert.equal(ctx.language, "en");
    ctx.setLanguage("hi");
    assert.equal(storage.language, "hi");
    assert.equal(typeof ctx.t("welcome"), "string");

    if (originalWindow === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as Record<string, unknown>).window;
    } else {
      globalThis.window = originalWindow;
    }
  });
});
