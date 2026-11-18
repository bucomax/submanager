/**
 * Fachada estável de visibilidade de pacientes para rotas e use cases.
 * Política pura em `domain/client/client-visibility`; leitura de escopo e filtros Prisma em
 * `infrastructure/visibility/*` (port: `IClientVisibilityScopeReader`).
 */
export {
  buildClientVisibilityFlatFilter,
  canViewClientRow,
  clientScopeFromTenantMembershipRow,
  getClientIdFromPlainMetadata,
  type ClientVisibilityFlatFilter,
  type TenantMembershipClientScope,
} from "@/domain/client/client-visibility";
export {
  buildAgendaEventVisibilityWhereInput,
  buildClientDetailWhere,
  buildClientVisibilityWhereInput,
  buildConversationVisibilityWhereInput,
  mergeClientWhereWithVisibility,
  mergeKanbanClientNestedWhereWithVisibility,
} from "@/infrastructure/visibility/client-visibility-where";
export {
  buildKanbanClientWhereForActor,
  filterUserIdsWhoCanViewClient,
  findTenantClientVisibleToActor,
  loadAgendaEventVisibilityWhere,
  loadConversationVisibilityWhere,
  loadTenantMembershipClientScope,
} from "@/infrastructure/visibility/client-visibility-scope";
