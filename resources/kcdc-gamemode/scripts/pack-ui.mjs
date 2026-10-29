// Packs the pages of this resource for the players: the status panel, the character creator, the free camera page and the chat.
//
// `ui-src/<page>.html` is the page as it is written and read, comments and indentation included. What travels to every
// joining player is `ui/<page>.html`, which this script writes from it: comments and indentation are the part of a page
// that compresses worst, and the client package (what `mafiahub.files` lists) has to stay under the size a join is known
// to download (tests/packagesize.test.cjs). `npm run build` runs it after the two TypeScript programs.
//
// The page's script goes through TypeScript's own printer, a real parser: a "/*" inside a string or a regular expression
// is not a comment to it. The style goes through a comment-stripping pass that refuses what it cannot be sure of, and the
// markup is only trimmed line by line. Lines are never joined, so no statement can run into the next.

import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { loadTerser, minifyScript } from "./minify-client.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");

/** The pages: each is written in ui-src/<name>.html and packed into ui/<name>.html. */
export const PAGES = ["status", "creator", "freecam", "chat", "craft", "emotes", "voice", "welcome", "mural"];

const note = (name) => `<!-- Written by scripts/pack-ui.mjs from ui-src/${name}.html: edit that one. -->`;

/** Every line without its indentation, and no empty ones. */
const tidy = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");

/** The script without comments or indentation, and checked to still be a script. */
export function packScript(code) {
  const result = ts.transpileModule(code, {
    fileName: "status.js",
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, removeComments: true, newLine: ts.NewLineKind.LineFeed, allowJs: true },
  });
  const errors = (result.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (errors.length > 0) {
    throw new Error(`pack-ui: the page's script does not parse: ${ts.flattenDiagnosticMessageText(errors[0].messageText, "\n")}`);
  }
  // Trimming the lines of a template literal would change the text inside it.
  if (/`/.test(result.outputText)) {
    throw new Error("pack-ui: a template literal in the page's script: its lines cannot be trimmed safely; use a string");
  }
  // With terser the script also loses its spaces and the names inside its functions; without it, only comments and indents.
  const terser = loadTerser();
  const packed = terser === null ? tidy(result.outputText) : minifyScript(terser, result.outputText, "the page's script");
  new vm.Script(packed, { filename: "status.html (packed)" });
  return packed;
}

/**
 * The style without comments, indentation or the spaces CSS does not need: around braces, semicolons, commas and the
 * child combinator, and after a property's colon. A space between two selectors or two values stays.
 */
export function packStyle(css) {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  if (bare.includes("/*") || bare.includes("*/")) {
    throw new Error("pack-ui: a comment marker is left in the style, so one of its comments was not closed or sits inside a string");
  }
  return tidy(bare)
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s*([{};,>])\s*/g, "$1")
    .replace(/:\s+/g, ":")
    .replace(/;}/g, "}")
    .trim();
}

/** The whole page: the style and the script packed, the markup trimmed, and a note on where it comes from. */
export function packPage(source, name = "status") {
  const page = source.replace(/\r\n/g, "\n");
  const parts = page.split(/(<style>[\s\S]*?<\/style>|<script>[\s\S]*?<\/script>)/);
  const packed = parts
    .map((part) => {
      if (part.startsWith("<style>")) {
        return `<style>\n${packStyle(part.slice("<style>".length, -"</style>".length))}\n</style>`;
      }
      if (part.startsWith("<script>")) {
        return `<script>\n${packScript(part.slice("<script>".length, -"</script>".length))}\n</script>`;
      }
      return tidy(part.replace(/<!--[\s\S]*?-->/g, ""));
    })
    .join("\n");
  return `${tidy(packed).replace(/^<!DOCTYPE html>/i, `<!DOCTYPE html>\n${note(name)}`)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const kilobytes = (text) => (Buffer.byteLength(text) / 1024).toFixed(1);
  for (const name of PAGES) {
    const source = readFileSync(new URL(`../ui-src/${name}.html`, import.meta.url), "utf8");
    const packed = packPage(source, name);
    writeFileSync(new URL(`../ui/${name}.html`, import.meta.url), packed);
    console.log(`pack-ui: ui-src/${name}.html (${kilobytes(source)} KB) -> ui/${name}.html (${kilobytes(packed)} KB)`);
  }
}
