import * as path from "path";
import * as fse from "fs-extra";

fse.copySync(path.resolve(__dirname, "../template"), path.resolve(__dirname, "../dist/template"));

