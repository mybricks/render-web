/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */

import React, { useMemo, useLayoutEffect } from 'react';

import { useMyBricksRenderContext } from './index'
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
  
  const { env, onError, logger, slot, getComDef } = useMemo(() => {
    const { env, debug } = options
    const slot = json.slot
    if (!env.canvas.isValid && !options._isNestedRender && debug && from === 'scene' && slot) {
      style.minHeight = slot.style.height;
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
        _isNestedRender: options._isNestedRender,
        _context
      }, {//////TODO goon
        observable: _context.observable
      })

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
            const { id, mockData } = input
            let value = void 0
            if (options.debug && typeof mockData !== 'undefined') {
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

  return (
    <ErrorBoundary errorTip={`页面渲染错误`}>
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
      />
    </ErrorBoundary>
  )
}
