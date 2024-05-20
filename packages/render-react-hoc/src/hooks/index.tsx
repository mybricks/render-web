import React, { useState, useEffect, useContext, createContext } from "react";
import type { ReactNode } from "react";

import type { MyBricksGlobalContext } from "..";

// @ts-ignore
export const MyBricksRenderContext = createContext<MyBricksGlobalContext>({});

export interface MyBricksRenderProviderProps {
  children?: ReactNode;
  value: MyBricksGlobalContext;
}

export function useMyBricksRenderContext() {
  const context = useContext(MyBricksRenderContext);

  return context;
}


export const SceneContext = createContext<{
  /** 场景信息 */
  scene: any,
  _env: {
    currentScenes: {
      /** 关闭当前场景 */
      close: () => void;
    }
  }}>
  (
  // @ts-ignore
  {}
);

interface SceneProviderProps {
  children?: ReactNode;
  value: string;
}

export function SceneProvider({ children, value }: SceneProviderProps) {
  const { scenesMap } = useMyBricksRenderContext();
  /** 
   * 控制显示隐藏
   * 之后把做路由的时候把page和popup做区分吧
   */
  const [show, setShow] = useState(false);

  if (!scenesMap[value]) {
    // 注册场景ID
    /** 
     * 先hack一下，第一个进来的show字段默认是true，后面的都是false
     */
    let show = false;
    if (Object.keys(scenesMap).length === 0) {
      show = true
    }
    scenesMap[value] = {
      show,
      componentPropsMap: {},
      close() {
        setShow(false);
        /** 销毁操作 */
        scenesMap[value].componentPropsMap = {};
      },
      open() {
        setShow(true);
      }
    }
    if (show) {
      setShow(show)
    }
  }

  return show && (
    <SceneContext.Provider value={{
      get scene() {
        return scenesMap[value]
      },
      _env: {
        currentScenes: {
          close() {
            scenesMap[value].close();
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
