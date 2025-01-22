import { hijackReactcreateElement } from "@mybricks/render-core";

hijackReactcreateElement({});

export { js, Ui, Provider, Slot } from "./component";
export { Subject, merge } from "./utils/rx";
export { useVar } from "./hooks";
