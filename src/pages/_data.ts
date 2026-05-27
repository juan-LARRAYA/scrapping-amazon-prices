import type { PriceRow } from "../db/queries.js"

export type Store = "amazon-es" | "amazon-us" | "mercadolibre" | "unknown"

export const STORE_LABELS: Record<Store, string> = {
  "amazon-es": "Amazon España",
  "amazon-us": "Amazon US",
  "mercadolibre": "MercadoLibre",
  "unknown": "Otros",
}

function detectStore(currency: string | null, url: string | null): Store {
  if (currency === "EUR") return "amazon-es"
  if (currency === "USD") return "amazon-us"
  if (currency === "ARS") return "mercadolibre"
  if (url?.includes("amazon.es")) return "amazon-es"
  if (url?.includes("amazon.com")) return "amazon-us"
  if (url?.includes("mercadolibre")) return "mercadolibre"
  return "unknown"
}

export type ProductSummary = {
  asin: string
  title: string | null
  url: string | null
  currency: string | null
  latestPrice: number | null
  previousPrice: number | null
  minPrice: number
  maxPrice: number
  availability: string | null
  rating: number | null
  snapshots: number
  lastSeen: string
  store: Store
}

export type ChartSeries = {
  asin: string
  pts: PriceRow[]
  color: string
}

export type ChartData = {
  series: ChartSeries[]
  colorMap: Map<string, string>
}

export const fmt = (n: number, currency: string | null): string => {
  if (currency === "EUR") return `${n.toFixed(2)} €`
  if (currency === "USD") return `$${n.toFixed(2)}`
  if (currency === "ARS") return `$ ${Math.round(n).toLocaleString("es-AR")}`
  return n.toFixed(2)
}

export const fmtDate = (s: string): string =>
  new Date(s).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

export const delta = (a: number | null, b: number | null): number | null =>
  a != null && b != null && b !== 0 ? ((a - b) / b) * 100 : null

export function buildProducts(allPoints: PriceRow[]): ProductSummary[] {
  const grouped = new Map<string, PriceRow[]>()
  for (const point of allPoints) {
    const list = grouped.get(point.asin) ?? []
    list.push(point)
    grouped.set(point.asin, list)
  }

  return [...grouped.entries()].map(([asin, points]) => {
    const prices = points.map((p) => p.price)
    const latest = points.at(-1)!
    const previous = points.length > 1 ? points.at(-2)! : null

    return {
      asin,
      title: latest.title,
      url: latest.url,
      currency: latest.currency,
      latestPrice: latest.price,
      previousPrice: previous?.price ?? null,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      availability: latest.availability,
      rating: latest.rating,
      snapshots: points.length,
      lastSeen: latest.scrapedAt,
      store: detectStore(latest.currency, latest.url),
    }
  })
}

export function buildChartData(allPoints: PriceRow[], products: ProductSummary[]): ChartData {
  const palette = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"]
  const trackedAsins = products.map((p) => p.asin)
  const colorMap = new Map(trackedAsins.map((asin, i) => [asin, palette[i % palette.length]]))

  const groupedByAsin = new Map<string, PriceRow[]>()
  for (const point of allPoints) {
    const list = groupedByAsin.get(point.asin) ?? []
    list.push(point)
    groupedByAsin.set(point.asin, list)
  }

  const series: ChartSeries[] = trackedAsins.map((asin) => ({
    asin,
    pts: groupedByAsin.get(asin) ?? [],
    color: colorMap.get(asin)!,
  }))

  return { series, colorMap }
}
