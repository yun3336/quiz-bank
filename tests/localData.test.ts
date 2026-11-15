import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearKeysWithPrefix, collectKeysWithPrefix, QUIZ_BANK_STORAGE_PREFIX } from "../lib/localData";

class MemoryStorage {
  private readonly map = new Map<string, string>();

  get length() {
    return this.map.size;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe("collectKeysWithPrefix / clearKeysWithPrefix", () => {
  it("只收集 quiz-bank: 前綴鍵", () => {
    const storage = new MemoryStorage();
    storage.setItem("quiz-bank:v1", "{}");
    storage.setItem("quiz-bank:theme", "dark");
    storage.setItem("other-app", "1");
    const keys = collectKeysWithPrefix(storage);
    assert.deepEqual(keys.sort(), ["quiz-bank:theme", "quiz-bank:v1"]);
    assert.equal(QUIZ_BANK_STORAGE_PREFIX, "quiz-bank:");
  });

  it("清除前綴鍵並保留其他鍵", () => {
    const storage = new MemoryStorage();
    storage.setItem("quiz-bank:v1", "{}");
    storage.setItem("quiz-bank:trivia", "{}");
    storage.setItem("unrelated", "keep");
    const removed = clearKeysWithPrefix(storage);
    assert.equal(removed.length, 2);
    assert.equal(storage.getItem("unrelated"), "keep");
    assert.equal(storage.getItem("quiz-bank:v1"), null);
    assert.equal(storage.length, 1);
  });
});
