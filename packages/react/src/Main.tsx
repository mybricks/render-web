/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */

import React, {
  useMemo,
  useCallback,
  useLayoutEffect,
  useEffect,
  useState,
} from 'react';

import { useMyBricksRenderContext } from './index'
import executor from '../../core/executor'
import RenderSlot from './RenderSlot';
import Notification from './Notification';
import ErrorBoundary from './ErrorBoundary';
import {observable as defaultObservable} from './observable';

export default function Main({json, opts, style = {}, className = '', root = true, from}: { json, opts, style?, className?, root: boolean, from?: string }) {
  const _context = useMyBricksRenderContext()
  
  //环境变量，此处可以定义连接器、多语言等实现
  const { env, onError, logger, slot, getComDef } = useMemo(() => {
    const { env, debug } = opts
    if (debug && from === 'scene') {
      style.minHeight = 800
    }

    return {
      env,
      onError: _context.onError,
      logger: _context.logger,
      getComDef: (def) => _context.getComDef(def),
      slot: json.slot,
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
        events: opts.events,
        env,
        ref(_refs) {
          refs = _refs
          if (typeof opts.ref === 'function') {
            opts.ref(_refs)
            // 如果被代理，那么inputs由外部处理
            activeTriggerInput = false
          }
        },
        onError,
        debug: opts.debug,
        debugLogger: opts.debugLogger,
        logger,
        scenesOperate: opts.scenesOperate,
        _context
      }, {//////TODO goon
        observable: opts.observable || defaultObservable//传递获取响应式的方法
      })

      return [context, refs, activeTriggerInput]
    } catch (ex: any) {
      console.error(ex);
      Notification.error(`导出的JSON.script执行异常: ${ex?.stack || ex?.message || ex?.toString?.()}`);
      throw new Error(`导出的JSON.script执行异常.`)
    }
  }, [])

  useLayoutEffect(() => {
    if (!opts.disableAutoRun) {
      if (activeTriggerInput) {
        const { inputs } = refs
        const jsonInputs = json.inputs
        if (inputs && Array.isArray(jsonInputs)) {
          jsonInputs.forEach((input) => {
            const { id, mockData } = input
            let value = void 0
            if (opts.debug && typeof mockData !== 'undefined') {
              try {
                value = JSON.parse(decodeURIComponent(mockData))
              } catch {
                value = mockData
              }
            }
            inputs[id](value)
          })
        }
      }
      refs.run()
    }
  }, [])

  // TODO:
  useEffect(() => {
    const intervalList = []
    let originalSetInterval
    const handle = opts.debug && setInterval.name !== 'mySetInterval' && json.type !== 'module'
    if (handle) {
      originalSetInterval = setInterval;
      setInterval = function mySetInterval(...args) {
        const id = originalSetInterval(...args);
        intervalList.push(id);
        return id
      };
    }
   
    return () => {
      if (handle) {
        // if (typeof opts.debug === "function") {
        //   _context?.debuggerPanel?.destroy()
        // }
        setInterval = originalSetInterval
        intervalList.forEach((intervalId) =>
          clearInterval(intervalId)
        )
      }
    }
  }, [])

  return (
    <ErrorBoundary errorTip={`页面渲染错误`}>
      <RenderSlot
        env={env}
        style={style}
        _env={opts._env}
        slot={slot}
        getComDef={getComDef}
        context={context}
        className={className}
        createPortal={opts.createPortal || (() => {})}
        onError={onError}
        logger={logger}
        root={root}
      />
    </ErrorBoundary>
  )
}
