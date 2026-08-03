import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createEncryptedPersistStorage } from "@/lib/storage/encrypted-persist-storage";

/** Bucket dentro de `createEncryptedPersistStorage` (paridade com tema). */
const PERSIST_NAME = "submanager-auth";

export type AuthTokenState = {
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (access: string | null, refresh: string | null) => void;
};

/**
 * Tokens JWT para `apiClient` (Authorization + refresh). Persistido no mesmo
 * blob criptografado do app (`app.persisted.v1`), separado do store de tema.
 */
export const useAuthTokenStore = create<AuthTokenState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      setTokens: (access, refresh) =>
        set({
          accessToken: access,
          refreshToken: refresh,
        }),
    }),
    {
      name: PERSIST_NAME,
      storage: createJSONStorage(() => createEncryptedPersistStorage()),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
