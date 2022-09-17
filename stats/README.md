# mevboost.org: stats

Tracks [mev-boost relays](https://flashbots.notion.site/Relay-API-Spec-5fb0819366954962bc02e81cb33840f5) for `ProposerPayloadsDelivered` + other statistics.

Does not currently support reorg healing (indexer syncs live latest slot, not 20-blocks-delayed).

Relay configs can be updated in [config.json](./config.json).

## Run locally

```bash
# Update env vars
cp .env.sample .env
vim .env

# Install deps
npm install

# Run
npm run start
```
