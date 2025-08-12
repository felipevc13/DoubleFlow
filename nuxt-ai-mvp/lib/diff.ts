export type ProblemDiffItem = {
  field: "title" | "description";
  from: any;
  to: any;
};
export function problemDiff(oldObj: any, newObj: any): ProblemDiffItem[] {
  const fields: Array<"title" | "description"> = ["title", "description"];
  return fields
    .map((f) => ({ field: f, from: oldObj?.[f], to: newObj?.[f] }))
    .filter((d) => JSON.stringify(d.from) !== JSON.stringify(d.to));
}

// Um diff genérico “simples por campo” útil para tipos triviais (ex.: note)
export type GenericDiffItem = { field: string; from: any; to: any };
export function simpleFieldDiff(
  oldObj: any,
  newObj: any,
  fields: string[]
): GenericDiffItem[] {
  return fields
    .map((f) => ({ field: f, from: oldObj?.[f], to: newObj?.[f] }))
    .filter((d) => JSON.stringify(d.from) !== JSON.stringify(d.to));
}
