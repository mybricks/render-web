import * as CSS from "csstype";

export type Style = CSS.Properties;

/** 组件模型样式信息 */
export interface ComponentStyle extends Style {
  /** 风格化配置样式 */
  styleAry?: Array<{
    css: Style;
    /** css选择器 */
    selector: string;
    /** TODO: 是否全局？后面补充 */
    global?: boolean;
  }>
}

export interface ToJSON {
  /** 场景信息数组 */
  scenes: Array<ToBaseJSON>
  /**
   * 逻辑编排卡片信息列表
   */
  frames: Array<Frame>
}

/** 逻辑连线信息 */
export type ConAry = Array<{
  /** 唯一ID，没有实际意义 */
  id: string;
  /** 输出信息 */
  from: {
    /** 对应outputID */
    id: string;
    /** 谁输出的 */
    parent: {
      /** ID 目前是组件 */
      id: string;
      /** 类型 */
      type: "com" | "frame";
    }
    /** 对应outputID的标题 */
    title: string;
  }
  /** 输入信息 */
  to: {
    /** 对应inputID */
    id: string;
    /** 谁的输入 */
    parent: {
      /** ID 目前是组件 */
      id: string;
      /** 类型 */
      type: "com" | "frame";
    }
    /** 对应inputID的标题 */
    title: string;
  }
  /** 相同实例的节点，才会有以下信息，用于连接输入和输出 */
  finishPinParentKey?: string;
  startPinParentKey?: string;
}>;

interface DefaultDiagram {
    /** 场景卡片名称（没什么用） */
    title: string;
    /** 逻辑连线信息 */
    conAry: ConAry;
}

export interface ComDiagram extends DefaultDiagram {
  starter: {
    /** 组件 */
    type: "com"; 
    /** 对应组件ID */
    comId: string;
    /** 对应事件即输出项ID */
    pinId: string;
  }
}

export interface FrameDiagram extends DefaultDiagram {
  starter: {
    /** 场景 */
    type: "frame";
     /** 对应frameID */
    frameId: string;
    /** 对应多个输入列表 */
    pinAry: Array<{
      /** 输入ID */
      id: string;
      /** 输入标题 */
      title: string;
      /** 
       * 类型
       * - normal 默认值，没有意义
       * - config 配置项，一般frame才有
       */
      type: "normal" | "config";
    }>
  }
}

export interface VarDiagram extends DefaultDiagram {
  starter: {
    /** 变量 */
    type: "var";
    /** 对应变量组件ID */
    comId: string;
    /** 对应变量输出ID */
    pinId: string;
  }
}

export type Diagram = ComDiagram | FrameDiagram | VarDiagram;

/**
 * 逻辑编排卡片信息
 */
export interface Frame {
  /** id对应场景ID */
  id: string;
  /** 逻辑编排卡片信息列表 */
  diagrams: Array<Diagram>;
  /** fx卡片列表 */
  frames: Array<Frame>;
  /** 组件 - 作用域插槽卡片 */
  coms: {
    /** 组件ID */
    [key: string]: {
      /** 组件ID */
      id: string;
      /** 逻辑编排卡片信息 */
      frames: Array<Frame>;
    }
  }
}

export interface SlotStyle extends Style {
  /** 
   * 用于判断布局方式 
   *  - smart 智能
   *  - flex-column 纵向
   *  - flex-row 横向
   *  - absolute 自由
   */
  layout: "smart" | "flex-column" | "flex-row" | "absolute";
}

/** 插槽，体现组件排列信息、结构 */
export interface Slot {
  /** 插槽ID */
  id: string;
  /** 插槽标题 */
  title: string;
  /** 插槽样式信息 */
  style: SlotStyle;
  /** 插槽内组件树结构信息 */
  comAry: Array<ComponentNode>;
  /** 插槽内智能布局后组件树结构信息 */
  layoutTemplate: Array<DomNode | ComponentNode>;
  /** 类型，用于判断是否作用域插槽 */
  type?: "scope";
  /** 场景类型 */
  showType?: "popup";
}

export type Slots = {
  [key: string]: Slot
}

/** 组件详细信息 */
export interface Component {
  /** 组件唯一ID，由MyBricks引擎搭建时管控 */
  id: string;
  /** 基础信息 */
  def: {
    /** 唯一命名空间 */
    namespace: string;
    /** 版本号 */
    version: string;
    /** 类型 - 没有rtType的是ui组件 */
    rtType?: "js" | "js-autorun"
  }
  /** 组件名称 */
  title: string;
  /** 模型 */
  model: {
    /** 数据源 - 这里是任意就行了 */
    data: any;
    /** 样式 */
    style: ComponentStyle;
  }
  /** 输出项ID列表 */
  outputs: Array<string>;
  /** 输入项ID列表 */
  inputs: Array<string>;
  /** 私有输入项ID列表，从pinProxies读取相应的frame */
  _inputs: Array<string>;
  /** 如果在作用域插槽内 - 插槽ID */
  frameId?: string;
  /** 如果在作用域插槽内 - 该插槽的父组件ID */
  parentComId?: string;
}

export interface ToBaseJSON {
  /** 场景ID */
  id: string;
  /** 场景标题 */
  title: string;
  /** 插槽，体现组件排列信息、结构 */
  slot: Slot;
  /** 
   * 类型
   * 无 - 普通页面
   * popup - 弹出类
   */
  type?: "popup";
  /** 组件详细信息 组件ID -> 信息 */
  coms: {
    [key: string]: Component;
  }
  /** 逻辑面板连线信息 */
  cons: {
    [key: string]: Array<any>; // 后续用到了再补充
  }
  /** 输入对应的输出映射关系 */
  pinRels: {
    /** comID-inputID */
    [key: string]: Array<string>;
  }
  /** 
   * 用于多场景间跳转，例如调用私有的输入_inputs，根据comId-_inputsId 查找对应的frame
   * cons输出查找对应的fx卡片的输入
   * TODO: 待补充更多信息
   */
  pinProxies: {
    /** comId-_inputID */
    [key: string]: {
      /** 对应类型 */
      type: "frame";
      /** 对应frameID */
      frameId: string;
      /** 对应frame的inputID */
      pinId: string;
    }
  }
}

/** 智能布局dom节点 */
export interface DomNode {
  /** 唯一ID，没有实际意义 */
  id: string;
  /** 样式 */
  style: Style;
  /** 智能布局dom节点或组件节点数组 */
  elements: Array<DomNode | ComponentNode>
}

/** 组件节点 */
export interface ComponentNode {
  // 可能有slots
  /** 组件唯一ID */
  id: string;
  /** 复制相关，保证不同ID，有相同的name（解决搭建时style风格化相关问题） */
  name: string;
  /** 组件基础信息 */
  def: {
    /** 命名空间 */
    namespace: string;
    /** 版本号 */
    version: string;
  }
  /** 插槽 id => Slot，不一定有 */
  slots?: Slots
}