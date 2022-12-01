import { PrismaClient, payloads } from "@prisma/client"; // DB
import { ethers } from "ethers"; 


// Setup Prisma
const client = new PrismaClient();

// Payload data
type Link = { url: string; text: string };
export type Payload = {
  relay: string;
  slot: Link;
  parent_hash: Link;
  block_hash: Link;
  builder: string;
  proposer: string;
  value: string;
};

/**
 * Truncates string as first-10 + ... + last-10 characters
 * @param {string} str to truncate
 * @returns {string} truncated
 */
function truncateString(str: string): string {
  return str.substr(0, 10) + "..." + str.slice(str.length - 10);
}

function weiStringToETH(w: string): string {
  const wei = ethers.utils.parseUnits(w, "wei");
  return ethers.utils.formatEther(wei);
}

/**
 * Collect payloads, given optional offset, in formatted type
 * @param {number} offset to skip
 * @returns {payloads[]}
 */
export async function collectPayloads(offset: number = 0): Promise<Payload[]> {
  // Collect payloads
  const payloads: payloads[] = await client.payloads.findMany({
    take: 25,
    skip: offset,
    orderBy: {
      slot: "desc",
    },
  });

  // Format payloads for front-end
  return payloads.map((p: payloads) => ({
    relay: p.relay,
    slot: {
      url: `https://beaconcha.in/slot/${p.slot}`,
      text: p.slot.toString(),
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
    value: weiStringToETH(p.value),
  }));
}

export async function get({ request: { url } }: { request: { url: string } }) {
  // Collect query params
  const params = new URL(url).searchParams;
  const offset: string | null = params.get("offset");

  // Setup prisma take
  const take = offset ? Number(offset) : 0;

  // Collect payloads
  const data = await collectPayloads(take);

  return new Response(JSON.stringify(data), { status: 200 });
}
