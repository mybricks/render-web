/* eslint-disable @typescript-eslint/no-explicit-any */
import * as CSS from "csstype";

// -- TOJSON 相关定义
export interface Style extends CSS.Properties {
  layout: "smart" | "flex-column";
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
        type: "defined";
        options: {
          id: string;
        };
      }[]
    >;
  };
  outputs: string[];
  inputs: string[];
  ioProxy: {
    id: string;
  };
  asRoot?: boolean;
  /** 判断全局变量 */
  global?: boolean;
}

export interface Scene {
  id: string;
  title: string;
  slot: Slot;
  coms: Record<string, ComInfo>;
  pinRels: Record<string, string[]>;
  deps: Def[];
  comsAutoRun: Record<string, { id: string }[]>;
  type: "normal" | "popup" | "module"; // 默认页面 | 弹窗 | 模块
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
    type: "normal" | "config";
    pinId: string;
  }[];
  outputs: {
    id: string;
    title: string;
  }[];
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
    type: "com" | "frame" | "var";
  };
  conAry: DiagramCon[];
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
      }
    | {
        type: "config";
        pinId: string;
        extValues: {
          config: {
            defaultValue: any;
          };
        };
      }
  >;
  outputs: {
    id: string;
    title: string;
  }[];
  coms: Record<string, Frame>;
  /**
   * mpa最外层才会有 root
   * 扩展的模块 extension
   */
  type: "fx" | "com" | "global" | "globalFx" | "root" | "extension";
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
