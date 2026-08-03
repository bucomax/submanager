import CryptoJS from "crypto-js";
import type { StateStorage } from "zustand/middleware";
import { getPersistSecret } from "@/lib/storage/persist-secret";

/**
 * Uma única chave no `localStorage`; valor = blob criptografado (AES) contendo
 * um JSON `{ [persistName]: serializedState }` para permitir mais de um `persist` no futuro.
 */
export const ENCRYPTED_LOCAL_STORAGE_KEY = "app.persisted.v1";

type PersistBucket = Record<string, string>;

function readBucket(): PersistBucket {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = localStorage.getItem(ENCRYPTED_LOCAL_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const decrypted = CryptoJS.AES.decrypt(raw, getPersistSecret()).toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      return {};
    }
    return JSON.parse(decrypted) as PersistBucket;
  } catch {
    return {};
  }
}

function writeBucket(bucket: PersistBucket): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload = JSON.stringify(bucket);
    const encrypted = CryptoJS.AES.encrypt(payload, getPersistSecret()).toString();
    localStorage.setItem(ENCRYPTED_LOCAL_STORAGE_KEY, encrypted);
  } catch (e) {
    console.error("[submanager] Falha ao persistir estado criptografado:", e);
  }
}

/**
 * `StateStorage` para `persist` do Zustand: tudo em um campo, criptografado.
 */
export function createEncryptedPersistStorage(): StateStorage {
  return {
    getItem: (name) => {
      if (typeof window === "undefined") {
        return null;
      }
      const bucket = readBucket();
      return bucket[name] ?? null;
    },
    setItem: (name, value) => {
      if (typeof window === "undefined") {
        return;
      }
      const bucket = readBucket();
      bucket[name] = value;
      writeBucket(bucket);
    },
    removeItem: (name) => {
      if (typeof window === "undefined") {
        return;
      }
      const bucket = readBucket();
      delete bucket[name];
      if (Object.keys(bucket).length === 0) {
        localStorage.removeItem(ENCRYPTED_LOCAL_STORAGE_KEY);
      } else {
        writeBucket(bucket);
      }
    },
  };
}
