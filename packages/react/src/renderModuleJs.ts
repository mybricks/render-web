/* eslint-disable @typescript-eslint/no-explicit-any */
import executor, { Var } from "../../core/executor";
import { globalVariables } from "./RenderModuleComponent";

// [TODO] 马上要处理的，全局变量问题，全局使用一份
const renderModuleJs = ({ json, options, _context }: any) => {
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

  executor(
    {
      json: json.scenes[0],
      getComDef: (def: any) => _context.getComDef(def),
      // @ts-expect-error 忽略即可
      events: options.events,
      env: options.env,
      ref(_refs: any) {
        if (typeof options.ref === "function") {
          options.ref(_refs);
        } else {
          const { inputs } = _refs;
          const jsonInputs = json.inputs;
          if (inputs && Array.isArray(jsonInputs)) {
            jsonInputs.forEach((input) => {
              const { id, mockData, type, extValues } = input;
              let value = void 0;
              if (options.debug) {
                if (
                  type === "config" &&
                  extValues?.config &&
                  "defaultValue" in extValues.config
                ) {
                  try {
                    value = JSON.parse(
                      decodeURIComponent(extValues.config.defaultValue),
                    );
                  } catch {
                    value = extValues.config.defaultValue;
                  }
                } else {
                  try {
                    value = JSON.parse(decodeURIComponent(mockData));
                  } catch {
                    value = mockData;
                  }
                }
              }
              inputs[id](value);
            });
          }
          _refs.run();
        }
      },
      onError: _context.onError,
      debug: options.debug,
      debugLogger: options.debugLogger,
      logger: _context.logger,
      scenesOperate: options.scenesOperate,
      _isNestedRender: options._isNestedRender,
      _isNestCom: options._isNestCom,
      _isModuleCom: true,
      _context,
    },
    {
      observable: _context.observable,
    },
  );
};

export default renderModuleJs;
