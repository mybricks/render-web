import React from "react";
import { createRoot } from "react-dom/client";
import App from "@/app";
import { hijackReactcreateElement } from "@/observable";

hijackReactcreateElement();

const dom = document.getElementById("root");

if (dom) {
  const root = createRoot(dom);

  root.render(<App />);
} else {
  throw new Error("缺少ID为root的dom节点");
}
