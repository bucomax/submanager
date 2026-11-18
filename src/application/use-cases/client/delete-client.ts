import { defaultClientCrudDeps } from "@/infrastructure/composition/client-crud-deps";
import {
  deleteClient,
  type DeleteClientDeps,
  type DeleteClientResult,
} from "@/application/use-cases/client/delete-client.core";

export type { DeleteClientDeps, DeleteClientResult };

/** Ponto de entrada de produção (usado pela rota); a lógica vive em `delete-client.core.ts`. */
export function runDeleteClient(
  params: Parameters<typeof deleteClient>[0],
  deps: DeleteClientDeps = defaultClientCrudDeps,
): Promise<DeleteClientResult> {
  return deleteClient(params, deps);
}
