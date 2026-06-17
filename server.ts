import express from "express";
import path from "path";
import app from "./app.js";
const PORT = Number(process.env.PORT ?? 3000);
// Serve static assets and mount Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Social Video Studio Server] running on http://0.0.0.0:${PORT}`);
  });
}

const entryPoint = process.argv[1] ?? "";
const isMainModule = entryPoint.endsWith("server.ts") || entryPoint.endsWith("server.cjs");

if (isMainModule) {
  startServer();
}

export default app;
