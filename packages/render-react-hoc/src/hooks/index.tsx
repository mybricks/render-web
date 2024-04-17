import React, { useContext, createContext } from "react";
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


export const SceneContext = createContext<{_env: {
  currentScenes: {
    /** 关闭当前场景 */
    close: () => void;
  }
}}>(
  // @ts-ignore
  {}
);

interface SceneProviderProps {
  children?: ReactNode;
  value: string;
}

export function SceneProvider({ children, value }: SceneProviderProps) {
  const globalContext = useMyBricksRenderContext();
  return (
    <SceneContext.Provider value={{
      _env: {
        currentScenes: {
          close() {
            globalContext.closeScene(value);
          }
        }
      }
    }}>
      {children}
    </SceneContext.Provider>
  )
}

export function useSceneContext() {
  const context = useContext(SceneContext);

  return context;
}
