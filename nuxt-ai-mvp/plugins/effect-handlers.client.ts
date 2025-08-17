// plugins/effect-handlers.client.ts
import { defineNuxtPlugin } from "nuxt/app";
import "@/lib/effects/client/handlers"; // apenas executar para registrar

export default defineNuxtPlugin(() => {
  // intencionalmente vazio – só precisamos do import acima
});
