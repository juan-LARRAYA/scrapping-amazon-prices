import { loadEnvFileIfPresent } from "./load-env.js"

loadEnvFileIfPresent()

import { initDb } from "../db/schema.js"
import { saveSnapshot } from "../db/queries.js"
import { scrapeProduct } from "./scraper-amazon.js"
import { scrapeProduct as scrapeProductML } from "./scraper-mercadolibre.js"

const getAsins = (envVar: string): string[] =>
  (process.env[envVar] ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)

const main = async () => {
  await initDb()

  const stores = [
    { domain: "es", asins: getAsins("AMAZON_ASINS_ES"), scraper: scrapeProduct },
    { domain: "com", asins: getAsins("AMAZON_ASINS_US"), scraper: scrapeProduct },
    { domain: "AR", asins: getAsins("ML_ITEMS"), scraper: scrapeProductML },
  ]

  const total = stores.reduce((n, s) => n + s.asins.length, 0)
  console.log(`Tracking ${total} producto(s)...\n`)

  for (const store of stores) {
    for (const asin of store.asins) {
      try {
        const snapshot = await store.scraper(asin, store.domain)
        await saveSnapshot(snapshot)

        console.log({
          asin: snapshot.asin,
          title: snapshot.title,
          price: snapshot.price,
          currency: snapshot.currency,
          availability: snapshot.availability,
          scrapedAt: snapshot.scrapedAt,
        })
      } catch (error) {
        console.error({
          asin,
          error: error instanceof Error ? error.message : "Error desconocido",
        })
      }
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
