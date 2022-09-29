import axios from "axios"; // Requests
import Redis from "ioredis"; // Cache
import logger from "./utils/logger"; // Logging
import type { BidTrace } from "./utils/types"; // Types
import { PrismaClient } from "@prisma/client"; // Prisma

export default class Extractor {
  // Last synced slot
  private syncedSlot: string | undefined;
  // Relay info
  private relay: { name: string; url: string };

  // Redis
  private redis: Redis;
  // Prisma
  private prisma: PrismaClient = new PrismaClient();

  /**
   * Initialize new collector
   * @param {string} name of relay
   * @param {string} url of relay
   * @param {string} redisUrl to connect
   */
  constructor(name: string, url: string, redisUrl: string) {
    logger.info(`Collector: initializing relay: ${name}`);
    this.relay = { name, url };
    this.redis = new Redis(redisUrl);
  }

  /**
   * Collect payloads delivered to proposers
   * @param {string | undefined } cursor optional pagination
   * @returns {Promise<BidTrace[]>} array of bid traces
   */
  private async collectPayloads(
    cursor: string | undefined = undefined
  ): Promise<BidTrace[]> {
    try {
      const { data }: { data: BidTrace[] } = await axios.get(
        `${
          this.relay.url
          // Collect 100 payloads
        }/relay/v1/data/bidtraces/proposer_payload_delivered?limit=100${
          // With optional cursor
          cursor ? `&cursor=${cursor}` : ""
        }`
      );

      // No payloads returned
      if (data.length === 0) {
        logger.info(`${this.relay.name}: No payloads in response`);
        return [];
      }

      // Log retrieval
      const newestSlot: string = data[0].slot;
      const oldestSlot: string = data[data.length - 1].slot;
      logger.info(
        `${this.relay.name}: Collected ${data.length} payloads (${newestSlot} -> ${oldestSlot})`
      );

      // Return BidTraces
      return data;
    } catch {
      // Log error + return no bids (failure escape prevention)
      logger.error(
        `${this.relay.name}: Error collecting payload (cursor: ${cursor})`
      );
      return [];
    }
  }

  /**
   * Checks last slot synced by relay in redis
   */
  private async updateSyncedSlot(): Promise<void> {
    // Collect last synced slot in cache
    const slot: string | null = await this.redis.get(this.relay.name);
    // If slot exists, update last synced slot
    if (slot) this.syncedSlot = slot;
  }

  /**
   * Collects fresh payloads not indexed in database
   * @param {string | undefined} cursor optional starting point
   * @param {string | undefined} lastSynced optional collection breakpoint
   * @returns {Promise<BidTrace[]>} payloads
   */
  private async collectFreshPayloads(
    cursor: string | undefined = undefined,
    lastSynced: string | undefined = undefined
  ): Promise<BidTrace[]> {
    let payloads: BidTrace[] = [];

    // Collect initial payload
    const initialPayload: BidTrace[] = await this.collectPayloads(cursor);
    payloads = [...payloads, ...initialPayload];

    // If collection breakpoint exists
    if (lastSynced) {
      // Check if breakpoint is in current set
      const breakpoint: boolean = payloads.some(
        (payload) => payload.slot === lastSynced
      );

      // If breakpoint found, return set before breakpoint
      if (breakpoint) {
        return payloads.filter(
          // Filter for payloads where slot > already synced
          (payload) => Number(payload.slot) > Number(lastSynced)
        );
      }
    }

    // If initial collection has 100 entities, paginate recursively
    if (initialPayload.length === 100) {
      const lastSlot: string = initialPayload[initialPayload.length - 1].slot;
      const lastCursor: string = String(Number(lastSlot) - 1);
      const nextPayload: BidTrace[] = await this.collectFreshPayloads(
        lastCursor
      );
      payloads = [...payloads, ...nextPayload];
    }

    // Return collected payloads
    return payloads;
  }

  /**
   * Syncs fresh payloads to database
   */
  private async syncFreshPayloads(): Promise<void> {
    // Update last synced slot
    await this.updateSyncedSlot();

    // Collect fresh payloads
    const freshPayloads: BidTrace[] = await this.collectFreshPayloads(
      undefined,
      this.syncedSlot
    );

    // If no fresh payloads, skip
    if (freshPayloads.length === 0) {
      logger.info(`${this.relay.name}: No fresh payloads`);
      return;
    }

    try {
      // Insert payloads into database
      const { count }: { count: number } =
        await this.prisma.payloads.createMany({
          data: freshPayloads.map((payload) => ({
            ...payload,
            // Attach relay name
            relay: this.relay.name,
            slot: Number(payload.slot),
          })),
        });

      // Confirm insertion
      if (count !== freshPayloads.length) {
        logger.error(
          `${this.relay.name}: ${freshPayloads.length} payloads do not match inserted count: ${count}`
        );
        throw new Error("Payload insertion count mismatch");
      }

      // Log success
      logger.info(`${this.relay.name}: Inserted ${count} payloads to database`);
    } catch (e) {
      // Log failure + throw
      logger.error(
        `${
          this.relay.name
        }: payload insertion to database failed. (${JSON.stringify(e)})`
      );
      throw new Error("Failed inserting payloads to database");
    }

    // Update synced slot in redis
    const latestSlot: string = freshPayloads[0].slot;
    const success: "OK" = await this.redis.set(this.relay.name, latestSlot);
    // Check for cache insertion
    if (success !== "OK") {
      logger.error(
        `${this.relay.name}: Could not update latest slot in Redis: ${latestSlot}`
      );
      throw new Error("Failed inserting to Redis cache");
    }

    // Log success
    logger.info(
      `${this.relay.name}: Updated slot ${latestSlot} as latest in Redis`
    );
  }

  public async sync(): Promise<void> {
    // Sync payloads
    await this.syncFreshPayloads();

    // Recollect in 30s
    logger.info(`${this.relay.name}: Sleeping for 30s`);
    setTimeout(() => this.sync(), 1000 * 30);
  }
}
