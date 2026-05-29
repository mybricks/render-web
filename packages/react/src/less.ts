export const getLazyCss = (lazyCss) => {
  return lazyCss?.default?.locals || lazyCss
}
