# Active Context

## Current Focus

- **Current Goal:** Testar e validar a padronização da experiência de edição e salvamento dos blocos de configuração de perguntas (OpenText, MultipleChoice, SatisfactionScale) para garantir UX fluida e sem bugs.
- **Specific Focus:** Validar que todos os tipos de bloco salvam alterações apenas no blur, com edição local protegida por flag, e que a sincronização com o backend (incluindo ordem e remoção) está robusta.

## Recent Changes

- **MultipleChoiceConfig:** Agora salva e emite alterações apenas no blur, com proteção de edição local (isEditingLocally). UX idêntica ao OpenTextConfig.
- **OpenTextConfig:** Confirmado padrão robusto de edição local e emissão só no blur.
- **SatisfactionScaleConfig:** Padronizado para seguir o mesmo fluxo reativo e de emissão dos outros configs.
- **SurveyBuilder:** Corrigida atualização da ordem das perguntas após deleção, com sincronização backend.
- **Memory Bank:** Estrutura central criada e revisada. Revisão completa realizada com sucesso (30/04/2025).

## Next Steps

- Testar todos os configs para garantir ausência de bugs de reatividade e UX consistente.
- Aprimorar lógica de limpeza de dados ao trocar tipo de bloco (zerar campos irrelevantes).
- Documentar padrões de integração entre frontend (Nuxt) e backend (Supabase/Nitro).
- Atualizar progress.md com status real das features entregues.
- Explorar testes automatizados e boas práticas de linting.
- **Dependencies/Blockers:** Nenhum bloqueio crítico. Depende de testes manuais e revisão de integração.

## Active Decisions & Considerations

- **Decisions:** Usar flag isEditingLocally para proteger edição local em todos os configs. Emissão de alterações apenas no blur/toggle.
- **Trade-offs:** A UX fica mais previsível, mas o usuário perde “autosave” em tempo real (decisão consciente para evitar bugs de reatividade).
- **Considerações:** Importante manter lógica idêntica em todos os tipos de bloco para facilitar manutenção e testes.

## Important Patterns & Preferences

- **Patterns:** Edição local controlada por flag, emissão só no blur/toggle, watcher protegido, sincronização backend após cada alteração.
- **Preferences:** Priorizar UX fluida e previsível. Documentação sempre atualizada na Memory Bank.

## Learnings & Insights

- **Learnings:** Padronização de UX nos configs elimina bugs de reatividade e melhora experiência do usuário. Importância de sempre sincronizar estado local/backend de forma previsível.
- **Insights:** Memory Bank é fundamental para continuidade eficiente do projeto após resets de contexto.
