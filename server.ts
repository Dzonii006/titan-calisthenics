// Lightweight static server using Deno
const PORT = 8080;
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

console.log(`🚀 Titan Calisthenics PWA Server starting...`);

Deno.serve({ port: PORT, hostname: "0.0.0.0" }, async (req) => {
  const url = new URL(req.url);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/" || pathname === "") {
    pathname = "/index.html";
  }

  const filePath = `./workout-app${pathname}`;

  try {
    const file = await Deno.readFile(filePath);
    const ext = pathname.substring(pathname.lastIndexOf("."));
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new Response(file, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "no-cache"
      }
    });
  } catch (_e) {
    // If not found, return index.html for SPA routing
    try {
      const indexFile = await Deno.readFile("./workout-app/index.html");
      return new Response(indexFile, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    } catch (e) {
      return new Response("Not Found", { status: 404 });
    }
  }
});
