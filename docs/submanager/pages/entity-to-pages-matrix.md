# Matriz: entidade (banco) × páginas que consomem

Complemento ao índice [README.md](./README.md): visão **por tabela/model** para quem implementa backend ou migrações primeiro.

Legenda: ● primário · ○ secundário / futuro

| Model / tabela | Dashboard | Lista pacientes | Detalhe paciente | Configurações | Relatórios |
|----------------|-----------|-----------------|------------------|---------------|------------|
| `Tenant` | ○ | ○ | ○ | ● | ○ |
| `User` | ○ | ○ | ○ (responsável gap) | ● perfil/equipe | ○ |
| `TenantMembership` | — | — | — | ● equipe | — |
| `Client` | ● cards / modal | ● | ● | ○ OPME no cliente | ○ |
| `CarePathway` | ● filtro / fluxo | ● | ● | ● fases ligadas ao pathway | ● |
| `PathwayVersion` | ● publicada | ● | ● | ● rascunho/publicar | ○ |
| `PathwayStage` | ● colunas Kanban | ● coluna fase | ● timeline | ● editor DnD | ● eixos gráfico |
| `PatientPathway` | ● | ● | ● | — | ● KPIs |
| `StageTransition` | ○ atividades | — | ● histórico | — | ○ tempo (futuro) |
| `FileAsset` | ○ docs | — | ● documentos | — | — |
| *Gaps:* `TenantSettings`, `ChannelDispatch` | conforme doc da página | | | | |

Para o detalhe de UI/API por tela, usar os arquivos `page-*.md` na mesma pasta.
