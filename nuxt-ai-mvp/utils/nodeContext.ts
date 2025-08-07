import pako from "pako";
import type {
  CumulativeContextBlob,
  AncestorContextData,
  CumulativeContextWrapper,
  TaskFlowNode,
  NodeData, // NEW: used by prepareNodeDataForAi
} from "~/types/taskflow";

// --- Helper Functions ---

/**
 * Decompresses the cumulative context if it's compressed.
 * @param {CumulativeContextWrapper | null | undefined} context - The context object { compressed: boolean, blob: string | object }
 * @returns {CumulativeContextBlob} The decompressed context object, or an empty object if input is invalid/empty.
 */
// <<< Add type annotations
export function decompress(
  context: CumulativeContextWrapper | null | undefined
): CumulativeContextBlob {
  if (!context || !context.blob) {
    return {};
  }

  if (context.compressed) {
    try {
      // 1. Decode Base64
      const binaryString = atob(context.blob as string); // Assert context.blob is a string
      // 2. Convert binary string to Uint8Array
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      // 3. Ungzip
      const decompressedString = pako.ungzip(bytes, { to: "string" });
      // 4. Parse JSON
      return JSON.parse(decompressedString);
    } catch (error) {
      console.error(
        "[nodeContext] Error decompressing context:",
        error,
        "Context:",
        context
      );
      return {}; // Return empty object on error
    }
  } else {
    // If not compressed, blob is the object itself
    // Return a clone to avoid potential mutations of the original store state if needed elsewhere
    return typeof context.blob === "object" && context.blob !== null
      ? JSON.parse(JSON.stringify(context.blob))
      : {};
  }
}

/**
 * Retrieves and decompresses the cumulative context from a node.
 * @param {TaskFlowNode | null | undefined} node - The node object from the store.
 * @returns {CumulativeContextBlob} The decompressed cumulative context.
 */
// <<< Add type annotation
export function getAggregatedContext(
  node: TaskFlowNode | null | undefined
): CumulativeContextBlob {
  return decompress(node?.data?.cumulativeContext) || {};
}

/**
 * Merges two context objects based on the version timestamp of each entry.
 * Keeps the entry with the higher version number.
 * @param {CumulativeContextBlob} existingCtx - The current context object.
 * @param {CumulativeContextBlob} incomingCtx - The new context object to merge in.
 * @returns {CumulativeContextBlob} The merged context object.
 */
// <<< Add type annotations
export function mergeByVersion(
  existingCtx: CumulativeContextBlob,
  incomingCtx: CumulativeContextBlob
): CumulativeContextBlob {
  const merged: CumulativeContextBlob = { ...existingCtx };
  for (const key in incomingCtx) {
    if (!Object.prototype.hasOwnProperty.call(incomingCtx, key)) continue;
    const incomingEntry = incomingCtx[key];
    const incomingVersion =
      typeof incomingEntry?.version === "number" &&
      !isNaN(incomingEntry.version)
        ? incomingEntry.version
        : 0;
    const incomingOutput = incomingEntry.output;
    const incomingEmpty =
      incomingOutput === undefined ||
      incomingOutput === null ||
      (typeof incomingOutput === "object" &&
        Object.keys(incomingOutput).length === 0 &&
        !(Array.isArray(incomingOutput) && incomingOutput.length > 0));
    const existingEntry = merged[key];
    const existingVersion =
      typeof existingEntry?.version === "number" &&
      !isNaN(existingEntry.version)
        ? existingEntry.version
        : -1;

    if (incomingEmpty) {
      if (existingEntry && incomingVersion >= existingVersion)
        delete merged[key];
    } else {
      if (!existingEntry || incomingVersion > existingVersion) {
        merged[key] = { ...incomingEntry };
      }
    }
  }
  return merged;
}

/**
 * Compresses a context object if its stringified size exceeds a threshold.
 * @param {CumulativeContextBlob} contextObject - The raw context object.
 * @param {number} threshold - The size threshold in bytes (e.g., 200 * 1024 for 200 kB).
 * @returns {CumulativeContextWrapper} The context structure ready for storage.
 */
// <<< Add type annotations
export function compressIfNeeded(
  contextObject: CumulativeContextBlob,
  threshold: number = 200 * 1024
): CumulativeContextWrapper {
  try {
    const contextString = JSON.stringify(contextObject);
    if (contextString.length > threshold) {
      const compressedData: Uint8Array = pako.gzip(contextString);
      // Converte Uint8Array para string binária manualmente (chunked, robusto)
      let binaryString = "";
      for (let i = 0; i < compressedData.length; i++) {
        binaryString += String.fromCharCode(compressedData[i]);
      }
      const base64String = btoa(binaryString);
      return { compressed: true, blob: base64String };
    } else {
      return { compressed: false, blob: contextObject };
    }
  } catch (error) {
    console.error(
      "[nodeContext] Error during compression check:",
      error,
      "Object (keys):",
      Object.keys(contextObject)
    );
    return { compressed: false, blob: contextObject };
  }
}

/**
 * Ensures the cumulativeContext is decompressed before sending the node
 * to the AI analysis endpoint.
 * Use this in any handler that builds the request body for /api/ai/runAnalysis.
 */
export function prepareNodeDataForAi(nodeData: NodeData): NodeData {
  const ctx = nodeData.cumulativeContext;
  if (ctx?.compressed) {
    return {
      ...nodeData,
      cumulativeContext: {
        compressed: false,
        blob: decompress(ctx), // reuse local util
      },
    };
  }
  return nodeData;
}
