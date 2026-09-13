import { invoke } from "@tauri-apps/api/core";
import type { Reading } from "./types";

export const inDesktop = () => "__TAURI_INTERNALS__" in window;

export async function loadReadings(): Promise<Reading[]> {
  return inDesktop() ? invoke<Reading[]>("get_readings") : [];
}

export async function syncMeter(): Promise<number> {
  if (!inDesktop()) throw new Error("Open the packaged desktop app to read the meter.");
  return invoke<number>("sync_meter");
}

export async function exportReport(): Promise<string> {
  if (!inDesktop()) { window.print(); return "Print dialog opened"; }
  return invoke<string>("export_report");
}
