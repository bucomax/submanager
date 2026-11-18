import { defaultClientCrudDeps } from "@/infrastructure/composition/client-crud-deps";
import { postClientBodySchema } from "@/lib/validators/client";
import {
  createClient,
  type CreateClientBody,
  type CreateClientDeps,
} from "@/application/use-cases/client/create-client.core";
import type { ClientDto } from "@/types/api/clients-v1";

export type { CreateClientBody, CreateClientDeps };

export { postClientBodySchema };

/** Ponto de entrada de produção (usado pela rota); a lógica vive em `create-client.core.ts`. */
export function runCreateClient(
  params: Parameters<typeof createClient>[0],
  deps: CreateClientDeps = defaultClientCrudDeps,
): Promise<{ client: ClientDto }> {
  return createClient(params, deps);
}
