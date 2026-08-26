import react from "@vitejs/plugin-react";
import typegpu from "unplugin-typegpu/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  /*
   * React is here, and the earlier "no React, deliberately" note was answering a different
   * question.
   *
   * That note was right about the *scene*: a reconciler driving GPU objects is the thing being
   * removed, and the geometry results had to stand without one. React's role here is the opposite
   * end of the pipe — it renders the source DOM that gets captured, which is the job React has
   * always had and the job the real app needs it for. The two never touch.
   */
  plugins: [react(), typegpu()],
});
