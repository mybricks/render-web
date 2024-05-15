import gulp from "gulp";
import ts from "gulp-typescript";

const cwd = process.cwd();

const tsConfig: ts.Settings = {
  module: 'es6', // esm commonjs
  target: 'es6', // 目标
  declaration: true, // 自动生成.d.ts
  skipLibCheck: true, // 跳过库文件检查
}

// TypeScript编译任务
function compileTs() {
  const tsResult = gulp.src(["**/*.ts", "!scripts/**"], {
    base: cwd
  }).pipe(ts(tsConfig))

  const dest = gulp.dest('dist/es');

  tsResult.js.pipe(dest);
  tsResult.dts.pipe(dest);
}

compileTs();
