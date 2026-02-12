/* eslint-disable @typescript-eslint/no-explicit-any */
import toCode from "../toCode";
import type { ToJSON } from "../toCode/types";
import handleSlot from "./handleSlot";
import {
  initComdefs,
  codePrettier,
  ImportManager,
  toSafeFileName,
  // getUtilsFiles,
} from "./utils";

interface ToTargetCodeConfig {
  target: "react";
  /** 若传入，则只导出该场景，且该场景目录提到根（不再放在 pages 下） */
  sceneId?: string;
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
  // addUtilFile: (params: { name: string; content: string }) => void;
  addUtilFile: (
    utilName: string,
    files: { name: string; content: string }[],
  ) => void;
  /** 获取事件 */
  getEventByDiagramId: (
    diagramId: string,
  ) => ReturnType<typeof toCode>["scenes"][0]["event"][0];
  refs: Map<string, boolean>;
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

  const singleSceneId = config.sceneId;
  const scenes = singleSceneId
    ? toCodejson.scenes.filter((s: any) => s.scene.id === singleSceneId)
    : toCodejson.scenes;
  if (singleSceneId && scenes.length === 0) {
    return buildFileTree([]);
  }

  // 单场景导出时，不建场景 ID 文件夹，页面文件直接放在根（index.tsx、style.less、components 等）
  const pagePathPrefix = (pageDir: string) =>
    singleSceneId ? "" : `pages/${pageDir}`;
  const joinPath = (base: string, ...parts: string[]) =>
    base ? `${base}/${parts.join("/")}` : parts.join("/");
  const relativeUtilsFromComponents = singleSceneId
    ? "../utils"
    : "../../../utils";

  // 收集所有生成的文件
  const allFiles: { path: string; content: string }[] = [];
  // 每个页面维护自己的组件集合
  const sceneComponentsMap = new Map<string, Set<string>>();
  // 每个页面维护自己的函数集合
  const sceneUtilsMap = new Map<string, Set<string>>();

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

  scenes.forEach((sceneData: any) => {
    const scene = sceneData.scene;
    const event = sceneData.event;
    const pageDir = toSafeFileName(scene.id);
    const basePath = pagePathPrefix(pageDir);
    const importManager = new ImportManager();
    const comIdToTargetMap: any = {};
    const currentSceneComponents = new Set<string>();
    sceneComponentsMap.set(scene.id, currentSceneComponents);
    const currentSceneUtils = new Set<string>();
    sceneUtilsMap.set(scene.id, currentSceneUtils);

    if (config.target === "react") {
      importManager.addImport({
        packageName: "react",
        dependencyNames: ["React"],
        importType: "default",
      });
    }

    const refs = new Map<string, boolean>();

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

        // 将组件文件放在当前页面的 components 目录下（路径片段做安全处理）
        const componentDir = joinPath(
          basePath,
          "components",
          toSafeFileName(componentName),
        );
        files.forEach((file) => {
          allFiles.push({
            path: `${componentDir}/${toSafeFileName(file.name)}`,
            content: file.content,
          });
        });
      },
      // addUtilFile: ({ name, content }) => {
      //   // 检查当前页面是否已经有这个组件
      //   if (currentSceneUtils.has(name)) return;
      //   currentSceneUtils.add(name);

      //   // 将函数文件放在当前页面的 utils 目录下（路径片段做安全处理）
      //   const componentDir = `pages/${pageDir}/utils`;
      //   allFiles.push({
      //     path: `${componentDir}/${toSafeFileName(name)}`,
      //     content: content,
      //   });
      // },
      addUtilFile: (
        utilName: string,
        files: { name: string; content: string }[],
      ) => {
        // 检查当前页面是否已经有这个组件
        if (currentSceneUtils.has(utilName)) return;
        currentSceneUtils.add(utilName);

        const componentDir = joinPath(
          basePath,
          "utils",
          toSafeFileName(utilName),
        );
        files.forEach((file) => {
          allFiles.push({
            path: `${componentDir}/${toSafeFileName(file.name)}`,
            content: file.content,
          });
        });
      },
      getEventByDiagramId: (diagramId) => {
        return event.find((event: any) => event.diagramId === diagramId)!;
      },
      refs,
    });

    const cssContent = codePrettier(css, "less");
    if (cssContent) {
      importManager.addStyleImport("./style.less");
    }

    let nextJsx = jsx;
    let refCode = "";
    let hasRef = false;
    refs.forEach((bool, key) => {
      if (!bool) {
        nextJsx = nextJsx.replace(`ref={${key}Ref}`, "");
      } else {
        refCode = `const ${key}Ref = useRef();`;
        hasRef = true;
      }
    });

    if (config.target === "react" && hasRef) {
      importManager.addImport({
        packageName: "react",
        dependencyNames: ["useRef"],
        importType: "named",
      });
    }

    const pageContent = codePrettier(
      `${importManager.toCode()}
        export default function () {
          ${refCode}
          return ${nextJsx}
        }`,
      "babel",
    );

    console.log("[@pageContent]", pageContent);

    // 假设每个 scene 是一个页面
    allFiles.push({
      path: joinPath(basePath, "index.tsx"),
      content: pageContent,
    });

    if (cssContent) {
      allFiles.push({
        path: joinPath(basePath, "style.less"),
        content: cssContent,
      });
    }

    // 为当前页面生成 components/index.ts (如果存在组件)
    if (currentSceneComponents.size > 0) {
      let importContent = "";
      // let exportContent = "";

      Array.from(currentSceneComponents).forEach((name) => {
        const safeName = toSafeFileName(name);
        importContent += `export { default as ${safeName} } from "./${safeName}";\n`;
        // importContent += `import Ori${safeName} from './${safeName}';\n`;
        // exportContent += `export const ${safeName} = wrap(Ori${safeName});\n`;
      });

      // importContent += `import { wrap } from '${relativeUtilsFromComponents}';\n`;

      allFiles.push({
        path: joinPath(basePath, "components", "index.ts"),
        // content: importContent + exportContent,
        content: importContent,
      });
    }
  });

  // 多页面时：根 index.tsx 重新导出第 0 个页面；单场景时页面已在根 index.tsx，无需再导出一层
  if (scenes.length > 0 && !singleSceneId) {
    const firstPageDir = toSafeFileName(scenes[0].scene.id);
    allFiles.push({
      path: "index.tsx",
      content: codePrettier(
        `export { default } from './pages/${firstPageDir}';`,
        "babel",
      ),
    });
  }

  // [TODO] 临时去除，下一版加上判断逻辑
  // allFiles.push(...getUtilsFiles());

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
