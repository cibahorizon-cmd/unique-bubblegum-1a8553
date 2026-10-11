import { build } from "esbuild";
import { copyFile } from "node:fs/promises";

await copyFile("index.html", "public/index.html");

await build({
  entryPoints: ["client/app.js"],
  outfile: "public/assets/app.js",
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
});
