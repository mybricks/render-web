declare module '*.less' {
  const classes: { [key: string]: string };
  export default classes;
}

/**
 * 组件信息
 */
interface Com {
  /**
   * 随机数ID（唯一）
   */
  id: string;
  /**
   * 组件信息
   */
  def: {
    version: string;
    namespace: string;
  }
  /**
   * 插槽（{插槽ID: 插槽内组件信息数组}）
   */
  slots?: {
    [key: string]: Array<T_Com>
  }
}
