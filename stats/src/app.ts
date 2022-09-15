import Collector from "./collector"; // Collection

(async () => {
  const flashbots = new Collector(
    "Flashbots",
    "https://0xac6e77dfe25ecd6110b8e780608cce0dab71fdd5ebea22a16c0205200f2f8e2e3ad3b71d3499c54ad14d6c21b41a37ae@boost-relay.flashbots.net"
  );
  await flashbots.sync();
})();
