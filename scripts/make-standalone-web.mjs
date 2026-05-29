import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const distDir = join(root, "dist");
const outDir = join(root, "proposal-demo-web");

const html = await readFile(join(distDir, "index.html"), "utf8");
const cssHref = html.match(/<link[^>]+href="(.+?\.css)"[^>]*>/)?.[1];
const jsSrc = html.match(/<script[^>]+src="(.+?\.js)"[^>]*><\/script>/)?.[1];

if (!cssHref || !jsSrc) {
  throw new Error("Could not find built CSS/JS assets in dist/index.html");
}

const css = await readFile(join(distDir, cssHref), "utf8");
const js = await readFile(join(distDir, jsSrc), "utf8");
const safeCss = css.replace(/<\/style/gi, "<\\/style");
const safeJs = js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

const standalone = html
  .replace(/<script[^>]+src=".+?\.js"[^>]*><\/script>/, "")
  .replace(/<link[^>]+href=".+?\.css"[^>]*>/, () => `<style>${safeCss}</style>`)
  .replace("</body>", () => `    <script type="module">${safeJs}</script>\n  </body>`);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "index.html"), standalone);
await writeFile(
  join(outDir, "README.txt"),
  `议案生成器 Demo 网页试用说明

1. 解压压缩包。
2. 直接双击打开 index.html。
3. 所有样式和脚本已经内联在 index.html 中，不依赖 assets 文件夹。

说明：
- 所有数据默认保存在试用者自己的浏览器本地。
- 未配置 BYOK 时，AI 起草会使用本地模拟结果。
- Markdown 导出可用，DOCX/PDF 入口为后续预留。
`,
);

console.log(`Wrote standalone export to ${outDir}`);
