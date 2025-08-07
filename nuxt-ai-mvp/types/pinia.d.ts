import type { Pinia } from "pinia";

declare global {
  interface Window {
    $pinia: Pinia;
  }
}
