import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { GoogleAdsApi } from "google-ads-api";

const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
const clientId = process.env.GOOGLE_ADS_CLIENT_ID!;
const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET!;
const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN!;
const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!;

console.log("Developer Token:", JSON.stringify(devToken), `(len: ${devToken.length})`);
console.log("Client ID:", JSON.stringify(clientId));
console.log("Client Secret:", clientSecret.slice(0, 8) + "...");
console.log("Refresh Token:", refreshToken.slice(0, 12) + `... (len: ${refreshToken.length})`);
console.log("Customer ID:", JSON.stringify(customerId), `(len: ${customerId.length})`);

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
});

const customer = client.Customer({
  customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID!,
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
});

async function main() {
  // 1) Listar contas filhas da MCC
  try {
    console.log("\n--- Listando contas da MCC ---");
    const accounts = await customer.query(`
      SELECT
        customer_client.id,
        customer_client.descriptive_name,
        customer_client.status
      FROM customer_client
      LIMIT 10
    `);
    console.log("✅ Conexão OK!");
    for (const row of accounts) {
      console.log(`  [${row.customer_client?.id}] ${row.customer_client?.descriptive_name} — ${row.customer_client?.status}`);
    }
    if (accounts.length === 0) {
      console.log("  (nenhuma conta encontrada)");
    }
  } catch (err: any) {
    console.error("\n❌ Erro:");
    console.error("  Full error:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    if (err.errors) {
      for (const e of err.errors) {
        console.error("  Código:", JSON.stringify(e.error_code));
        console.error("  Mensagem:", e.message);
        console.error("  Details:", JSON.stringify(e, null, 2));
      }
    } else {
      console.error("  ", err.message || err);
    }
  }
}

main();
