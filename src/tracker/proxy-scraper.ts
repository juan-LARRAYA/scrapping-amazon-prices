import { loadEnvFileIfPresent } from "./load-env.js"

loadEnvFileIfPresent()

import { scrapeProduct } from "./scraper.js"
import { initDb } from "../db/schema.js"
import { saveSnapshot } from "../db/queries.js"

const getAsins = (envVar: string): string[] =>
  (process.env[envVar] ?? "").split(",").map((s) => s.trim()).filter(Boolean)

const main = async () => {
  await initDb()

  const stores = [
    { domain: "es", asins: getAsins("AMAZON_ASINS_ES") },
    { domain: "com", asins: getAsins("AMAZON_ASINS_US") },
  ]

  console.log("Scraping de Amazon usando Proxy + API (Decodo)")
  console.log("Proveedor: Decodo Scraper API")

  for (const { domain, asins } of stores) {
    if (asins.length === 0) continue

    console.log(`\nTienda: amazon.${domain} — ${asins.length} ASIN(s): ${asins.join(", ")}`)

    for (const asin of asins) {
      console.log(`\n→ [Proxy] Solicitando ${asin} (amazon.${domain}) vía Decodo...`)

      try {
        const data = await scrapeProduct(asin, domain)

        console.log(`  [Proxy OK] ${data.asin}`)
        console.log(`  Título:   ${data.title ?? "no encontrado"}`)
        console.log(`  Precio:   ${data.price ?? "no encontrado"} ${data.currency ?? ""}`)
        console.log(`  Rating:   ${data.rating ?? "no encontrado"}`)
        console.log(`  Reviews:  ${data.reviewsCount ?? "no encontrado"}`)
        console.log(`  Stock:    ${data.availability ?? "no encontrado"}`)
        console.log(`  URL:      ${data.url ?? "no encontrada"}`)
        console.log(`  Scraped:  ${data.scrapedAt}`)

        await saveSnapshot(data)
        console.log(`  [DB] Snapshot guardado en la base de datos`)
      } catch (error) {
        console.error(`  [Proxy ERROR] ${error instanceof Error ? error.message : error}`)
      }
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})