/* eslint-disable @typescript-eslint/no-explicit-any */
import { PropsWithChildren } from "react";
import context from "./context";

const Provider = (props: PropsWithChildren<{ env: any }>) => {
  if (!context.config) {
    context.config = props;
  }
  return props.children;
};

export default Provider;
