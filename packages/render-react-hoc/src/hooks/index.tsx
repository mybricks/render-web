import { useContext, createContext } from "react";
import type { ReactNode } from "react";

interface ContextValue {
  env: any;
}

export const MyBricksRenderContext = createContext<ContextValue>({ env: {} });

export interface MyBricksRenderProviderProps {
  children?: ReactNode;
  value: ContextValue;
}

export function useMyBricksRenderContext() {
  const context = useContext(MyBricksRenderContext);

  return context;
}
