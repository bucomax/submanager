# Interfaces de referência (HTML estático)

Protótipos **SubManager** usados como referência visual e de fluxo para o painel Next.js do monorepo.

| Arquivo | Conteúdo |
|---------|----------|
| `index.html` | Dashboard: métricas, alertas, pipeline Kanban, modais (novo paciente / alterar fase) |
| `pacientes.html` | Lista em cards ou tabela, filtros, paginação |
| `paciente.html` | Detalhe do paciente: timeline, checklist, documentos, atividades, notas |
| `interface-paciente-detalhe.html` | Variante de detalhe com timeline expandida e modal de avanço + PDFs |
| `configuracoes.html` | Configurações: perfil, clínica, **fases** (SLA/dias), notificações, equipe, OPME, integrações |
| `relatorios.html` | Relatórios, gráficos e exportação |

## Documentação técnica no repositório

- **Índice SubManager:** [`docs/submanager/README.md`](../submanager/README.md)  
- **Uma doc por página desta pasta (migração FE/BE):** [`docs/submanager/pages/README.md`](../submanager/pages/README.md)  
- **Matriz modelo Prisma × páginas:** [`docs/submanager/pages/entity-to-pages-matrix.md`](../submanager/pages/entity-to-pages-matrix.md)  
- **Migrations (o que criar no banco):** [`docs/submanager/database-backlog.md`](../submanager/database-backlog.md)  
- **Ordem de execução / primeira etapa:** [`docs/submanager/execution-plan.md`](../submanager/execution-plan.md)  
- Referência visual, tema e gaps gerais: [`docs/SUBMANAGER-INTERFACES-AND-DATA.md`](../SUBMANAGER-INTERFACES-AND-DATA.md)
