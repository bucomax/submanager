import { defaultClientCrudDeps } from "@/infrastructure/composition/client-crud-deps";
import { patchClientBodySchema } from "@/lib/validators/client";
import {
  updateClient,
  type UpdateClientBody,
  type UpdateClientDeps,
  type UpdateClientPatchResult,
} from "@/application/use-cases/client/update-client.core";

export type { UpdateClientBody, UpdateClientDeps, UpdateClientPatchResult };

export { patchClientBodySchema };

/** Ponto de entrada de produção (usado pela rota); a lógica vive em `update-client.core.ts`. */
export function runUpdateClient(
  params: Parameters<typeof updateClient>[0],
  deps: UpdateClientDeps = defaultClientCrudDeps,
): Promise<UpdateClientPatchResult> {
  return updateClient(params, deps);
}
