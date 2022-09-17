import Redis from "ioredis"; // Cache
import { ethers } from "ethers"; // Ethers
import logger from "./utils/logger"; // Logging
import { payloads, PrismaClient } from "@prisma/client"; // Prisma
import type { BuilderDetail, RelayDetail, StatSummary } from "./utils/types"; // Types

const LAST_POW_BLOCK: number = 15537393;

export default class Transformer {
  // Redis
  private redis: Redis;
  // Prisma
  private prisma: PrismaClient = new PrismaClient();
  // RPC
  private rpc: ethers.providers.StaticJsonRpcProvider;

  /**
   * Initialize new transformer
   * @param {string} redisUrl to connect
   * @param {string} rpcUrl to connect
   */
  constructor(redisUrl: string, rpcUrl: string) {
    this.redis = new Redis(redisUrl);
    this.rpc = new ethers.providers.StaticJsonRpcProvider(rpcUrl);
  }

  /**
   * Collect latest block number
   * @returns {number}
   */
  private async collectLatestBlock(): Promise<number> {
    try {
      return await this.rpc.getBlockNumber();
    } catch {
      logger.error(`Stats: error collecting block number`);
      throw new Error("Error collecting block number");
    }
  }

  /**
   * Collects general statistics about network
   * @param {StatSummary} stats cached
   * @param {payloads[]} payloads fresh
   * @returns {{ last_slot, total_blocks, total_payloads }}
   */
  private async collectGeneralStatistics(
    stats: StatSummary,
    payloads: payloads[]
  ): Promise<{
    last_slot: number;
    total_blocks: number;
    total_payloads: number;
  }> {
    // Calculate total blocks since merge
    const latestBlock: number = await this.collectLatestBlock();
    const total_blocks: number = latestBlock - LAST_POW_BLOCK;

    // Get new latest slot
    const last_slot: number = payloads[0].slot;

    // Get number of total payloads
    const runningTotal: number = stats.total_payloads;
    const total_payloads = runningTotal + payloads.length;

    return { last_slot, total_blocks, total_payloads };
  }

  /**
   * Converts eth value in wei to formatted number
   * @param {string} w wei
   * @returns {number} eth
   */
  private weiStringToNumber(w: string): number {
    // wei => BN
    const wei: ethers.BigNumber = ethers.utils.parseUnits(w, "wei");
    // BN => string
    const ether: string = ethers.utils.formatUnits(wei, "wei");
    // String => number
    return Number(ether);
  }

  /**
   * Collects relay + builder statistics
   * @param {StatSummary} stats cached
   * @param {payloads[]} payloads fresh
   * @returns {{ relays: RelayDetail[] , builders: BuilderDetail[] }}
   */
  private async collectParticipantStatistics(
    stats: StatSummary,
    payloads: payloads[]
  ): Promise<{ relays: RelayDetail[]; builders: BuilderDetail[] }> {
    let relays: Record<string, { value: number; count: number }> = {};
    let builders: Record<
      string,
      { count: number; value: number; last_relay: string }
    > = {};

    // Store cached statistics
    for (const relay of stats.relays) {
      const { name, count, value } = relay;
      relays[name] = { count, value };
    }
    for (const builder of stats.builders) {
      const { pubkey, count, value, last_relay } = builder;
      builders[pubkey] = { count, value, last_relay };
    }

    // Update cache
    for (const payload of payloads) {
      // Calculate value of payload in ETH
      const payloadValue = this.weiStringToNumber(payload.value);

      // Update relay
      if (relays[payload.relay]) {
        const { count, value } = relays[payload.relay];
        relays[payload.relay] = {
          count: count + 1,
          value: value + payloadValue,
        };
      } else {
        // Create new entry
        relays[payload.relay] = {
          count: 1,
          value: payloadValue,
        };
      }

      // Update builder
      if (builders[payload.builder_pubkey]) {
        const { count, value } = builders[payload.builder_pubkey];
        builders[payload.builder_pubkey] = {
          count: count + 1,
          value: value + payloadValue,
          last_relay: payload.relay,
        };
      } else {
        builders[payload.builder_pubkey] = {
          count: 1,
          value: payloadValue,
          last_relay: payload.relay,
        };
      }
    }

    // Aggregate and average
    const aggRelays: RelayDetail[] = Object.entries(relays)
      .map(([relay, details]) => ({
        name: relay,
        value: details.value,
        count: details.count,
        avg_value: details.value / details.count,
      }))
      .sort((a, b) => b.count - a.count);
    const aggBuilders: BuilderDetail[] = Object.entries(builders)
      .map(([builder, details]) => ({
        pubkey: builder,
        count: details.count,
        value: details.value,
        avg_value: details.value / details.count,
        last_relay: details.last_relay,
      }))
      .sort((a, b) => b.count - a.count);

    return { relays: aggRelays, builders: aggBuilders };
  }

  /**
   * Processes statistics for all payloads
   */
  private async processStatistics(): Promise<void> {
    // Collect cached stats if they exist
    const cachedStats: string | null = await this.redis.get("stats");
    if (!cachedStats) logger.info(`Stats: no cached stats`);

    // Setup stats object
    const stats: StatSummary = cachedStats
      ? // If cached stats exist, parse
        JSON.parse(cachedStats)
      : // Else, return empty
        {
          last_slot: 0,
          total_blocks: 0,
          total_payloads: 0,
          relays: [],
          builders: [],
        };

    // Collect all payloads greater than last processed index
    const payloads: payloads[] | null = await this.prisma.payloads.findMany({
      orderBy: {
        slot: "desc",
      },
      where: {
        slot: {
          gt: stats.last_slot,
        },
      },
    });

    // If no payloads found
    if (!payloads || payloads.length === 0) {
      logger.info(`Stats: No payloads retrieved`);
      return;
    }

    // Process general statistics
    const { last_slot, total_blocks, total_payloads } =
      await this.collectGeneralStatistics(stats, payloads);

    // Process relay + builder statistics
    const { relays, builders } = await this.collectParticipantStatistics(
      stats,
      payloads
    );

    // Generate new stat
    const freshStat: StatSummary = {
      last_slot,
      total_blocks,
      total_payloads,
      relays,
      builders,
    };

    // Store stats in Redis
    const success: "OK" = await this.redis.set(
      "stats",
      JSON.stringify(freshStat)
    );

    // Check for cache insertion
    if (success !== "OK") {
      logger.error("Stats: Could not update in Redis");
      throw new Error("Failed inserting to Redis cache");
    }

    // Log success
    logger.info("Stats: Updated in Redis");
  }

  /**
   * Sync stats
   */
  public async sync(): Promise<void> {
    // Save statistics
    await this.processStatistics();

    // Re-process in 30s
    logger.info(`Stats: Sleeping for 30s`);
    setTimeout(() => this.sync(), 1000 * 30);
  }
}
