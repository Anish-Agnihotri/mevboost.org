import dotenv from "dotenv"; // Env vars
import CONFIG from "../config.json"; // Config
import Extractor from "./extractor"; // Collection
import Transformer from "./transformer"; // Stats

// Setup env vars
dotenv.config();

(async () => {
  // Collect env vars
  const RPC_URL: string | undefined = process.env.RPC_URL;
  const REDIS_URL: string | undefined = process.env.REDIS_URL;
  if (!REDIS_URL || !RPC_URL) throw new Error("Missing env vars");

  // Setup relays
  const relays: Extractor[] = Object.entries(CONFIG.relays).map(
    ([name, url]) => new Extractor(name, url, REDIS_URL)
  );
  // Setup stats transformer
  const stats = new Transformer(REDIS_URL, RPC_URL);

  // Setup sync processes
  const processes: Promise<void>[] = relays.map((relay) => relay.sync());
  Promise.allSettled([...processes, stats.sync()]);
})();
