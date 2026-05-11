import PocketBase from "pocketbase";
import type { TypedPocketBase } from "../pocketbase-types";

const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL ?? "http://localhost:8090";

export const pb = new PocketBase(POCKETBASE_URL) as TypedPocketBase;
