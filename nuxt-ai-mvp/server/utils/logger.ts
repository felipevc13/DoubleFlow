// server/utils/logger.ts
import { consola } from "consola";

// Define a mapping for log levels to their numeric values
const LOG_LEVEL_MAP: { [key: string]: number } = {
  silent: -1,
  fatal: 0,
  error: 0, // Consola treats fatal and error as the same level 0
  warn: 1,
  info: 2,
  success: 3,
  debug: 4,
  trace: 5,
};

export const logger = consola.withTag("agent"); // nível default = info
export const dbg = logger.withTag("debug").debug; // uso rápido para debug

// Em produção, você pode baixar para WARN ou ERROR via env
if (process.env.AGENT_LOG_LEVEL && LOG_LEVEL_MAP[process.env.AGENT_LOG_LEVEL]) {
  logger.level = LOG_LEVEL_MAP[process.env.AGENT_LOG_LEVEL];
}

export function scopedLogger(id: string) {
  return consola.withTag(`agent:${id}`);
}

export function wrapNode<TIn, TOut>(
  name: string,
  fn: (input: TIn, config?: any) => Promise<TOut> | TOut // Add optional config parameter
) {
  return async (input: TIn, config?: any) => {
    // Accept config in the wrapper
    logger.info(`[${name}] ⤵️  input`, input);
    const t0 = Date.now();
    try {
      const out = await fn(input, config); // Pass config to the wrapped function
      logger.success(`[${name}] ✅ done in ${Date.now() - t0} ms →`, out);
      return out;
    } catch (err) {
      logger.error(`[${name}] ❌ error`, err);
      throw err;
    }
  };
}
