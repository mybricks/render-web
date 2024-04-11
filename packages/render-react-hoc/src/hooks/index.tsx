import { useContext, createContext } from "react";
import type { ReactNode } from "react";

import type { GlobalContext } from "..";

// @ts-ignore
export const MyBricksRenderContext = createContext<GlobalContext>({});

export interface MyBricksRenderProviderProps {
  children?: ReactNode;
  value: GlobalContext;
}

export function useMyBricksRenderContext() {
  const context = useContext(MyBricksRenderContext);

  return context;
}
