import { hijackReactcreateElement } from "@mybricks/render-core";

hijackReactcreateElement({});

export { js, Ui, Provider, Slot, Module } from "./component";
export { Subject, merge, inputs, join } from "./utils/rx";
export { default as deepObjectMerge } from "./utils/deepObjectMerge";
export { useVar, useCanvasState } from "./hooks";
