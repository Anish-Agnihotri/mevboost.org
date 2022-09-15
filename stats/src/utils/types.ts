// Spec: https://flashbots.notion.site/Relay-API-Spec-5fb0819366954962bc02e81cb33840f5#286c858c4ba24e58ada6348d8d4b71ec
export type BidTrace = {
  slot: string;
  parent_hash: string;
  block_hash: string;
  builder_pubkey: string;
  proposer_pubkey: string;
  proposer_fee_recipient: string;
  gas_limit: string;
  gas_used: string;
  value: string;
};
