type ImportType = "default" | "named";
type DependencyImport = Record<
  string,
  Record<
    string,
    {
      importType: ImportType;
    }
  >
>;
/** 收集依赖 */
export const createDependencyImportCollector = () => {
  const dependencyImport: DependencyImport = {};

  const addDependencyImport = ({
    packageName,
    dependencyName,
    importType,
  }: {
    packageName: string;
    dependencyName: string;
    importType: ImportType;
  }) => {
    if (!dependencyImport[packageName]) {
      dependencyImport[packageName] = {};
    }

    dependencyImport[packageName][dependencyName] = {
      importType,
    };
  };

  return [dependencyImport, addDependencyImport] as [
    typeof dependencyImport,
    typeof addDependencyImport,
  ];
};
/** 解析依赖为code */
export const generateImportDependenciesCode = (
  dependencyImport: DependencyImport,
) => {
  return Object.entries(dependencyImport).reduce(
    (pre, [packageName, dependencies]) => {
      let defaultDependency = "";
      let namedDependencies = "";

      Object.entries(dependencies).forEach(
        ([dependencyName, { importType }]) => {
          if (importType === "default") {
            defaultDependency = dependencyName;
          } else {
            namedDependencies += `${dependencyName},`;
          }
        },
      );

      if (namedDependencies) {
        namedDependencies = `{${namedDependencies}}`;

        if (defaultDependency) {
          defaultDependency += ",";
        }
      }

      return (
        pre +
        `import ${defaultDependency} ${namedDependencies} from '${packageName}';`
      );
    },
    "",
  );
};
