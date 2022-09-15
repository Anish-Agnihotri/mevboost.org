import axios from "axios"; // Requests
import Redis from "ioredis"; // Cache
import logger from "./utils/logger"; // Logging
import { BidTrace } from "./utils/types"; // Types
import { PrismaClient } from "@prisma/client"; // Prisma

export default class Collector {
  // Last synced slot
  private syncedSlot: string | undefined;
  // Relay info
  private relay: { name: string; url: string };

  // Redis
  private redis: Redis = new Redis();
  // Prisma
  private prisma: PrismaClient = new PrismaClient();

  /**
   * Initialize new collector
   * @param {string} name of relay
   * @param {string} url of relay
   */
  constructor(name: string, url: string) {
    logger.info(`Collector: initializing relay: ${name}`);
    this.relay = { name, url };
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

      // Log retrieval
      const newestSlot: string = data[0].slot;
      const oldestSlot: string = data[data.length - 1].slot;
      logger.info(
        `${this.relay.name}: Collected ${data.length} payloads (${newestSlot} -> ${oldestSlot}).`
      );

      // Return BidTraces
      return data;
    } catch {
      // Log error + throw
      logger.error(
        `${this.relay.name}: Error collecting payload (cursor: ${cursor})`
      );
      throw new Error("Error collecting payloads.");
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

  private async collectFreshPayloads(
    cursor: string | undefined = undefined,
    lastSynced: string | undefined = undefined
  ): Promise<BidTrace[]> {
    let payloads: BidTrace[] = [];

    // Collect initial payload
    const collection: BidTrace[] = await this.collectPayloads(cursor);
    console.log("Collected: ", collection.length);
    payloads = [...payloads, ...collection];

    // Check for last synced entity
    if (lastSynced) {
      const upToDate: boolean = payloads.some(
        (payload) => payload.slot === lastSynced
      );
      if (upToDate) return payloads;
    }

    // If =100 entities, recollect with cursor
    if (collection.length === 100) {
      const cursor = collection[collection.length - 1].slot;
      const additional: BidTrace[] = await this.collectFreshPayloads(cursor);
      payloads = [...payloads, ...additional];
    }

    // Return payloads
    return payloads;
  }

  private async loadFreshPayloads() {
    // Update last synced slot
    await this.updateSyncedSlot();

    // Collect fresh payloads
    const payloads = await this.collectFreshPayloads(
      undefined,
      this.syncedSlot
    );

    console.log(payloads.length);
  }

  public async sync() {
    await this.loadFreshPayloads();
  }
}
