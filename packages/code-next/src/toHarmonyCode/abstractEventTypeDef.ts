/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ToSpaCodeConfig } from ".";
import { indentation, ioTypeCode } from "./utils";

type AbstractEventTypeDefMap = Record<
  string,
  {
    eventIds: Set<string>;
    typeDef: {
      var: Record<string, any>;
      input: Record<string, any>;
      output: Record<string, any>;
    };
  }
>;
const abstractEventTypeDef = (
  abstractEventTypeDefMap: AbstractEventTypeDefMap,
  config: ToSpaCodeConfig,
) => {
  const indent = indentation(config.codeStyle!.indent);
  const ioTypeCodeConfig = {
    initialIndent: 0,
    indentSize: config.codeStyle!.indent,
  };
  const interfaceCode: string[] = [];
  const comEvent: string[] = [];

  Object.entries(abstractEventTypeDefMap).forEach(
    ([comId, { typeDef, eventIdMap }]: any) => {
      const { vars, inputs, outputs } = typeDef;
      const statementCode: string[] = [];
      const getCode: string[] = [];
      const eventCode: string[] = [];
      const eventCtxTypeName = `I${comId}_comEventCtx`;
      const comEventTypeName = `I${comId}_comEvent`;

      Object.entries(vars).forEach(([, { title, schema }]: any) => {
        const type = ioTypeCode(
          {
            typeName: `I${comId}_var_${title}`,
            schema: schema,
          },
          ioTypeCodeConfig,
        );
        if (type.statement) {
          statementCode.push(type.statement);
        }
        getCode.push(
          `${indent}getVar<T = ${type.typeName}>(value: "${title}"): GetVarResult<T>`,
        );
      });

      Object.entries(inputs).forEach(([, { title, schema }]: any) => {
        const type = ioTypeCode(
          {
            typeName: `I${comId}_input_${title}`,
            schema: schema,
          },
          ioTypeCodeConfig,
        );
        if (type.statement) {
          statementCode.push(type.statement);
        }
        getCode.push(
          `${indent}getInput<T = ${type.typeName}>(value: "${title}"): GetInputResult<T>`,
        );
      });

      Object.entries(outputs).forEach(([, { title, schema }]: any) => {
        const type = ioTypeCode(
          {
            typeName: `I${comId}_output_${title}`,
            schema: schema,
          },
          ioTypeCodeConfig,
        );
        if (type.statement) {
          statementCode.push(type.statement);
        }
        getCode.push(
          `${indent}getOutput<T = ${type.typeName}>(value: "${title}"): GetOutputResult<T>`,
        );
      });

      Object.entries(eventIdMap).forEach(([eventId, schema]) => {
        const type = ioTypeCode(
          {
            typeName: `I${comId}_${eventId}_value`,
            schema: schema,
          },
          ioTypeCodeConfig,
        );
        if (type.statement) {
          statementCode.push(type.statement);
        }
        eventCode.push(
          `${indent}${eventId}?: (value: ${type.typeName}, ctx: ${eventCtxTypeName}) => void`,
        );
      });

      interfaceCode.push(
        statementCode.join("\n") +
          `\ninterface ${eventCtxTypeName} {` +
          `\n${getCode.join("\n")}` +
          `\n}` +
          `\ninterface ${comEventTypeName} {` +
          `\n${eventCode.join("\n")}` +
          `\n}`,
      );

      comEvent.push(`${indent}${comId}?: ${comEventTypeName}`);
    },
  );

  return (
    `interface GetVarResult<T> {
  getValue: () => T
  setValue: (value: T) => void
}
interface GetOutputResult<T> {
  setValue: (value: T) => void
}
interface GetInputResult<T> {
  getValue: () => T
}` +
    (interfaceCode ? `\n${interfaceCode.join("\n")}` : "") +
    `\ninterface ComEvent {` +
    `\n${comEvent.join("\n")}` +
    `\n}`
  );
};

export default abstractEventTypeDef;
