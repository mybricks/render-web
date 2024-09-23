/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */

import React, { useMemo, useLayoutEffect } from 'react';

import { useModuleContext, useMyBricksRenderContext } from './index'
import executor from '../../core/executor'
import RenderSlot from './RenderSlot';
import Notification from './Notification';
import ErrorBoundary from './ErrorBoundary';

// ToJSON

import type { ToJSON } from "./types";

interface Props {
  json: ToJSON;
  options: any;
  style?: any;
  className?: string;
  root: boolean;
  from?: 'scene';
}

export default function Main({json, options, style = {}, className = '', root = true, from}: Props) {
  const _context = useMyBricksRenderContext()
  const _moduleContext = useModuleContext();
  
  const { env, onError, logger, slot, getComDef } = useMemo(() => {
    const { debug } = options
    const { env } = _moduleContext;
    const slot = json.slot
    if (!env.canvas.isValid && !options._isNestedRender && debug && from === 'scene' && slot && slot.type !== "module" && slot.showType !== "module") {
      /**
       * 1. 调试模式
       * 2. 场景（页面）
       * 3. 非模块
       */
      // style.minHeight = slot.style.height;
      style.flex = 1
    }

    if (slot?.showType === "module" || slot?.type === "module") {
      /** 做为组件使用的场景 - 目前是云组件出码，引擎配置showType: "module" */
      const { style: slotStyle } = slot;

      if (!style.hasOwnProperty('height')) {
        if (slotStyle.heightAuto) {
          style.height = "fit-content"
        } else if (slotStyle.heightFull) {
          style.height = "100%"
        } else {
          style.height = slotStyle.height
        }
      }

      if (!style.hasOwnProperty('width')) {
        if (slotStyle.widthAuto) {
          style.width = "fit-content"
        } else if (slotStyle.widthFull) {
          style.width = "100%"
        } else {
          style.width = slotStyle.width
        }
      }

      slot.style.backgroundColor = slot.style.backgroundColor || "#ffffff00";
    }

    if (json.type === "module") {
      // 修复模块调试时默认白色背景问题
      slot.style.backgroundColor = slot.style.backgroundColor || "#ffffff00";
    }

    if (_context._v === "2024-diff") {
      json._v = _context._v
    }

    return {
      env,
      onError: _context.onError,
      logger: _context.logger,
      getComDef: (def: any) => _context.getComDef(def),
      slot,
      _context
    }
  }, [])

  //根据script生成context对象
  const [context, refs, activeTriggerInput] = useMemo(() => {
    try {
      let refs
      let activeTriggerInput = true
      const context = executor({
        json,
        getComDef,
        events: options.events,
        env,
        ref(_refs: any) {
          refs = _refs
          if (typeof options.ref === 'function') {
            options.ref(_refs)
            // 如果被代理，那么inputs由外部处理
            activeTriggerInput = false
          }
        },
        onError,
        debug: options.debug,
        debugLogger: options.debugLogger,
        logger,
        scenesOperate: options.scenesOperate,
        _env: options._env,
        _isNestedRender: options._isNestedRender,
        _isNestCom: options._isNestCom,
        _context,
        rootId: options.rootId
      }, {//////TODO goon
        observable: _context.observable
      })

      // context.styleMap = {}

      return [context, refs, activeTriggerInput]
    } catch (ex: any) {
      console.error(ex);
      Notification.error(`导出的JSON.script执行异常: ${ex?.stack || ex?.message || ex?.toString?.()}`);
      throw new Error(`导出的JSON.script执行异常.`)
    }
  }, [])

  useLayoutEffect(() => {
    if (!options.disableAutoRun) {
      if (activeTriggerInput) {
        const { inputs } = refs
        const jsonInputs = json.inputs
        if (inputs && Array.isArray(jsonInputs)) {
          jsonInputs.forEach((input) => {
            const { id, mockData, type, extValues } = input
            let value = void 0
            if (options.debug) {
              if (type === "config" && extValues?.config && "defaultValue" in extValues.config) {
                try {
                  value = JSON.parse(decodeURIComponent(extValues.config.defaultValue))
                } catch {
                  value = extValues.config.defaultValue
                }
              } else {
                try {
                  value = JSON.parse(decodeURIComponent(mockData))
                } catch {
                  value = mockData
                }
              }
            }
            inputs[id](value)
          })
        }
      }
      refs.run()
    }
  }, [])

  return (
    <ErrorBoundary errorTip={`页面渲染错误`} options={options}>
      <RenderSlot
        env={env}
        style={style}
        _env={options._env}
        slot={slot}
        getComDef={getComDef}
        context={context}
        className={className}
        createPortal={options.createPortal || (() => {})}
        onError={onError}
        logger={logger}
        root={root}
        options={options}
        {...json.type === "module" ? { // 模块添加画布的点击事件
          onClick() {
            options.outputs?.["click"]();
          }
        } : {}}
      />
    </ErrorBoundary>
  )
}
