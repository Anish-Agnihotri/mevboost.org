import Redis from "ioredis"; // Cache
import { ethers } from "ethers"; // Ethers
import logger from "./utils/logger"; // Logging
import { payloads, PrismaClient } from "@prisma/client"; // Prisma

export default class Transformer {
  // Redis
  private redis: Redis;
  // Prisma
  private prisma: PrismaClient = new PrismaClient();

  /**
   * Initialize new transformer
   * @param {string} redisUrl to connect
   */
  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  /**
   * Processes statistics for last 1000 payloads
   */
  private async processStatistics(): Promise<void> {
    // Collect last thousand payloads by insertion time
    const payloads: payloads[] | null = await this.prisma.payloads.findMany({
      orderBy: {
        slot: "desc",
      },
      take: 1000,
    });

    // If no payloads found
    if (!payloads) {
      logger.info(`Stats: No payloads retrieved`);
      return;
    }

    // Total payloads
    const total: number = payloads.length;
    // Public key => count
    let topBuilders: Record<string, number> = {};
    // Relay name => { reward, count }
    let topRelays: Record<string, { reward: string; count: number }> = {};

    for (const payload of payloads) {
      // Track builders
      const builder: string = payload.builder_pubkey;
      if (builder in topBuilders) {
        topBuilders[builder] = topBuilders[builder] + 1;
      } else {
        topBuilders[builder] = 0;
      }

      // Track relays
      const relay: string = payload.relay;
      const reward: string = payload.value;
      if (relay in topRelays) {
        // Track new reward
        const rewardBN: ethers.BigNumber = ethers.utils.parseUnits(
          reward,
          "wei"
        );
        const existingBN: ethers.BigNumber = ethers.utils.parseUnits(
          topRelays[relay].reward,
          "wei"
        );
        const newReward: string = ethers.utils.formatUnits(
          rewardBN.add(existingBN),
          "wei"
        );

        topRelays[relay] = {
          reward: newReward,
          count: topRelays[relay].count + 1,
        };
      } else {
        topRelays[relay] = { reward, count: 1 };
      }
    }

    // Store stats in Redis
    const success: "OK" = await this.redis.set(
      "stats",
      JSON.stringify({
        total,
        builders: topBuilders,
        relays: topRelays,
      })
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
