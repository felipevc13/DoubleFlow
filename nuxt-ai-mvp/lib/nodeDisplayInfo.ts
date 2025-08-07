/**
 * ATENÇÃO:
 * Este arquivo deve ser importado apenas dentro de componentes Vue, composables ou páginas Nuxt/Vue.
 * NÃO o importe em arquivos TypeScript puros fora do contexto Vue/Nuxt,
 * pois este arquivo importa componentes `.vue` e depende do ecossistema Vue.
 */
import DataIcon from "../components/icon/DataIcon.vue";
import SurveyIcon from "../components/icon/SurveyIcon.vue";
import AnalysisIcon from "../components/icon/AnalysisIcon.vue";
import ReportIcon from "../components/icon/ReportIcon.vue";

export interface NodeDisplayInfo {
  type: string;
  label: string;
  description?: string;
  icon?: any; // Componente Vue do ícone
}

export const nodeDisplayInfoList: NodeDisplayInfo[] = [
  {
    type: "dataSource",
    label: "Adicione dados ao projeto",
    description: "Crie ou adicione fontes de dados para o projeto",
    icon: DataIcon,
  },
  {
    type: "survey",
    label: "Crie um survey",
    description: "Colete dados diretamente dos usuários",
    icon: SurveyIcon,
  },
  {
    type: "analysis",
    label: "Análise com IA",
    description:
      "Visualize e analise dados de múltiplas fontes em um único painel",
    icon: AnalysisIcon,
  },
];

// Utility to get node display info by type
export function getNodeDisplayInfo(type: string): NodeDisplayInfo | undefined {
  return nodeDisplayInfoList.find((info) => info.type === type);
}
