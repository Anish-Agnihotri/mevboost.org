import compress from "astro-compress";
import robotsTxt from "astro-robots-txt";
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel/serverless";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: vercel(),
  integrations: [compress(), robotsTxt()],
});
