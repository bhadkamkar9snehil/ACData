import type { Reading } from "./types";

const values = [92, 107, 119, 135, 164, 128, 102, 88, 142, 176, 151, 124, 98, 111, 203, 156, 132, 74, 95, 121, 146, 188, 114, 84, 105, 139, 167, 126];

export const demoReadings: Reading[] = values.map((mgDl, index) => ({
  id: index + 1,
  timestamp: new Date(2026, 7, 17 + index, [7, 12, 18, 22][index % 4], 15).toISOString(),
  mgDl,
  status: [0x00, 0x41, 0x15, 0x29][index % 4],
  meal: ["Fasting", "Before meal", "After meal", "Bedtime"][index % 4],
}));
