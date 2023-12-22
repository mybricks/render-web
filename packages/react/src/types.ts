// export type T_RenderOptions = {
//   createPortal?,
//   debug?,
//   sceneId?,
//   events?,
//   env?,
//   comDefs?,
//   observable?,
//   ref?,
//   scenesOperate?,
//   debugLogger?,
//   _context?
// }


// TODO: 所有的any都后续补，先完成功能

export interface ToJSON {
  /** 版本号没什么用 */
  '-v': string;
  /**
   * - module - 模块
   * - fx - 全局Fx
   */
  type?: 'module' | 'fx'
}

export interface MultiSceneToJSON {
  scenes: ToJSON[]
  global: any
  modules: any
}

export interface MyBricksRenderPluginInstance {
	[index: string]: any;

	/**
	 * The run point of the plugin, required method.
	 */
	// apply: (compiler: Compiler) => void;
}