import toCode from "../../toCode";

const getUsedControllers = (
  event: ReturnType<typeof toCode>["scenes"][0]["event"],
) => {
  const usedControllers = new Set<string>();

  event.forEach((event) => {
    const {
      process: { nodesInvocation },
    } = event;

    nodesInvocation.forEach(
      (
        nodeInvocation: ReturnType<
          typeof toCode
        >["scenes"][0]["event"][0]["process"]["nodesInvocation"][0],
      ) => {
        const { type, meta, category, componentType } = nodeInvocation;
        if (componentType === "ui") {
          if (category === "module") {
            if (type === "exe") {
              usedControllers.add(meta.id);
            }
          } else {
            usedControllers.add(meta.id);
          }
        }
      },
    );
  });

  return usedControllers;
};

export { getUsedControllers };
