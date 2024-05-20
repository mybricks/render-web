import os from "os";
import path from "path";
import fse from "fs-extra";
import prettier from "prettier";
import archiver from "archiver";
import type { ToBaseJSON, ToJSON, Frame } from "@mybricks/render-types";

import { handleScenesIndex, handleAppEntry, handleGlobalContext, handleCanvas } from "./handle";

const codeFormat = prettier.format
const codeFormatParserMap: {[key: string]: any} = {
  ".tsx": "babel-ts",
  ".ts": "babel-ts",
  ".ejs": "html",
  ".html": "html"
}

interface Config {
  /**
   * 模版、静态资源目录
   * @example
   * 目录地址
   *  - 各类静态资源（可选）
   *  - index.html（必须）
  */
  staticPath: string;
}

/**
 * 出React源代码
 * @return 源码工程压缩包地址字符串，存储于os.tmpdir()生成的临时目录内，最好在使用后手动清除
*/
export async function generateToReactCode(toJSON: ToJSON) {
  /** process.env.MYBRICKS_TOCODE_ENV === "test" 说明是本地测试，发布后使用os.tmpdir()生成临时文件夹 */
  const isTest = process.env.MYBRICKS_TOCODE_ENV === "test";
  const dirPath = isTest ? path.resolve(__dirname, "prj") : `${os.tmpdir()}/mybricks.tocode/${Math.random()}`;
  const projectDirectoryPath = path.resolve(dirPath, "template");
  const generate = new Generate(toJSON, projectDirectoryPath);

  await generate.start();

  const zipFilePath = path.resolve(dirPath, "./tocode-react.zip");

  if (!isTest) {
    /** 生成压缩文件 */
    const output = fse.createWriteStream(zipFilePath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(output);
    archive.directory(projectDirectoryPath, false);
    await archive.finalize();
    /** 删除工程目录 */
    fse.remove(projectDirectoryPath);
  }

  return zipFilePath;
}

// 模版目录
const templatePath = path.resolve(__filename, "../../../template");
// 模版全局上下文
const templateGlobalContextPath = path.resolve(templatePath, "src/globalContext/index.ts");

class Generate {

  /** 存储生成的代码字符串和写入文件路径 */
  codeArray: Array<{code: string; filePath: string;}> = [];

  /** TODO: 临时工程代码存放 */
  // projectDirectoryPath = path.resolve(__dirname, "prj"); // os.tmpdir()

  constructor(private toJSON: ToJSON, private projectDirectoryPath: string) {}

  async start() {
    /** 拷贝模版 */
    fse.copySync(templatePath, this.projectDirectoryPath);

    /** 处理全局上下文信息 */
    this.handleGlobalContext();

    /** 处理场景入口 */
    this.handleScenesIndex();

    /** 处理应用入口 */
    this.handleAppEntry();

    /** 处理各场景 */
    this.handleScenes();
    
    /** 处理配置 */
    // this.handleConfig();

    /** 写入代码文件 */
    await this.writeCodeFiles();
  }

  /** 处理全局上下文信息 */
  handleGlobalContext() {
    this.codeArray.push({
      code: handleGlobalContext(fse.readFileSync(templateGlobalContextPath, 'utf-8'), this.toJSON),
      filePath: path.resolve(this.projectDirectoryPath, "src/globalContext/index.ts")
    })
  }

  /** 处理页面入口 */
  handleScenesIndex() {
    this.codeArray.push({
      code: handleScenesIndex(this.toJSON),
      filePath: path.resolve(this.projectDirectoryPath, "src/slots/index.ts")
    })
  }

  /** 处理应用入口 */
  handleAppEntry() {
    this.codeArray.push({
      code: handleAppEntry(this.toJSON),
      filePath: path.resolve(this.projectDirectoryPath, "src/app.tsx")
    })
  }

  /** 处理各场景 */
  handleScenes() {
    const { scenes, frames } = this.toJSON;
    const sceneIdToFrameMap: {[key: string]: Frame} = frames.reduce((p, c) => {
      return {
        ...p,
        [c.id]: c
      }
    }, {})

    scenes.forEach((scene) => {
      this.handleCanvas({ scene, frame: sceneIdToFrameMap[scene.id] })
    })
  }

  /** 处理每一个tobasejson，即单画布 */
  handleCanvas({ scene, frame }: { scene: ToBaseJSON, frame: Frame }) {
    const codeArray = handleCanvas({ scene, frame })
    const { id } = scene;
    const { projectDirectoryPath } = this

    this.codeArray.push(...codeArray.map(({ code, filePath }) => {
      return {
        code,
        /** 这里需要处理路径，对应场景ID */
        filePath: path.resolve(projectDirectoryPath, `src/slots/slot_${id}/${filePath}`)
      }
    }))
  }

  /** 处理配置 */
  // handleConfig() {
  //   const { staticPath } = this.config;
  //   console.log("staticPath: ", staticPath)
  //   console.log("templatePath: ", path.resolve(templatePath, "./templates"))

  //   fse.copySync(staticPath, path.resolve(templatePath, "./templates"))
  // }

  async writeCodeFiles() {
    /** process.env.MYBRICKS_TOCODE_ENV === "test" 说明是本地测试，调用codeFormat */
    const isTest = process.env.MYBRICKS_TOCODE_ENV === "test";

    return Promise.all(this.codeArray.map(async ({ code, filePath }) => {
      if (isTest) {
        // TODO: 临时测试代码
        code = code.replace("@mybricks/render-react-hoc", "/Users/lianglihao/Documents/GitHub/render-web/packages/render-react-hoc/src")
        /** TODO: 暂时去除，ZL环境报错 */
        fse.outputFileSync(filePath, await codeFormat(code, { parser: codeFormatParserMap[getFileExtension(filePath)] }), "utf-8");
      } else {
        fse.outputFileSync(filePath, code, "utf-8");
      }
    }))
  }
}

/** 获取文件后缀 */
function getFileExtension(filePath: string) {
  const match = filePath.match(/\.(\w+)$/);
  return match ? match[0]: "";
}