export function cleanToolSchema(schema: any): any {
  const cleanedSchema = { ...schema };
  if (cleanedSchema.additionalProperties !== undefined) {
    delete cleanedSchema.additionalProperties;
  }
  if (cleanedSchema.$schema !== undefined) {
    delete cleanedSchema.$schema;
  }
  return cleanedSchema;
}
