import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import {
  inDesktop,
  loadContext,
  saveInsulin,
  saveMeal,
  saveMedication,
} from "../lib/backend";
import type { ContextData } from "../lib/types";

const empty: ContextData = {
  meals: [],
  medicationChanges: [],
  insulinDoses: [],
};

export function Treatments() {
  const [context, setContext] = useState(empty);
  const refresh = () => void loadContext().then(setContext);
  useEffect(refresh, []);

  const medication = async (form: FormData) => {
    await saveMedication({
      effective_at: String(form.get("time")),
      medication_name: String(form.get("name")),
      new_dose: Number(form.get("dose")) || undefined,
      dose_unit: String(form.get("unit")),
      notes: String(form.get("notes")) || undefined,
    });
    refresh();
  };
  const meal = async (form: FormData) => {
    await saveMeal({
      occurred_at: String(form.get("time")),
      meal_type: String(form.get("type")),
      description: String(form.get("description")) || undefined,
      carbs_grams: Number(form.get("carbs")) || undefined,
      notes: String(form.get("notes")) || undefined,
    });
    refresh();
  };
  const insulin = async (form: FormData) => {
    await saveInsulin({
      taken_at: String(form.get("time")),
      insulin_name: String(form.get("name")),
      insulin_type: String(form.get("type")),
      units: Number(form.get("units")),
      notes: String(form.get("notes")) || undefined,
    });
    refresh();
  };

  const timeline = [
    ...context.meals.map((x) => ({
      time: x.occurred_at,
      text: `${x.meal_type}${x.description ? ` · ${x.description}` : ""}${x.carbs_grams ? ` · ${x.carbs_grams} g carbs` : ""}`,
    })),
    ...context.medicationChanges.map((x) => ({
      time: x.effective_at,
      text: `${x.medication_name}${x.new_dose ? ` · ${x.new_dose} ${x.dose_unit ?? ""}` : ""}`,
    })),
    ...context.insulinDoses.map((x) => ({
      time: x.taken_at,
      text: `${x.insulin_name} · ${x.units} units · ${x.insulin_type}`,
    })),
  ].sort((a, b) => b.time.localeCompare(a.time));
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Treatment context</h1>
          <p>
            Record changes beside the readings. No dose recommendations are
            made.
          </p>
        </div>
      </header>
      {!inDesktop() && (
        <div className="notice">
          Open the Windows app to save private treatment information.
        </div>
      )}
      <div className="treatment-grid">
        <EventForm title="Meal event" action={meal}>
          <label>
            Meal time
            <input required name="time" type="datetime-local" />
          </label>
          <label>
            Meal
            <select name="type">
              <option>Breakfast</option>
              <option>Lunch</option>
              <option>Dinner</option>
              <option>Snack</option>
              <option>Other</option>
            </select>
          </label>
          <div className="field-row">
            <label>
              Description
              <input name="description" placeholder="What was eaten" />
            </label>
            <label>
              Carbohydrate estimate
              <input
                min="0"
                step="1"
                name="carbs"
                type="number"
                placeholder="grams, optional"
              />
            </label>
          </div>
          <label>
            Notes
            <textarea name="notes" />
          </label>
        </EventForm>
        <EventForm title="Medication change" action={medication}>
          <label>
            Effective time
            <input required name="time" type="datetime-local" />
          </label>
          <label>
            Medication
            <input required name="name" />
          </label>
          <div className="field-row">
            <label>
              New dose
              <input name="dose" inputMode="decimal" />
            </label>
            <label>
              Unit
              <input name="unit" placeholder="mg, tablet…" />
            </label>
          </div>
          <label>
            Notes
            <textarea name="notes" />
          </label>
        </EventForm>
        <EventForm title="Insulin dose" action={insulin}>
          <label>
            Taken at
            <input required name="time" type="datetime-local" />
          </label>
          <label>
            Insulin
            <input required name="name" />
          </label>
          <div className="field-row">
            <label>
              Type
              <select name="type">
                <option>Basal</option>
                <option>Prandial</option>
                <option>Correction</option>
                <option>Mixed</option>
              </select>
            </label>
            <label>
              Units
              <input required min="0.1" step="0.1" name="units" type="number" />
            </label>
          </div>
          <label>
            Notes
            <textarea name="notes" />
          </label>
        </EventForm>
      </div>
      <section className="panel">
        <h2>Recent treatment timeline</h2>
        <div className="timeline">
          {timeline.length ? (
            timeline.map((item) => (
              <div key={item.time + item.text}>
                <time>{item.time.replace("T", " ")}</time>
                <b>{item.text}</b>
              </div>
            ))
          ) : (
            <p>No treatment events recorded yet.</p>
          )}
        </div>
      </section>
    </>
  );
}

function EventForm({
  title,
  action,
  children,
}: {
  title: string;
  action: (data: FormData) => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <form
      className="panel form"
      action={async (data) => {
        await action(data);
      }}
    >
      <h2>{title}</h2>
      {children}
      <Button type="submit">Save locally</Button>
    </form>
  );
}
