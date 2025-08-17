// lib/effects/client/registry.ts
import type { ZodSchema } from "zod";

export type EffectRegistryLike = {
  register: (
    type: string,
    handle: (payload: any, ctx: any) => Promise<void> | void,
    schema?: any
  ) => void;
};

// --- Effect registry core ----------------------------------------------------
export type SideEffect = { type: string; payload?: any };
export type EffectHandler = (payload: any, ctx: any) => Promise<void> | void;

type Registered = { handle: EffectHandler; schema?: ZodSchema<any> };

export class EffectRegistry {
  private handlers = new Map<string, Registered>();

  register(type: string, handle: EffectHandler, schema?: ZodSchema<any>) {
    this.handlers.set(type, { handle, schema });
  }

  async run(type: string, payload: any, ctx: any = {}) {
    const reg = this.handlers.get(type);
    if (!reg) return; // silently ignore unhandled effects
    const data = reg.schema ? reg.schema.parse(payload) : payload;
    await reg.handle(data, ctx);
  }

  async dispatch(effects: SideEffect[] | any[], ctx: any = {}) {
    if (!Array.isArray(effects)) return;
    for (const eff of effects) {
      if (!eff) continue;
      const type = (eff as any).type;
      const payload = (eff as any).payload;
      await this.run(type, payload, ctx);
    }
  }

  has(type: string) {
    return this.handlers.has(type);
  }
}

export const effectRegistry = new EffectRegistry();
