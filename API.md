# mevboost.org API

[mevboost.org](https://mevboost.org) exposes an API that aggregates data across [tracked relays](https://github.com/Anish-Agnihotri/mevboost.org/blob/master/stats/config.json). The accuracy of this data is _only_ as accurate as the data retrieved from the individual relay data APIs.

If you need direct database access, according to the [defined schema](./stats/prisma/schema.prisma), please [email Anish](mailto:contact@anishagnihotri.com).

## Endpoints

### [/stats](https://mevboost.org/stats)

Returns aggregated statistics generated from [the stats transformer](./stats/src/transformer.ts).

Endpoint implemented in [./frontend/src/pages/stats.ts](./frontend/src/pages/stats.ts).

```json5
// 20220928222916
// https://mevboost.org/stats

{
  // Number: last recorded slot
  last_slot: 4799534,
  total: {
    // Number of blocks since merge
    blocks: 98622,
    // Number of blocks from relays since merge
    payloads: 28305,
  },
  daily: {
    // Number of blocks in last 24h
    blocks: 7200,
    // Number of blocks from relays in last 24h
    payloads: 2724,
  },
  relays: [
    {
      name: "Flashbots", // Relay name
      value: 4130.109852019913, // Total value of all blocks in ETH
      count: 23566, // Number of blocks from relay
      avg_value: 0.1752571438521562, // Average value of each block in ETH
    },
    // ...
  ],
  builders: [
    {
      // Builder public key
      pubkey: "0xa1dead01e65f0a0eee7b5170223f20c8f0cbf122eac3324d61afbdb33a8885ff8cab2ef514ac2c7698ae0d6289ef27fc",
      // Number of blocks built by builder public key
      count: 9086,
      // Total value of all blocks built by builder in ETH
      value: 1583.9500172880828,
      // Average value of each block built by builder in ETH
      avg_value: 0.17432863936694726,
      // Name of relay last used by builder
      last_relay: "Flashbots",
    },
    // ...
  ],
}
```

### [/payloads?offset=0](https://mevboost.org/payloads?offset=0)

Returns all blocks submitted by relays, in batches of 25 at a time, with an optional offset to paginate.

Endpoint implemented in [./frontend/src/pages/payloads.ts](./frontend/src/pages/payloads.ts).

```json5
// 20220928223839
// https://mevboost.org/payloads?offset=0

[
  {
    // Database id
    id: "994af696-c3cd-43de-9963-b438fc42e956",
    // Name of relay originating block
    relay: "Flashbots",
    slot: 4799582,
    parent_hash: "0xf557c556665157a5a2ccd40a9cdad1fe396f2abb5fefdfd529f15e179fea5a72",
    block_hash: "0xec53d39470ef89d39e779ecb8a73bdd2a3751da578d284aef93e14d2f59468c5",
    builder_pubkey: "0xa30251c8d20aaae33c6dc49486ee4e14dbed562a745154202e4133e490bce0fe0ca7c687d9609ae0c390968039a5d5b8",
    proposer_pubkey: "0xa6724781cb3ccff5ca31754c3b342ece5e99541576aefa41464adc0fc992772b59e4e51d9e37b52c8626a021c62568b4",
    proposer_fee_recipient: "0x388c818ca8b9251b393131c08a736a67ccb19297",
    // Can be null (some relays not to-spec)
    gas_limit: "30000000",
    // Can be null (some relays not to-spec)
    gas_used: "20921516",
    // (wei)
    value: "34012115920019868",
    // Block sync timestamp
    inserted_at: "2022-09-29T02:36:49.596Z",
  },
  //...
]
```
