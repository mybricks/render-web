// 字符串集合包含了大小写字母和数字
const UUID_CHARTS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** 从0-9a-zA-Z挑选字符随机生成id */
export function uuid(length: number = 2): string {
  let id = '';
  // 随机选取字符长度
  for (let i = 0; i < length; i++) {
    id += UUID_CHARTS.charAt(Math.floor(Math.random() * UUID_CHARTS.length));
  }
  return id;
}

/** 生成一个属性删除器 */
export function generatePropertyRemover(obj: Record<any, any>): (key: any) => boolean {
  return (key) => {
    return Reflect.deleteProperty(obj, key);
  }
}

/** 获取最大公约数 */
export function findGCD(arr: Array<number>) {
  // 找到数组中的最小值
  const min = Math.min(...arr);

  // 初始化公约数为最小值
  let gcd = min;

  // 从最小值开始递减，直到找到最大公约数
  while (gcd > 1) {
    let isGCD = true;

    // 检查数组中的每个元素是否能被公约数整除
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] % gcd !== 0) {
        isGCD = false;
        break;
      }
    }

    // 如果所有元素都能被公约数整除，则找到最大公约数
    if (isGCD) {
      break;
    }

    // 否则，继续递减公约数
    gcd--;
  }

  return gcd;
}
