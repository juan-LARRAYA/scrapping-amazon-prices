import type { PriceRow } from "../db/queries.js"

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
}

export type ChartSeries = {
  asin: string
  pts: PriceRow[]
  d: string
  color: string
}

export type ChartData = {
  colorMap: Map<string, string>
  series: ChartSeries[]
  yTicks: number[]
  xTicks: { x: number; label: string }[]
  W: number
  H: number
  PL: number
  PR: number
  PT: number
  PB: number
  x: (ts: number) => number
  y: (price: number) => number
}

export const fmt = (n: number): string => `${n.toFixed(2)} €`

export const fmtDate = (s: string): string =>
  new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })

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

  const allPrices = allPoints.map((p) => p.price)
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0
  const margin = (maxPrice - minPrice) * 0.1 || 1
  const yMin = minPrice - margin
  const yMax = maxPrice + margin

  const allDates = allPoints.map((p) => new Date(p.scrapedAt).getTime())
  const minDate = allDates.length > 0 ? Math.min(...allDates) : 0
  const maxDate = allDates.length > 0 ? Math.max(...allDates) : 0

  const W = 900, H = 340, PL = 58, PR = 16, PT = 16, PB = 44
  const PW = W - PL - PR
  const PH = H - PT - PB

  const x = (ts: number) =>
    maxDate === minDate ? PL + PW / 2 : PL + ((ts - minDate) / (maxDate - minDate)) * PW
  const y = (p: number) =>
    yMax === yMin ? PT + PH / 2 : PT + ((yMax - p) / (yMax - yMin)) * PH

  const yTicks = Array.from({ length: 5 }, (_, i) => yMax - (i / 4) * (yMax - yMin))

  const uniqueDays = [...new Set(allPoints.map((p) => p.scrapedAt.slice(0, 10)))]
  const xTickCount = Math.min(6, uniqueDays.length)
  const xStep = allDates.length > 1 ? (maxDate - minDate) / Math.max(xTickCount - 1, 1) : 0
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const ts = minDate + i * xStep
    return { x: x(ts), label: new Date(ts).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) }
  })

  const series: ChartSeries[] = trackedAsins.map((asin) => {
    const pts = groupedByAsin.get(asin) ?? []
    const d = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(new Date(p.scrapedAt).getTime()).toFixed(1)} ${y(p.price).toFixed(1)}`)
      .join(" ")
    return { asin, pts, d, color: colorMap.get(asin)! }
  })

  return { colorMap, series, yTicks, xTicks, W, H, PL, PR, PT, PB, x, y }
}
