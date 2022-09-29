export default {
  // Seconds per day / seconds per slot
  SLOTS_PER_DAY: (60 * 60 * 24) / 12,
  // https://etherscan.io/block/15537393
  LAST_POW_BLOCK: 15537393,
  // (rpc.getBlock(15537394)).timestamp
  FIRST_POS_BLOCK_TS: 1663224179,
  // https://beaconcha.in/slot/4700013
  FIRST_POS_BLOCK_SLOT: 4700013,
};
