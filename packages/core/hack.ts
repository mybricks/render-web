/** 
 * 这里用于判断组件中relOutputs和outputs同ID的情况，兼容老组件，后续组件不存在这样的情况
 * 搭建时需要重新聚焦下事件卡片来刷新数据
 * 不存在inReg.startPinParentKey说明不是被触发的relOutputs，不允许进入下一步
 */
export function canNextHackForSameOutputsAndRelOutputs(fromCom: any, inReg: any) {
  if (["test.text", "fangzhou.normal-pc.table-blocks"].includes(fromCom?.def?.namespace)) {
    if (inReg.startPinParentKey) {
      return false;
    }
  }
  return true;
}
