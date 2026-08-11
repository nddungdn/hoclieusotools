import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = resolve(scriptDirectory, "..");
const distDirectory = resolve(sourceDirectory, "dist");
const websiteDirectory = resolve(sourceDirectory, "..");

await rm(resolve(websiteDirectory, "assets"), { recursive: true, force: true });
await mkdir(resolve(websiteDirectory, "assets"), { recursive: true });
await cp(resolve(distDirectory, "assets"), resolve(websiteDirectory, "assets"), {
  recursive: true,
});
await cp(resolve(distDirectory, "index.html"), resolve(websiteDirectory, "index.html"));
await cp(resolve(distDirectory, "favicon.svg"), resolve(websiteDirectory, "favicon.svg"));

console.log("Đã đồng bộ bản build vào thư mục phanbienai.");
