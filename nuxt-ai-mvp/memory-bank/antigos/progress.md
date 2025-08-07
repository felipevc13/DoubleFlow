# Project Progress

## What Works

- **Configuração de Perguntas:**
  - OpenTextConfig, MultipleChoiceConfig e SatisfactionScaleConfig padronizados: Edição local protegida, emissão de alterações apenas no blur/toggle, UX fluida e consistente implementada. Pronta para testes finais.
  - SurveyBuilder atualiza corretamente a ordem das perguntas após deleção, sincronizando com o backend.
- **Backend:**
  - Endpoints para CRUD de perguntas e atualização de ordem funcionais.
  - Sincronização frontend/Supabase estável para features de survey.
- **Milestones Recentes:**
  - Padronização completa da lógica de edição/salvamento nos componentes de configuração de perguntas.
  - Correção de bugs de ordem e reatividade no SurveyBuilder.
  - Estrutura da Memory Bank criada e revisada (30/04/2025).

## What's Left to Build

- Testes finais ponta-a-ponta de todos os tipos de bloco/configuração.
- Aprimorar lógica de limpeza de dados ao trocar tipo de bloco (zerar campos irrelevantes).
- Implementar testes automatizados e boas práticas de linting.
- Polimento visual e responsividade.
- Finalizar regras de conexão e prompts de AI.
- Documentar padrões de integração frontend/backend na Memory Bank.
- Explorar autenticação e flows de usuário.
- Planejar/deployar ambiente de produção.

## Current Status

- **Snapshot:** Projeto em ritmo ativo, com a padronização da UX dos configs concluída e pronta para testes. Backend e frontend integrados para as principais features de survey. Memory Bank atualizada.
- **Potential Blockers/Risks:** Garantir que a padronização esteja 100% livre de bugs e edge cases através de testes. Testes manuais ainda necessários. Integração AI e flows avançados de usuário ainda pendentes.
- **Confidence:** Alta na estrutura e padronização da base de survey/configs. Confiança média na ausência total de bugs antes dos testes finais. Outras áreas aguardam evolução.

## Known Issues

- **Known Issues:**
  - Falta de testes automatizados.
  - Possíveis edge cases ao alternar tipos de bloco (limpeza de campos).
  - Polimento visual e responsividade em progresso.
- **Issue Tracker:** N/A.

## Evolution of Project Decisions

- **Evolution:**
  - Decisão de padronizar edição local e emissão só no blur/toggle para todos os configs (implementado).
  - Adoção e manutenção da Memory Bank como fonte única de verdade do projeto (revisado 30/04/2025).
