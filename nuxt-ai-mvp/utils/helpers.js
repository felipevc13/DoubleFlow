export const removeFileExtension = (filename) => {
  if (!filename || typeof filename !== "string") return filename;
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1 || lastDotIndex === 0) return filename;
  return filename.substring(0, lastDotIndex);
};

export const groupSourcesByCategory = (sources) => {
  if (!sources || sources.length === 0) {
    return {};
  }
  return sources.reduce((acc, item) => {
    const category = item.category || "geral";
    if (!acc[category]) {
      acc[category] = [];
    }
    const structuredItem = {
      id: item.id,
      name: removeFileExtension(item.name || ""),
      file_name: item.name || "",
      title: item.title?.trim() || removeFileExtension(item.name || ""),
      content: item.content,
      type: item.type || "unknown",
      createdAt: item.created_at || item.createdAt,
      category: category,
    };
    acc[category].push(structuredItem);
    return acc;
  }, {});
}; 