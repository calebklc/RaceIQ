import { createFileRoute } from "@tanstack/react-router";
import { AccCars } from "../../components/acc/AccCars";

export const Route = createFileRoute("/acc/cars")({
  component: AccCars,
});
