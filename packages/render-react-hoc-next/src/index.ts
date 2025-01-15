import { hijackReactcreateElement } from "@mybricks/render-core";

hijackReactcreateElement({});

export { js, Ui, Provider } from "./component";
export { Subject } from "./utils/rx";
