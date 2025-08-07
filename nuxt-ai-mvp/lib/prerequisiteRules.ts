/**
 * Mapa de pré‑requisitos para criação de cards.
 *
 * Chave  = tipo de card que está sendo criado
 * Valor  = array de tipos que DEVEM existir previamente no canvas
 *
 * Exemplo: para criar "insight" precisamos ter pelo menos um "survey" OU "dataSource".
 *          para criar "report" precisamos ter "insight".
 *
 * Adicione novas regras abaixo conforme evoluir o fluxo.
 */
export const prerequisiteRules: Record<string, string[]> = {
  survey: ["problem"],
  dataSource: ["problem"],
  empathMap: ["survey", "dataSource"],
  insight: ["survey", "dataSource"],
  affinityMap: ["survey", "dataSource"],
  report: ["insight", "empathMap", "affinityMap"],
};
