/* eslint-disable @typescript-eslint/no-explicit-any */
import toCode from "../toCode";
import type { ToJSON } from "../toCode/types";
import handleSlot from "./handleSlot";
import { initComdefs, codePrettier, ImportManager } from "./utils";

interface ToTargetCodeConfig {
  target: "react";
}

export interface BaseConfig extends ToTargetCodeConfig {
  TODO?: "Hello";
  getComDef: (def: { namespace: string; version: string }) => any;
  setComTarget: (id: string, target: any) => void;
  importManager: ImportManager;
  currentSceneId: string;
  addComponentFile: (
    componentName: string,
    files: { name: string; content: string }[],
  ) => void;
}

export interface FileNode {
  name: string;
  type: "file" | "folder";
  content?: string;
  children?: FileNode[];
}

const toTargetCode = (
  tojson: ToJSON,
  config: ToTargetCodeConfig,
): FileNode[] => {
  const toCodejson = toCode(tojson);
  console.log("[@toCodejson]", toCodejson);
  console.log("[@config]", config);
  console.log("[@comDefs]", initComdefs());

  // 收集所有生成的文件
  const allFiles: { path: string; content: string }[] = [];
  // 每个页面维护自己的组件集合
  const sceneComponentsMap = new Map<string, Set<string>>();

  const transformConfig = (config: ToTargetCodeConfig) => {
    const comDefs: any = initComdefs();
    return {
      ...config,
      getComDef: (def: { namespace: string; version: string }) => {
        return comDefs[`${def.namespace}-${def.version}`];
      },
    };
  };

  const baseConfig = transformConfig(config);

  toCodejson.scenes.forEach((sceneData: any) => {
    const scene = sceneData.scene;
    const importManager = new ImportManager();
    const comIdToTargetMap: any = {};
    const currentSceneComponents = new Set<string>();
    sceneComponentsMap.set(scene.id, currentSceneComponents);

    if (config.target === "react") {
      importManager.addImport({
        packageName: "react",
        dependencyNames: ["React"],
        importType: "default",
      });
    }

    const { jsx, css } = handleSlot(sceneData.ui, {
      ...baseConfig,
      currentSceneId: scene.id,
      setComTarget(id: string, target: any) {
        comIdToTargetMap[id] = target;
      },
      importManager,
      addComponentFile: (
        componentName: string,
        files: { name: string; content: string }[],
      ) => {
        // 检查当前页面是否已经有这个组件
        if (currentSceneComponents.has(componentName)) return;
        currentSceneComponents.add(componentName);

        // 将组件文件放在当前页面的 components 目录下
        const componentDir = `pages/${scene.id}/components/${componentName}`;
        files.forEach((file) => {
          allFiles.push({
            path: `${componentDir}/${file.name}`,
            content: file.content,
          });
        });
      },
    });

    const pageContent = codePrettier(
      `${importManager.toCode()}
        export default function () {
          return ${jsx}
        }`,
      "babel",
    );

    const cssContent = codePrettier(css, "less");

    // 假设每个 scene 是一个页面
    allFiles.push({
      path: `pages/${scene.id}/index.tsx`,
      content: pageContent,
    });

    if (cssContent) {
      allFiles.push({
        path: `pages/${scene.id}/style.less`,
        content: cssContent,
      });
    }

    // 为当前页面生成 components/index.ts (如果存在组件)
    if (currentSceneComponents.size > 0) {
      const exportContent = Array.from(currentSceneComponents)
        .map((name) => {
          return `export { default as ${name} } from './${name}';`;
        })
        .join("\n");

      allFiles.push({
        path: `pages/${scene.id}/components/index.ts`,
        content: exportContent,
      });
    }

    console.log("[result]", {
      jsx: pageContent,
      css: cssContent,
    });
  });

  return buildFileTree(allFiles);
};

// 工具函数：构建文件树
function buildFileTree(files: { path: string; content: string }[]): FileNode[] {
  const root: FileNode[] = [];

  files.forEach(({ path, content }) => {
    const parts = path.split("/");
    let currentLevel = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      let existingNode = currentLevel.find((node) => node.name === part);

      if (!existingNode) {
        const newNode: FileNode = {
          name: part,
          type: isFile ? "file" : "folder",
          ...(isFile ? { content } : { children: [] }),
        };
        currentLevel.push(newNode);
        existingNode = newNode;
      }

      if (!isFile) {
        currentLevel = existingNode.children!;
      }
    });
  });

  return root;
}

export default toTargetCode;

type ToCodeResult = ReturnType<typeof toCode>;
export type UI = ToCodeResult["scenes"][0]["ui"];
