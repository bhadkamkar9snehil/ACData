export type Reading = {
  id: number;
  timestamp: string;
  mgDl: number;
  status: number;
  meal?: string;
};

export type Page =
  | "overview"
  | "explore"
  | "readings"
  | "treatments"
  | "import"
  | "reports"
  | "settings";

export type MedicationChange = {
  id: number;
  effective_at: string;
  medication_name: string;
  previous_dose?: number;
  new_dose?: number;
  dose_unit?: string;
  frequency?: string;
  reason?: string;
  notes?: string;
};
export type MealEvent = {
  id: number;
  occurred_at: string;
  meal_type: string;
  description?: string;
  carbs_grams?: number;
  notes?: string;
};
export type InsulinDose = {
  id: number;
  taken_at: string;
  insulin_name: string;
  insulin_type: string;
  units: number;
  meal_event_id?: number;
  notes?: string;
};
export type ContextData = {
  meals: MealEvent[];
  medicationChanges: MedicationChange[];
  insulinDoses: InsulinDose[];
};
