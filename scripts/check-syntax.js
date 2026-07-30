import {
  readdir,
  stat
} from "node:fs/promises";

import {
  resolve,
  relative
} from "node:path";

import {
  spawnSync
} from "node:child_process";

const root = resolve(".");

async function collect(directory) {
  const output = [];

  for (const name of await readdir(directory)) {
    if (
      name === "node_modules" ||
      name.startsWith(".")
    ) {
      continue;
    }

    const path = resolve(directory, name);
    const info = await stat(path);

    if (info.isDirectory()) {
      output.push(...await collect(path));
    } else if (
      path.endsWith(".js")
    ) {
      output.push(path);
    }
  }

  return output;
}

const files = await collect(root);
let failed = false;

for (const file of files) {
  const result = spawnSync(
    process.execPath,
    ["--check", file],
    {
      encoding: "utf8"
    }
  );

  const name = relative(root, file);

  if (result.status === 0) {
    console.log(`✅ ${name}`);
  } else {
    failed = true;
    console.error(`❌ ${name}`);
    console.error(result.stderr);
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  `\n全部 ${files.length} 個 JavaScript 檔案語法檢查通過。`
);
