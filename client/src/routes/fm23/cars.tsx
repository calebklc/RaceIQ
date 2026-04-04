import { createFileRoute } from "@tanstack/react-router";
import { CarsPage } from "../../components/CarsPage";

export const Route = createFileRoute("/fm23/cars")({
  component: CarsPage,
});
