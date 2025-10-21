import type { ToJSON } from "../toCode/types";
import type { ToSpaCodeConfig } from ".";
import { indentation, ioTypeCode, genDescription } from "./utils";

const extensionEventTypeDef = (tojson: ToJSON, config: ToSpaCodeConfig) => {
  const extensionEvents = tojson.frames.filter((frame) => {
    return frame.type === "extension-event";
  });

  if (!extensionEvents.length) {
    return "";
  }

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

  extensionEvents.forEach((extensionEvent) => {
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
      `${indent}${extensionEvent.title}: ${interfaceCallBackCode ? "EventWithCallBack" : "Event"}<${typeParams}${interfaceCallBackCode ? `, ${interfaceCallBack}` : ""}>;\n`;
    eventCreateCode += `${indent}${extensionEvent.title}: MyBricks.Api = createBus();\n`;
  });

  return (
    `class Events {` +
    `\n${eventCreateCode}}` +
    `\n\nexport const events = new Events();` +
    `\n\ntype Event<ParamsType> = (params: ParamsType) => void;` +
    `\ntype EventWithCallBack<ParamsType, CallbackType> = (value: ParamsType, callBack: CallbackType) => void;` +
    `\n${typeCode}` +
    `interface OnEventParams {` +
    `\n${eventCode}}` +
    `\n\nexport const onEvent: (events: OnEventParams) => void = transformBus(events);`
  );
};

export default extensionEventTypeDef;
