// lib/connectionRules.ts

// Structure: { sourceType: { targetType1: true, targetType2: true, ... } }
export const connectionRules = {
  problem: {
    dataSource: true,
    survey: true,

    // Add other types that can follow a problem node
    // e.g., 'solutionHypothesis': true
  },
  dataSource: {
    survey: true,
    analysis: true, // Data sources can be connected to analysis nodes

    // Add other types that can follow a data source node
    // e.g., 'dataProcessor': true, 'insightGenerator': true
  },
  survey: {
    analysis: true, // Survey results can be analyzed

    // Add other types survey can lead to
  },

  analysis: {
    // Analysis can be included in reports
  },
};

export type ConnectionRules = typeof connectionRules;
export type SourceNodeType = keyof ConnectionRules;
// Optional: Define TargetNodeType more precisely if needed based on rules
// export type TargetNodeType<S extends SourceNodeType> = keyof ConnectionRules[S];
