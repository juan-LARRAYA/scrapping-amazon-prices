import { loadEnvFileIfPresent } from "./load-env.js"

loadEnvFileIfPresent()

import { scrapeProduct } from "./scraper-amazon.js"
import { scrapeProduct as scrapeProductML } from "./scraper-mercadolibre.js"
import { initDb } from "../db/schema.js"
import { saveSnapshot } from "../db/queries.js"

const getAsins = (envVar: string): string[] =>
  (process.env[envVar] ?? "").split(",").map((s) => s.trim()).filter(Boolean)

const main = async () => {
  await initDb()

  const stores = [
    { label: "amazon.es", domain: "es", asins: getAsins("AMAZON_ASINS_ES"), scraper: scrapeProduct, provider: "Decodo" },
    { label: "amazon.com", domain: "com", asins: getAsins("AMAZON_ASINS_US"), scraper: scrapeProduct, provider: "Decodo" },
    { label: "mercadolibre.com.ar", domain: "AR", asins: getAsins("ML_ITEMS"), scraper: scrapeProductML, provider: "MercadoLibre API" },
  ]

  for (const store of stores) {
    if (store.asins.length === 0) continue

    console.log(`\nTienda: ${store.label} — ${store.asins.length} item(s) vía ${store.provider}: ${store.asins.join(", ")}`)

    for (const asin of store.asins) {
      console.log(`\n→ Solicitando ${asin} (${store.label})...`)

      try {
        const data = await store.scraper(asin, store.domain)

        console.log(`  [OK] ${data.asin}`)
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
        console.error(`  [ERROR] ${error instanceof Error ? error.message : error}`)
      }
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})