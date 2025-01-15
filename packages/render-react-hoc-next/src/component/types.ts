import { Subject } from "@/utils/rx";

export type RegisterInput<T = unknown> = (
  value: T,
  proxy: Record<string, Subject<T>>,
) => void;
