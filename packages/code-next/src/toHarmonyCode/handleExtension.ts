/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 处理Extension事件卡片
 */

import toCode from "../toCode";
import {
  ImportManager,
  indentation,
  ioTypeCode,
  genDescription,
} from "./utils";
import { handleProcess } from "./handleCom";
import type { ToSpaCodeConfig, Result } from "./index";
import type { ToJSON } from "../toCode/types";

interface HandleExtensionParams {
  tojson: ToJSON;
  extensionEvents: ReturnType<typeof toCode>["extensionEvents"];
}

const handleExtension = (
  params: HandleExtensionParams,
  config: ToSpaCodeConfig,
) => {
  const { tojson, extensionEvents } = params;
  const result: Result = [];
  const importManager = new ImportManager(config);
  const addDependencyImport = importManager.addImport.bind(importManager);

  const eventCode = genEvent(
    {
      tojson,
      extensionEvents: extensionEvents.filter((extensionEvent) => {
        return extensionEvent.meta.type === "extension-event";
      }),
    },
    { ...config, addParentDependencyImport: addDependencyImport },
  );

  const apiCode = genApi(
    {
      tojson,
      extensionEvents: extensionEvents.filter((extensionEvent) => {
        return extensionEvent.meta.type === "extension-api";
      }),
    },
    { ...config, addParentDependencyImport: addDependencyImport },
  );

  const configCode = genConfig(
    {
      tojson,
      extensionEvents: extensionEvents.filter((extensionEvent) => {
        return extensionEvent.meta.type === "extension-config";
      }),
    },
    { ...config, addParentDependencyImport: addDependencyImport },
  );

  result.push({
    type: "api",
    content:
      (apiCode ? `${apiCode}\n\n` : "") +
      (configCode ? `${configCode}\n\n` : "") +
      eventCode,
    importManager,
    name: "abstractEventTypeDef",
  });

  const extensionBusImportManager = new ImportManager(config);
  const addDependencyExtensionBusImport =
    extensionBusImportManager.addImport.bind(extensionBusImportManager);

  const busCode = genBus(
    {
      tojson,
      extensionEvents: extensionEvents.filter((extensionEvent) => {
        return extensionEvent.meta.type === "extension-bus";
      }),
    },
    { ...config, addParentDependencyImport: addDependencyExtensionBusImport },
  );

  if (busCode) {
    result.push({
      content: busCode,
      importManager: extensionBusImportManager,
      type: "extension-bus",
      name: "系统总线",
    });
  }

  return result;
};

export default handleExtension;

interface GenConfig extends ToSpaCodeConfig {
  addParentDependencyImport: (typeof ImportManager)["prototype"]["addImport"];
}

const genConfig = (params: HandleExtensionParams, config: GenConfig) => {
  const { extensionEvents } = params;
  const { addParentDependencyImport } = config;

  if (!extensionEvents.length) {
    return "";
  }

  // config一定只有一个
  const extensionEvent = extensionEvents[0];
  const event = extensionEvent.events[0];
  let useParams = false;

  const eventParams = event.paramPins.reduce<Record<string, string>>(
    (pre, cur) => {
      pre[cur.id] = `value.${cur.id}`;
      return pre;
    },
    {},
  );
  const code = handleProcess(event, {
    ...config,
    depth: 2,
    getParams: () => {
      useParams = true;
      return eventParams;
    },
    getComponentPackageName: () => {
      return config.getComponentPackageName({ type: "extensionEvent" });
    },
    addParentDependencyImport,
    getComponentMeta: ((com, configMeta) => {
      return config.getComponentMeta(com, {
        ...configMeta,
        json: extensionEvent.meta,
      });
    }) as typeof config.getComponentMeta,
  } as any);

  addParentDependencyImport({
    packageName: config.getUtilsPackageName(),
    dependencyNames: ["MyBricks"],
    importType: "named",
  });

  return (
    `export const config = (${useParams ? "value: MyBricks.Any" : ""}) => {` +
    (code ? `\n${code}` : "") +
    `\n}`
  );
};

const genApi = (params: HandleExtensionParams, config: GenConfig) => {
  const { extensionEvents } = params;
  const { addParentDependencyImport } = config;

  if (!extensionEvents.length) {
    return "";
  }

  let apiCode = "";

  extensionEvents.forEach((extension) => {
    const { meta, events } = extension;
    const event = events[0];
    const params = {
      open: "value",
      call: "value",
    };
    const code = handleProcess(event, {
      ...config,
      depth: 2,
      getParams: () => {
        return params;
      },
      getComponentPackageName: () => {
        return config.getComponentPackageName({ type: "extensionEvent" });
      },
      addParentDependencyImport,
      getComponentMeta: ((com, configMeta) => {
        return config.getComponentMeta(com, {
          ...configMeta,
          json: meta,
        });
      }) as typeof config.getComponentMeta,
    } as any);

    const indent = indentation(config.codeStyle!.indent);
    const indent2 = indentation(config.codeStyle!.indent * 2);
    const indent3 = indentation(config.codeStyle!.indent * 3);

    /** 结果interface定义 */
    const returnInterface = event.frameOutputs.length
      ? `${indent2}interface Return {` +
        `\n${event.frameOutputs.reduce((pre: string, frameOutput: any) => {
          return (
            pre +
            (`${indent3}/** ${frameOutput.title} */` +
              `\n${indent3}${frameOutput.id}: MyBricks.EventValue\n`)
          );
        }, "")}` +
        `${indent2}}`
      : "";

    apiCode +=
      `${indent}/** ${event.title} */` +
      `\n${indent}${event.title}: MyBricks.Api = transformApi((value: MyBricks.Any) => {` +
      (returnInterface ? `\n${returnInterface}` : "") +
      `\n${code}${returnInterface ? " as Return" : ""}` +
      `\n${indent}})\n`;

    addParentDependencyImport({
      packageName: config.getUtilsPackageName(),
      dependencyNames: ["MyBricks", "transformApi"],
      importType: "named",
    });
  });

  return `class Api {` + `\n${apiCode}}` + `\n\nexport const api = new Api()`;
};

const genBus = (params: HandleExtensionParams, config: GenConfig) => {
  const { extensionEvents } = params;
  const { addParentDependencyImport } = config;

  if (!extensionEvents.length) {
    return "";
  }

  let busCode = "";

  extensionEvents.forEach((extension) => {
    const { meta, events } = extension;
    const event = events[0];
    const params = {
      open: "value",
      call: "value",
    };
    const code = handleProcess(event, {
      ...config,
      depth: 2,
      getParams: () => {
        return params;
      },
      getComponentPackageName: () => {
        return config.getComponentPackageName({ type: "extensionEvent" });
      },
      addParentDependencyImport,
      getComponentMeta: ((com, configMeta) => {
        return config.getComponentMeta(com, {
          ...configMeta,
          json: meta,
        });
      }) as typeof config.getComponentMeta,
    } as any);

    const indent = indentation(config.codeStyle!.indent);
    const indent2 = indentation(config.codeStyle!.indent * 2);
    const indent3 = indentation(config.codeStyle!.indent * 3);

    /** 结果interface定义 */
    const returnInterface = event.frameOutputs.length
      ? `${indent2}interface Return {` +
        `\n${event.frameOutputs.reduce((pre: string, frameOutput: any) => {
          return (
            pre +
            (`${indent3}/** ${frameOutput.title} */` +
              `\n${indent3}${frameOutput.id}: MyBricks.EventValue\n`)
          );
        }, "")}` +
        `${indent2}}`
      : "";

    busCode +=
      `${indent}/** ${event.title} */` +
      `\n${indent}${event.title}: MyBricks.Api = createFx((value: MyBricks.Any) => {` +
      (returnInterface ? `\n${returnInterface}` : "") +
      `\n${code}${returnInterface ? " as Return" : ""}` +
      `\n${indent}})\n`;

    addParentDependencyImport({
      packageName: config.getUtilsPackageName(),
      dependencyNames: ["MyBricks", "createFx"],
      importType: "named",
    });
  });

  return (
    "/** 系统总线 */" +
    `\nclass Bus {` +
    `\n${busCode}}` +
    `\n\nexport const bus = new Bus()`
  );
};

const genEvent = (params: HandleExtensionParams, config: GenConfig) => {
  const { tojson, extensionEvents } = params;
  const { addParentDependencyImport } = config;

  if (!extensionEvents.length) {
    return "";
  }

  addParentDependencyImport({
    packageName: config.getUtilsPackageName(),
    dependencyNames: ["MyBricks", "createEvent", "transformEvents"],
    importType: "named",
  });

  // 事件输入、回调定义
  let typeCode = "";
  // 事件定义
  let eventCode = "";
  // 事件初始化
  let eventCreateCode = "";

  const indent = indentation(config.codeStyle!.indent);
  const ioTypeCodeConfig = {
    initialIndent: 0,
    indentSize: config.codeStyle!.indent,
  };

  extensionEvents.forEach((event) => {
    const extensionEvent = tojson.frames.find(
      (frame) => frame.id === event.meta.id,
    )!;

    const typeParams = `T${extensionEvent.title}Params`;
    const interfaceCallBack = `I${extensionEvent.title}CallBack`;

    const valueType = ioTypeCode(
      {
        typeName: typeParams,
        schema: extensionEvent.inputs[0].schema,
        promote: true,
      },
      ioTypeCodeConfig,
    );

    let interfaceCallBackCode = "";

    extensionEvent.outputs.forEach((output) => {
      const valueType = ioTypeCode(
        {
          typeName: `${interfaceCallBack}_${output.id}_Params`,
          schema: output.schema,
          promote: true,
        },
        ioTypeCodeConfig,
      );

      const title = output.title;

      interfaceCallBackCode +=
        (title ? `\n${indent}/** ${title} */` : "") +
        `\n${indent}${output.id}: (value: ${valueType.typeName}) => void;`;

      typeCode += `${valueType.statement}\n`;
    });

    if (interfaceCallBackCode) {
      typeCode +=
        `interface ${interfaceCallBack} {` + `${interfaceCallBackCode}\n}\n`;
    }

    typeCode += `${valueType.statement}\n`;

    const description = genDescription(extensionEvent.diagrams[0].description, {
      initialIndent: config.codeStyle!.indent,
    });

    eventCode +=
      (description ? `${description}\n` : "") +
      `${indent}${extensionEvent.title}?: ${interfaceCallBackCode ? "EventWithCallBack" : "Event"}<${typeParams}${interfaceCallBackCode ? `, ${interfaceCallBack}` : ""}>;\n`;

    const params = {
      open: "value",
      call: "value",
    };

    const code = handleProcess(event.events[0], {
      ...config,
      depth: 2,
      getParams: () => {
        return params;
      },
      getComponentPackageName: () => {
        return config.getComponentPackageName({ type: "extensionEvent" });
      },
      getComponentMeta: ((com, configMeta) => {
        return config.getComponentMeta(com, {
          ...configMeta,
          json: event.meta,
        });
      }) as typeof config.getComponentMeta,
    } as any);
    // ${interfaceCallBackCode ? "EventWithCallBack" : "Event"}<${typeParams}${interfaceCallBackCode ? `, ${interfaceCallBack}` : ""}>
    eventCreateCode +=
      `${indent}${extensionEvent.title}: MyBricks.Event = createEvent((value: ${typeParams}${interfaceCallBackCode ? `, callBack: ${interfaceCallBack}` : ""}) => {` +
      code +
      `\n${indent}})\n`;
  });

  return (
    `type Event<ParamsType> = (params: ParamsType) => void;` +
    `\ntype EventWithCallBack<ParamsType, CallbackType> = (value: ParamsType, callBack: CallbackType) => void;` +
    `\n${typeCode}` +
    `class Events {` +
    `\n${eventCreateCode}}` +
    `\n\nexport const events = new Events();` +
    `\n\ninterface OnEventParams {` +
    `\n${eventCode}}` +
    `\n\nexport const onEvent: (events: OnEventParams) => void = transformEvents(events);`
  );
};
