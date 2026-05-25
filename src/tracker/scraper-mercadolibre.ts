import { loadEnvFileIfPresent } from "./load-env.js"

loadEnvFileIfPresent()

import type { ProductSnapshot } from "../db/queries.js"
import { toNumber } from "./utils.js"

const getDecodoAuth = (): string => {
  const token = process.env.DECODO_AUTH_TOKEN
  if (!token) throw new Error("Falta DECODO_AUTH_TOKEN")
  return `Basic ${token}`
}

const toMlUrl = (itemId: string): string => {
  const prefix = itemId.match(/^[A-Z]+/)?.[0] ?? "MLA"
  const number = itemId.replace(/^[A-Z]+/, "")
  return `https://articulo.mercadolibre.com.ar/${prefix}-${number}`
}

export const scrapeProduct = async (itemId: string, _country = "AR"): Promise<ProductSnapshot> => {
  const url = toMlUrl(itemId)

  const response = await fetch("https://scraper-api.decodo.com/v2/scrape", {
    method: "POST",
    body: JSON.stringify({ target: "universal", url, parse: false, headless: "html" }),
    headers: { "Content-Type": "application/json", Authorization: getDecodoAuth() },
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Decodo error ${response.status}: ${body}`)
  }

  const data = await response.json()
  const html: string = data.results?.[0]?.content ?? ""

  let title: string | null = null
  let price: number | null = null
  let currency: string | null = null
  let availability: string | null = null

  const ldMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[1])
      title = ld.name ?? null
      price = toNumber(ld.offers?.price)
      currency = ld.offers?.priceCurrency ?? null
      availability = ld.offers?.availability ?? null
    } catch { /* fallback */ }
  }

  if (!title) {
    title = html.match(/<title>([^<]+)/)?.[1]?.trim() ?? null
  }

  return {
    asin: itemId,
    title,
    price,
    currency,
    availability,
    rating: null,
    reviewsCount: null,
    url,
    scrapedAt: new Date().toISOString(),
  }
}
