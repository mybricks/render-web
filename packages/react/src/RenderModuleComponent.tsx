/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo } from "react";
import { Var } from "../../core/executor";
import Main from "./Main";
import { Modules, ModuleContextProvider, useMyBricksRenderContext } from ".";

export const globalVariables: any = {};

const RenderModuleComponent = ({ json, options, style = {} }: any) => {
  const _context = useMyBricksRenderContext();
  const { env, modules } = useMemo(() => {
    let moduleId = options.moduleId;
    let moduleVersion = options.moduleVersion;
    if (!moduleId) {
      if (Array.isArray(json.scenes)) {
        moduleId = json.scenes[0].extra.moduleId;
        moduleVersion = json.scenes[0].extra.moduleVersion;
      } else {
        moduleId = json.extra.moduleId;
        moduleVersion = json.extra.moduleVersion;
      }
    }

    if (!globalVariables[moduleId]) {
      // 初始化全局变量
      // [TODO] 全局变量默认值
      globalVariables[moduleId] = new Var();
      _context.onCompleteCallBacks.push(() => {
        // 调试结束销毁全局变量
        Reflect.deleteProperty(globalVariables, moduleId);
      });
    }

    options.env.scenesOperate.var = globalVariables[moduleId];
    const scenesOperate = options.env.scenesOperate;
    options.env.scenesOperate = {
      ...scenesOperate,
      inputs(params: any) {
        scenesOperate.inputs(params, {
          moduleId,
          moduleVersion,
        });
      },
      open(params: any) {
        scenesOperate.open(params, {
          getFxFrame(frameId: string) {
            return json.global.fxFrames.find((fxFrame: any) => {
              return fxFrame.id === frameId;
            });
          },
        });
      },
    };
    options.scenesOperate = options.env.scenesOperate;
    const canvas = options.env.canvas;
    options.env.canvas = {
      ...canvas,
      open: (
        pageId: any,
        params: any,
        openType: any,
        historyType: any,
        configs: any = {},
      ) => {
        canvas.open(pageId, params, openType, historyType, {
          ...configs,
          moduleId,
          moduleVersion,
          mergeToJson: json,
        });
      },
    };

    const callConnector = options.env.callConnector;

    if (callConnector) {
      options.env.callConnector = (connector, params, config) => {
        return callConnector(connector, params, config, {
          globalVars: new Proxy(
            {},
            {
              get(_, key) {
                return globalVariables[moduleId].getValueByTitle(key);
              },
            },
          ),
        });
      };
    }

    const modules = (window as any)[`module_${moduleId}`].modules;

    options.env.getModuleJSON = (moduleId: string) => {
      return modules[moduleId];
    };

    return {
      env: options.env,
      modules: new Modules(modules),
    };
  }, []);

  return (
    <ModuleContextProvider value={{ env, modules }}>
      <Main
        json={Array.isArray(json.scenes) ? json.scenes[0] : json}
        options={options}
        style={style}
        className={""}
        from={"scene"}
        root={false}
      />
    </ModuleContextProvider>
  );
};

export default RenderModuleComponent;
