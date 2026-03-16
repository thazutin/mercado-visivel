import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET!;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN!;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;

  // 1) Trocar refresh_token por access_token
  console.log("--- Obtendo access_token ---");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error("❌ Erro ao obter access_token:");
    console.error(JSON.stringify(tokenData, null, 2));
    return;
  }

  const accessToken = tokenData.access_token;
  console.log("✅ access_token obtido (expires_in:", tokenData.expires_in, "s)");

  // 2) Chamar listAccessibleCustomers
  console.log("\n--- GET listAccessibleCustomers ---");
  const adsRes = await fetch(
    "https://googleads.googleapis.com/v19/customers:listAccessibleCustomers",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
      },
    }
  );

  const adsText = await adsRes.text();
  console.log("Status:", adsRes.status);
  console.log("Content-Type:", adsRes.headers.get("content-type"));
  try {
    const adsData = JSON.parse(adsText);
    console.log("Response:", JSON.stringify(adsData, null, 2));
  } catch {
    console.log("Response (raw):", adsText.slice(0, 1000));
  }
}

main();
