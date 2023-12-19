import React, { FC } from 'react'
import { observable, hijackReactcreateElement } from "@mybricks/render-web"

interface Props {
  data: object
  [key: string]: any
}

type InputsRegistFunction = (value: any) => void

export default class MybricksReact18ComponentTest {
  private inputs: {[key: string]: (value: any) => void} = new Proxy({}, {
    get: (_, name: string) => {
      return (value: any) => {
        const { inputTodo, inputRegisters } = this;
        const fn = inputRegisters[name]
        if (fn) {
          fn(value)
        } else {
          let todo = inputTodo[name]
          if (!todo) {
            inputTodo[name] = todo = []
          }
          todo.push({value})
        }
      }
    }
  })
  private inputRegisters: {[key: string]: InputsRegistFunction | undefined } = {}
  private inputTodo: {[key: string]: Array<{value: any}>} = {}
  private outputs: Array<{id: string, value: any}> = []

  constructor(private Component: FC<Props>, private props: Props) {
    hijackReactcreateElement({})
  }

  render() {
    const { Component, props, outputs, inputTodo, inputRegisters } = this
    const { data, env } = props
    const is = new Proxy({}, {
      get(_, name: string) {
        return (fn: InputsRegistFunction) => {
          inputRegisters[name] = fn
          const todo = inputTodo[name]
          if (todo) {
            while (todo.length) {
              const { value } = todo.shift()!
              fn(value)
            }
          }
        }
      }
    })
    const os = new Proxy({}, {
      get(_, name: string) {
        return (value: any) => {
          outputs.push({id: name, value})
        }
      }
    })
    const observableData: object = observable(JSON.parse(JSON.stringify(data)))

    cy.mountMybricksReact18Component(<Component
      data={observableData}
      env={env}
      inputs={is}
      outputs={os}
    />)

    return {
      /** 组件数据源 */
      data: observableData,
      /** 主动触发组件输入项 */
      inputs: this.inputs,
      /** 输出项触发按顺序写入的数组 */
      outputs
    }
  }
}
