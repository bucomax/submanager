import { defaultClientCrudDeps } from "@/infrastructure/composition/client-crud-deps";
import {
  listClientsPage,
  type ListClientsPageDeps,
  type ListClientsPageSuccess,
} from "@/application/use-cases/client/list-clients-page.core";

export type { ListClientsPageDeps, ListClientsPageSuccess };

/** Ponto de entrada de produção (usado pela rota); a lógica vive em `list-clients-page.core.ts`. */
export function runListClientsPage(
  params: Parameters<typeof listClientsPage>[0],
  deps: ListClientsPageDeps = defaultClientCrudDeps,
): Promise<ListClientsPageSuccess> {
  return listClientsPage(params, deps);
}
