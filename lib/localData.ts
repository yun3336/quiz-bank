/** 題庫本機鍵名前綴；清除／隱私說明以此為準。 */
export const QUIZ_BANK_STORAGE_PREFIX = "quiz-bank:";

export type KeyStorage = {
  length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
};

export function collectKeysWithPrefix(
  storage: KeyStorage,
  prefix: string = QUIZ_BANK_STORAGE_PREFIX,
): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && key.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

/** 刪除所有符合前綴的鍵，回傳已刪鍵名。 */
export function clearKeysWithPrefix(
  storage: KeyStorage,
  prefix: string = QUIZ_BANK_STORAGE_PREFIX,
): string[] {
  const keys = collectKeysWithPrefix(storage, prefix);
  for (const key of keys) storage.removeItem(key);
  return keys;
}
