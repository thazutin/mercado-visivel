async function main() {
  const leadId = process.argv[2]
  if (!leadId) { console.error("[reprocess] Uso: npx tsx scripts/reprocess-lead.ts <leadId>"); process.exit(1); }
  console.log("[reprocess] Disparando pipeline para lead:", leadId)

  const res = await fetch("https://virolocal.com/api/plan/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.INTERNAL_API_SECRET || "viro-internal",
    },
    body: JSON.stringify({ leadId }),
  })

  const text = await res.text()
  console.log("[reprocess] Status:", res.status)
  console.log("[reprocess] Resposta:", text)
}

main().catch(console.error)
