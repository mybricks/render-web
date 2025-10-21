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
  const { typeName, schema, promote } = params;

  if (!schema) {
    // 兼容处理，正常不应该没有schema
    if (promote) {
      return {
        statement: `/** 未声明schema */\n` + `type ${typeName} = MyBricks.Any;`,
        typeName,
      };
    }
    return {
      statement: null,
      typeName: "MyBricks.Any",
    };
  }

  const { type } = schema;
  const description = genDescription(schema.description, {
    initialIndent: 0,
  });

  if (type === "any") {
    // 任意
    if (promote) {
      return {
        statement:
          (description ? `${description}\n` : "") +
          `type ${typeName} = MyBricks.Any;`,
        typeName,
      };
    }
    return {
      statement: null,
      typeName: "MyBricks.Any",
    };
  }

  if (["number", "string", "boolean"].includes(type)) {
    // 数字，字符，布尔
    if (promote) {
      return {
        statement:
          (description ? `${description}\n` : "") +
          `type ${typeName} = ${type};`,
        typeName,
      };
    }

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
        (description ? `${description}\n` : "") +
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
        (description ? `${description}\n` : "") +
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
        (statement ? `${statement}\n` : "") +
        (description ? `${description}\n` : "") +
        `type ${typeName} = ${code}`,
      typeName,
    };
  }

  if (promote) {
    return {
      statement:
        `/** 未处理的类型「${type}」，请联系平台开发者 */\n` +
        `type ${typeName} = MyBricks.Any;`,
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
  Object.entries(properties).forEach(([key, schema]: any) => {
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

    const description = genDescription(schema.description, {
      initialIndent,
    });

    code +=
      (description ? `\n${description}` : "") +
      `\n${indent}${key}: ${type.typeName}`;
  });

  return {
    statement,
    code,
  };
};

export const genDescription = (description: string, config: any) => {
  if (!description) {
    return;
  }
  const descriptions = description.split("\n");
  const { initialIndent } = config;
  if (descriptions.length === 1) {
    return `${indentation(initialIndent)}/** ${description} */`;
  }

  const indent2 = indentation(initialIndent + 1);

  return (
    `${indentation(initialIndent)}/**` +
    descriptions.reduce((pre, description) => {
      return pre + `\n${indent2}* ${description}`;
    }, "") +
    `\n${indent2}*/`
  );
};
