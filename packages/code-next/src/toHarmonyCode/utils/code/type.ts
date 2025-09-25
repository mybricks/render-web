/* eslint-disable @typescript-eslint/no-explicit-any */
import { indentation } from "../index";

interface IndentationConfig {
  initialIndent: number;
  indentSize: number;
}

/** 根据输入输出信息转类型定义代码 */
export const ioTypeCode = (
  params: any,
  config: IndentationConfig,
): {
  statement: string | null;
  typeName: string;
} => {
  const { typeName, schema } = params;

  if (!schema) {
    // 兼容处理，正常不应该没有schema
    return {
      statement: null,
      typeName: "MyBricks.Any",
    };
  }

  const { type } = schema;
  if (type === "any") {
    // 任意
    return {
      statement: null,
      typeName: "MyBricks.Any",
    };
  }

  if (["number", "string", "boolean"].includes(type)) {
    // 数字，字符，布尔
    return {
      statement: null,
      typeName: type,
    };
  }

  const { initialIndent, indentSize } = config;

  if (type === "object") {
    // 对象
    const indent = indentation(initialIndent);
    const { statement, code } = objectTypeCode(
      {
        typeName,
        properties: schema.properties || {},
      },
      {
        initialIndent: initialIndent + indentSize,
        indentSize,
      },
    );

    return {
      statement:
        (statement ? `${statement}\n` : "") +
        `interface ${typeName} {` +
        (!code ? "}" : code + `\n${indent}}`),
      typeName,
    };
  }

  if (type === "array") {
    // 数组
    const type = ioTypeCode(
      {
        schema: schema.items,
        typeName: `${typeName}_item`,
      },
      {
        initialIndent: 0,
        indentSize,
      },
    )!;

    return {
      statement:
        (type.statement ? `${type.statement}\n` : "") +
        `type ${typeName} = ${type.typeName}[]`,
      typeName,
    };
  }

  if (type === "indexObject") {
    // 索引对象
    console.log("[schema - indexObject] 待处理");
  }

  if (type === "tuple") {
    // 元组
    let statement = "";
    let code = "";

    schema.items.forEach((item: any, index: number) => {
      const type = ioTypeCode(
        {
          typeName: `${typeName}_${index}`,
          schema: item,
        },
        {
          initialIndent: 0,
          indentSize,
        },
      );

      if (type.statement) {
        statement = !statement
          ? type.statement
          : `${type.statement}\n${statement}`;
      }

      code = code ? `${code} | ${type.typeName}` : type.typeName;
    });

    if (type === "enum") {
      console.log("[schema - enum] 待处理");
    }

    return {
      statement:
        (statement ? `${statement}\n` : "") + `type ${typeName} = ${code}`,
      typeName,
    };
  }

  return {
    statement: null,
    typeName: "MyBricks.Any",
  };
};

const objectTypeCode = (params: any, config: any) => {
  const { typeName, properties } = params;
  const { initialIndent, indentSize } = config;
  let code = "";
  let statement = "";
  const indent = indentation(initialIndent);
  Object.entries(properties).forEach(([key, schema]) => {
    const type = ioTypeCode(
      {
        typeName: `${typeName}_${key}`,
        schema,
      },
      {
        initialIndent: 0,
        indentSize,
      },
    )!;

    if (type.statement) {
      statement = !statement
        ? type.statement
        : `${type.statement}\n${statement}`;
    }

    code += `\n${indent}${key}: ${type.typeName}`;
  });

  return {
    statement,
    code,
  };
};
