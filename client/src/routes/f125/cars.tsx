import { createFileRoute } from "@tanstack/react-router";
import { F1Cars } from "../../components/f1/F1Cars";

export const Route = createFileRoute("/f125/cars")({
  component: F1Cars,
});
