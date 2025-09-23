import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  coerceLanguage,
  readLanguageFromStorage,
  persistLanguageToStorage,
  translateKey,
  Language,
} from "../client/src/contexts/language-context";

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
});
