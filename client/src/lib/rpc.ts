import { hc } from "hono/client";
import type { AppType } from "../../../server/routes";

export const client = hc<AppType>("/");
