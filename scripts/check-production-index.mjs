import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const indexPath = path.resolve(process.cwd(), "dist", "index.html");
const [html, metadata] = await Promise.all([
  readFile(indexPath, "utf8"),
  stat(indexPath),
]);

const forbiddenMarkers = ["id=\"manus-runtime\"", "__MANUS_HOST_DEV__"];
const marker = forbiddenMarkers.find((candidate) => html.includes(candidate));

if (marker) {
  throw new Error(`Production index contains development runtime marker: ${marker}`);
}

const maxIndexBytes = 40 * 1024;
if (metadata.size > maxIndexBytes) {
  throw new Error(
    `Production index is ${metadata.size} bytes; expected at most ${maxIndexBytes} bytes`,
  );
}

console.log(`✓ Production index is ${metadata.size} bytes and contains no development runtime`);
