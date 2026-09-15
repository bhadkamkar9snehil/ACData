import { invoke } from "@tauri-apps/api/core";
import type {
  ContextData,
  InsulinDose,
  MealEvent,
  MedicationChange,
  Reading,
} from "./types";

export const inDesktop = () => "__TAURI_INTERNALS__" in window;

export async function loadReadings(): Promise<Reading[]> {
  return inDesktop() ? invoke<Reading[]>("get_readings") : [];
}

export async function syncMeter(): Promise<number> {
  if (!inDesktop())
    throw new Error("Open the packaged desktop app to read the meter.");
  return invoke<number>("sync_meter");
}

export async function exportReport(
  days: number | null,
  unit: "mg" | "mmol",
): Promise<string> {
  if (!inDesktop()) {
    window.print();
    return "Print dialog opened";
  }
  return invoke<string>("export_report", { days, unit });
}

export async function exportExcel(days: number | null): Promise<string> {
  if (!inDesktop()) throw new Error("Open the packaged desktop app to export Excel.");
  return invoke<string>("export_excel", { days });
}

export async function loadContext(): Promise<ContextData> {
  return inDesktop()
    ? invoke<ContextData>("get_context")
    : { meals: [], medicationChanges: [], insulinDoses: [] };
}

export async function saveMedication(
  change: Omit<MedicationChange, "id">,
): Promise<number> {
  return invoke<number>("add_medication_change", {
    change: { id: 0, ...change },
  });
}

export async function saveMeal(meal: Omit<MealEvent, "id">): Promise<number> {
  return invoke<number>("add_meal_event", { event: { id: 0, ...meal } });
}

export async function saveInsulin(
  dose: Omit<InsulinDose, "id">,
): Promise<number> {
  return invoke<number>("add_insulin_dose", { dose: { id: 0, ...dose } });
}

export async function saveReadingContext(
  id: number,
  context: string | null,
): Promise<void> {
  return invoke<void>("set_reading_context", { id, context });
}
