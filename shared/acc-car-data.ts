import { readFileSync } from "fs";
import { resolve } from "path";
import { SHARED_DIR } from "./resolve-data";

interface AccCar {
  id: number;
  model: string;
  name: string;
  class: string;
}

let carMap: Map<number, AccCar> | null = null;
let modelMap: Map<string, AccCar> | null = null;

function ensureLoaded(): void {
  if (carMap) return;
  carMap = new Map();
  modelMap = new Map();
  const csv = readFileSync(resolve(SHARED_DIR, "games/acc/cars.csv"), "utf-8");
  const lines = csv.trim().split("\n").slice(1); // skip header
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Format: id,model,name,class
    const parts = trimmed.split(",");
    if (parts.length < 4) continue;
    const id = parseInt(parts[0], 10);
    const model = parts[1].trim();
    // Name may contain commas, so rejoin middle parts
    const carClass = parts[parts.length - 1].trim();
    const name = parts.slice(2, parts.length - 1).join(",").trim();
    if (!isNaN(id)) {
      const car: AccCar = { id, model, name, class: carClass };
      carMap.set(id, car);
      modelMap!.set(model, car);
    }
  }
}

export function getAccCarName(ordinal: number): string {
  ensureLoaded();
  const car = carMap!.get(ordinal);
  return car ? car.name : `Car #${ordinal}`;
}

export function getAccCarNameByModel(model: string): string {
  ensureLoaded();
  const car = modelMap!.get(model);
  return car ? car.name : model;
}

export function getAccCarByModel(model: string): AccCar | undefined {
  ensureLoaded();
  return modelMap!.get(model);
}

export function getAccCarClass(ordinal: number): string | undefined {
  ensureLoaded();
  return carMap!.get(ordinal)?.class;
}

export function getAllAccCars(): AccCar[] {
  ensureLoaded();
  return Array.from(carMap!.values());
}
