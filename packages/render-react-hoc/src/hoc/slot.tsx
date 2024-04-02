import React from "react";
import type { ReactNode } from "react";

interface Params {
  style: any;
  children?: ReactNode;
}

export function SlotWrapper(params: Params) {
  return <div style={params.style}>{params.children}</div>;
}
