import { PrismaClient, payloads } from "@prisma/client"; // DB

// Setup Prisma
const client = new PrismaClient();

// Formatted payload
export type FormattedPayload = {
  Relay: string;
  Slot: number;
  "Parent Hash": string;
  "Block Hash": string;
  Builder: string;
  Proposer: string;
};

/**
 * Truncates string as first-10 + ... + last-10 characters
 * @param {string} str to truncate
 * @returns {string} truncated
 */
function truncateString(str: string): string {
  return str.substr(0, 10) + "..." + str.slice(str.length - 10);
}

/**
 * Collect payloads, given optional offset, in formatted type
 * @param {number} offset to skip
 * @returns {payloads[]}
 */
export async function collectPayloads(offset: number = 0): Promise<any> {
  const payloads: payloads[] = await client.payloads.findMany({
    take: 25,
    skip: offset,
    orderBy: {
      slot: "desc",
    },
  });

  return payloads.map((p: payloads) => ({
    relay: p.relay,
    slot: {
      url: `https://beaconcha.in/slot/${p.slot}`,
      text: p.slot,
    },
    parent_hash: {
      url: `https://etherscan.io/block/${p.parent_hash}`,
      text: truncateString(p.parent_hash),
    },
    block_hash: {
      url: `https://etherscan.io/block/${p.block_hash}`,
      text: truncateString(p.block_hash),
    },
    builder: truncateString(p.builder_pubkey),
    proposer: truncateString(p.proposer_pubkey),
  }));
}

export async function get({ request: { url } }: { request: { url: string } }) {
  // Collect payloads
  const data: payloads[] = await client.payloads.findMany({
    take: 25,
    skip: 0,
    orderBy: {
      slot: "desc",
    },
  });

  return new Response(JSON.stringify(data), { status: 200 });
}
