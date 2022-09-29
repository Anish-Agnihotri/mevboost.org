import { PrismaClient, payloads } from "@prisma/client"; // DB

// Setup Prisma
const client = new PrismaClient();

/**
 * Collect payloads, given optional offset
 * @param {number} offset to skip
 * @returns {payloads[]}
 */
async function collectPayloads(offset: number = 0): Promise<payloads[]> {
  // Collect payloads
  return await client.payloads.findMany({
    take: 25,
    skip: offset,
    orderBy: {
      slot: "desc",
    },
  });
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
