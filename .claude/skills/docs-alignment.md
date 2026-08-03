# Skill: docs-alignment

Mantém a documentação do repositório alinhada ao código e ao produto.

**Usar quando:** alterar modelo de dados, fluxos de jornada, APIs públicas, integrações ou RBAC; ou quando pedir para atualizar README, ARCHITECTURE ou PRODUCT-SCOPE.

## Arquivos e gatilhos de atualização

| Arquivo | Quando atualizar |
|---------|------------------|
| `docs/ARCHITECTURE.md` | Novas tabelas Prisma, rotas `/api/v1`, mudança em §8, auth, subdomínios, notificações |
| `public/openapi.json` | Toda alteração de contrato em `/api/v1` (paths, schemas, security) — Scalar deve refletir |
| `docs/PRODUCT-SCOPE.md` | Regra de negócio visível ao usuário (jornada, documentos por etapa, fases) |
| `docs/submanager/business-logic.md` | Regras de negócio consolidadas, decisões de produto |
| `README.md` | Stack, links de docs, como rodar o projeto |
| `docs/DEV-PHASES.md` | Reordenar ou marcar fases concluídas quando mudar o plano |

## Regras

- **Não** criar documentos `.md` novos sem necessidade; preferir editar os existentes.
- Se renomear entidades (`CarePathway`, etc.), atualizar **§8** da ARCHITECTURE e menções no PRODUCT-SCOPE.
- Commits que mudam contrato de integração devem citar a seção da doc atualizada.
- Manter **fonte única de verdade** — não duplicar informação entre docs.

## Checklist pós-mudança

1. Alterou schema Prisma? → Verificar §8 da `ARCHITECTURE.md`.
2. Adicionou/removeu rota `/api/v1/*`? → Atualizar `public/openapi.json`.
3. Mudou regra de negócio visível? → Verificar `PRODUCT-SCOPE.md` e `business-logic.md`.
4. Completou milestone? → Marcar em `DEV-PHASES.md`.
5. Alterou stack/setup? → Verificar `README.md`.
