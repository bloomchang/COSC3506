import { createReadStream } from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";

const root = new URL(".", import.meta.url);

// Only these public files can be served.
const publicFiles = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/config.js": ["config.js", "text/javascript; charset=utf-8"],
};

const server = http.createServer((request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  let pathname;
  try {
    pathname = new URL(request.url, "http://localhost").pathname;
  } catch {
    response.writeHead(400).end("Invalid URL");
    return;
  }

  const appRoute =
    /^\/students\/[^/]+\/?$/.test(pathname) ||
    /^\/projects\/[^/]+\/?$/.test(pathname) ||
    pathname === "/inquiry" ||
    pathname === "/items";

  const entry = publicFiles[pathname] ||
    (appRoute ? publicFiles["/"] : null);

  if (!entry) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Page not found. Return to / to browse talent.");
    return;
  }

  const [filename, contentType] = entry;
  const stream = createReadStream(fileURLToPath(new URL(filename, root)));

  stream.once("error", () => {
    if (!response.headersSent) {
      response.writeHead(500);
      response.end("Could not load the page.");
    } else {
      response.destroy();
    }
  });

  stream.once("open", () => {
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    });

    if (request.method === "HEAD") {
      stream.destroy();
      response.end();
    } else {
      stream.pipe(response);
    }
  });
});

const port = Number(process.env.PORT || 8080);

server.listen(port, "0.0.0.0", () => {
  console.log(`Frontend available at http://localhost:${port}`);
});