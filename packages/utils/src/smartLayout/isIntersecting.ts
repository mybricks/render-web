/** 检查元素是否相交 */
export function isIntersecting({width: widthA, height: heightA, top: topA, left: leftA}, {width: widthB, height: heightB, top: topB, left: leftB}) {
  const rightA = leftA + widthA;
  const bottomA = topA + heightA;
  const rightB = leftB + widthB;
  const bottomB = topB + heightB;

  if (rightA <= leftB || leftA >= rightB || bottomA <= topB || topA >= bottomB) {
    return false; // 两个矩形不相交
  } else {
    return true; // 两个矩形相交
  }
}
