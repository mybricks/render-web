/* eslint-disable @typescript-eslint/no-explicit-any */
import * as CSS from "csstype";

// -- TOJSON 相关定义
export interface Style extends CSS.Properties {
  layout: "smart" | "flex-column" | "flex-row";
  widthFull?: boolean;
  widthAuto?: boolean;
  heightFull?: boolean;
  heightAuto?: boolean;
}

export interface Def {
  namespace: string;
  version: string;
  rtType?: "js" | "js-autorun";
}

export interface Com {
  id: string;
  name: string;
  def: Def;
  slots?: Record<string, Slot>;
  child?: {
    id: string;
    style: Style;
    elements: Array<Dom | Com>;
  };
}

export interface Dom {
  id: string;
  style: Style;
  elements: Array<Dom | Com>;
}

export interface Slot {
  id: string;
  comAry: Com[];
  layoutTemplate: Array<Dom | Com>;
  style: Style;
  type?: "scope";
  title: string;
}

/**
 * defined    默认
 * isAbstract 外部实现，出码不做实现
 * fx         调用fx
 */
export type ComEventType = "defined" | "isAbstract" | "fx";

export interface FrameIO {
  id: string;
  title: string;
  schema: any;
}

export interface ComInfo {
  id: string;
  title: string;
  def: Def;
  model: {
    data: Record<string, any>;
    style: Style;
    outputEvents: Record<
      string,
      {
        active: boolean;
        type: ComEventType;
        options: {
          id: string;
        };
        isAbstract?: boolean;
        /** isAbstract为true时，会有schema */
        schema?: any;
      }[]
    >;
    configBindWith: Array<{
      bindWith: string;
      xpath: string;
      toplKey: string | { in: string; out: string };
    }>;
  };
  /** 插槽ID，有值时，组件在作用域插槽内 */
  frameId?: string;
  /** 父组件ID，有值时，组件在作用域插槽内 */
  parentComId?: string;
  outputs: string[];
  inputs: string[];
  ioProxy: {
    id: string;
  };
  asRoot?: boolean;
  /** 判断全局变量 */
  global?: boolean;
  frames?: Array<{
    id: string;
    title: string;
    inputs: FrameIO[];
    outputs: FrameIO[];
  }>;
  // 变量一定有schema
  schema?: any;
}

export interface Scene {
  id: string;
  title: string;
  slot: Slot;
  coms: Record<string, ComInfo>;
  pinRels: Record<string, string[]>;
  deps: Def[];
  comsAutoRun: Record<string, { id: string }[]>;
  /**
   * normal - 默认页面
   * popup - 弹窗
   * module - 模块
   * extension-bus - 总线fx
   * fx - 全局fx
   */
  type: "normal" | "popup" | "module" | "extension-bus" | "fx";
  name: string;
  pinProxies: Record<
    string,
    {
      frameId: string;
      pinId: string;
    }
  >;
  pinValueProxies: Record<
    string,
    {
      frameId: string;
      pinId: string;
      type: "frame";
    }
  >;
  inputs: {
    id: string;
    type: "normal" | "config";
    pinId: string;
    title: string;
    schema: any;
  }[];
  outputs: {
    id: string;
    title: string;
    schema: any;
  }[];
  cons: Record<
    string,
    Array<{
      id: string;
      frameKey: string;
      targetFrameKey?: string;
      comId: string;
      pinId: string;
      configBindWith?: {
        toplKey: string;
      };
      extData?: {
        xpath: string;
      };
    }>
  >;
}

export interface DiagramCon {
  id: string;
  from: {
    id: string;
    title: string;
    parent: {
      id: string;
    };
  };
  to: {
    id: string;
    title: string;
    parent: {
      id: string;
      type: "frame" | "com";
    };
    type?: "ext"; // 目前用于表示ui组件的作用域插槽的扩展输入项
  };
  finishPinParentKey?: string;
  startPinParentKey?: string;
}

export type PinAry = {
  id: string;
  title: string;
  type: "normal" | "ext" | "config"; // 输入 | 扩展输入 ｜ 配置项
}[];

export interface Diagram {
  id: string;
  title: string;
  starter: {
    comId: string;
    frameId: string;
    pinId: string;
    pinAry: PinAry;
    /**
     * - com      组件
     * - frame    fx、插槽、api、bus
     * - var      变量
     * - listener 变量监听
     */
    type: "com" | "frame" | "var" | "listener";
    // 只有type为com时才有schema
    schema?: any;
  };
  conAry: DiagramCon[];
  description: string;
}

export interface Frame {
  id: string;
  title: string;
  diagrams: Diagram[];
  frames: Frame[];
  inputs: Array<
    | {
        type: "normal";
        pinId: string;
        schema: any;
      }
    | {
        type: "config";
        pinId: string;
        extValues: {
          config: {
            defaultValue: any;
          };
        };
        schema: any;
      }
  >;
  outputs: {
    id: string;
    title: string;
    schema: any;
  }[];
  coms: Record<string, Frame>;
  /**
   * mpa最外层才会有 root
   * 扩展的模块 extension
   */
  type:
    | "fx"
    | "com"
    | "global"
    | "globalFx"
    | "root"
    | "extension"
    | "extension-config"
    | "extension-api"
    | "extension-bus"
    | "extension-event";
}

interface Global {
  fxFrames: Scene[];
  comsReg: Record<string, ComInfo>;
}

export interface ToJSON {
  frames: Frame[];
  scenes: Scene[];
  global: Global;
  modules: Record<
    string,
    {
      id: string;
      json: Scene;
      title: string;
    }
  >;
  type: "spa" | "mpa";
}
