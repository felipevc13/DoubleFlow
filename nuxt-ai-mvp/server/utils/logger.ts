// server/utils/logger.ts
import { consola } from "consola";

const LOG_LEVEL_MAP: { [key: string]: number } = {
  silent: -1,
  fatal: 0,
  error: 0, // Consola mapeia fatal/error para 0
  warn: 1,
  info: 2,
  success: 3,
  debug: 4,
  trace: 5,
};

export const logger = consola.withTag("agent");
export const dbg = logger.withTag("debug").debug;

// ✅ Aplicar nível mesmo quando é 0 ou -1
if (
  process.env.AGENT_LOG_LEVEL &&
  Object.prototype.hasOwnProperty.call(
    LOG_LEVEL_MAP,
    process.env.AGENT_LOG_LEVEL
  )
) {
  logger.level = LOG_LEVEL_MAP[process.env.AGENT_LOG_LEVEL];
}

export function scopedLogger(id: string) {
  return consola.withTag(`agent:${id}`);
}

// Helper para reconhecer interrupções do LangGraph
function isLangGraphInterrupt(err: any): boolean {
  if (!err) return false;

  // Direct Interrupt instances
  if (err?.name === "Interrupt" || err?.constructor?.name === "Interrupt")
    return true;
  if (
    err?.name === "InterruptError" ||
    err?.constructor?.name === "InterruptError"
  )
    return true;

  // LangGraph sometimes throws an Error with a structured `cause`
  const cause =
    (err as any)?.cause ?? (err as any)?.error ?? (err as any)?.value;
  const candidates = [err, cause]
    .concat(Array.isArray(err) ? err : [])
    .concat(Array.isArray(cause) ? cause : []);

  for (const c of candidates) {
    if (!c) continue;
    const v = (c as any).value ?? c;
    const kind = (v as any)?.kind;
    if (kind === "APPROVAL_REQUEST" || kind === "CLARIFICATION_REQUEST")
      return true;
  }

  // Heuristic: inspect stack for LangGraph interrupt path
  const st: string | undefined = (err as any)?.stack;
  if (typeof st === "string" && st.includes("/interrupt.js")) return true;

  // Heuristic: if message/json contains the marker
  try {
    const msg = typeof err?.message === "string" ? err.message : "";
    if (
      msg.includes("APPROVAL_REQUEST") ||
      msg.includes("CLARIFICATION_REQUEST")
    )
      return true;
    const s = JSON.stringify(err);
    if (
      s.includes('"kind":"APPROVAL_REQUEST"') ||
      s.includes('"kind":"CLARIFICATION_REQUEST"')
    )
      return true;
  } catch {}

  return false;
}

export function wrapNode<TIn, TOut>(
  name: string,
  fn: (input: TIn, config?: any) => Promise<TOut> | TOut
) {
  return async (input: TIn, config?: any) => {
    logger.info(`[${name}] ⤵️  input`, input);
    const t0 = Date.now();
    try {
      const out = await fn(input, config);
      logger.success(`[${name}] ✅ done in ${Date.now() - t0} ms →`, out);
      return out;
    } catch (err: any) {
      // ✅ Não tratar interrupção como erro
      if (isLangGraphInterrupt(err)) {
        logger.info(`[${name}] ⏸ interrupt (awaiting user input)`);
        throw err; // relança para o LangGraph pausar corretamente
      }

      logger.error(`[${name}] ❌ error`, err);
      throw err;
    }
  };
}
