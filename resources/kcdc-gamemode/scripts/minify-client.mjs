// Shortens the client scripts `tsc` writes to dist/client: whitespace goes and local names get one letter. The client
// package (what `mafiahub.files` lists) has to stay under the size a join is known to download (tests/packagesize.test.cjs),
// and these scripts are about a tenth of it. Only names inside functions are touched: exports, top-level names, property
// names and strings stay as written, so what a script says to the game and to the server does not change.
//
// `npm run build` runs this after the client program is compiled. When terser is not installed the scripts are left as
// they are and a warning says so: the package-size test is what then refuses a package that grew past the limit.

import { createRequire } from "node:module";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const require = createRequire(import.meta.url);

/** What to run terser with: no rewriting of the code, only the whitespace and the names inside functions. */
export const MINIFY_OPTIONS = { compress: false, mangle: true, format: { comments: false } };

/** The terser module, or null when it is not installed. */
export function loadTerser() {
  try {
    return require("terser");
  } catch {
    return null;
  }
}

/** The script shortened, and checked to still be a script. Throws when terser cannot read it. */
export function minifyScript(terser, code, name = "script") {
  const result = terser.minify_sync(code, MINIFY_OPTIONS);
  if (result.error) {
    throw new Error(`minify-client: ${name} does not minify: ${result.error.message}`);
  }
  new vm.Script(result.code, { filename: `${name} (minified)` });
  return result.code;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const terser = loadTerser();
  if (terser === null) {
    console.warn("minify-client: terser is not installed (npm install): dist/client is left as tsc wrote it");
  } else {
    const folder = new URL("../dist/client/", import.meta.url);
    let before = 0;
    let after = 0;
    for (const name of readdirSync(folder).filter((file) => file.endsWith(".js"))) {
      const code = readFileSync(new URL(name, folder), "utf8");
      const small = minifyScript(terser, code, name);
      before += Buffer.byteLength(code);
      after += Buffer.byteLength(small);
      writeFileSync(new URL(name, folder), small);
    }
    console.log(`minify-client: dist/client ${(before / 1024).toFixed(1)} KB -> ${(after / 1024).toFixed(1)} KB`);
  }
}
