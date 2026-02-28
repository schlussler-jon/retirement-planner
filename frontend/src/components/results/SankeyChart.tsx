import { useEffect, useRef, useState } from 'react'
import { sankey, sankeyLinkHorizontal } from 'd3-sankey'
import { select } from 'd3-selection'

interface SankeyNode {
  name: string
  category?: string
}

interface SankeyLink {
  source: number
  target: number
  value: number
}

type IncomeStreamType = 'pension' | 'social_security' | 'salary' | 'self_employment' | 'other'

interface Props {
  incomeBySource: Record<string, number>
  incomeSourceTypes: Record<string, IncomeStreamType>
  expensesByCategory: Record<string, number>
  federalTax: number
  stateTax: number
  savings: number
  surplusAccountName?: string
  contributionsByAccount?: Record<string, number>
}

interface HoverInfo {
  source?: string
  target?: string
  value: number
  type: 'link' | 'node'
  label: string
}

export default function SankeyChart({ incomeBySource, incomeSourceTypes, expensesByCategory, federalTax, stateTax, savings, surplusAccountName, contributionsByAccount }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)

  useEffect(() => {
    if (!svgRef.current) return

    const width = 800
    const height = 500
    const margin = { top: 10, right: 10, bottom: 10, left: 10 }

    const nodes: SankeyNode[] = []
    const links: SankeyLink[] = []
    let nodeIndex = 0

    // Income sources (left side)
    const incomeNodes: Record<string, number> = {}
    Object.entries(incomeBySource).forEach(([source, amount]) => {
      if (amount > 0) {
        incomeNodes[source] = nodeIndex
        const incomeType = incomeSourceTypes[source] || 'other'
        nodes.push({ name: source, category: incomeType })
        nodeIndex++
      }
    })

    const totalIncome = Object.values(incomeBySource).reduce((sum, v) => sum + v, 0)

    const addDestination = (name: string, category: string, amount: number) => {
      if (amount <= 0) return
      const idx = nodeIndex
      nodes.push({ name, category })
      nodeIndex++
      Object.entries(incomeBySource).forEach(([source, incomeAmount]) => {
        if (incomeAmount > 0) {
          links.push({
            source: incomeNodes[source],
            target: idx,
            value: amount * (incomeAmount / totalIncome)
          })
        }
      })
    }

    if (federalTax > 0)  addDestination('Federal Tax', 'tax', federalTax)
    if (stateTax > 0)    addDestination('State Tax', 'tax', stateTax)

    Object.entries(expensesByCategory).forEach(([category, amount]) => {
      addDestination(category, 'expense', amount)
    })

    if (savings > 0) addDestination(surplusAccountName || 'Net Savings', 'savings', savings)

    Object.entries(contributionsByAccount ?? {}).forEach(([accountName, amount]) => {
      addDestination(accountName, 'contribution', amount)
    })

    // Sankey generator
    const sankeyGenerator = sankey<SankeyNode, SankeyLink>()
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])

    const { nodes: sankeyNodes, links: sankeyLinks } = sankeyGenerator({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d }))
    })

    select(svgRef.current).selectAll('*').remove()

    const svg = select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('max-width', '100%')
      .style('height', 'auto')

    const colorMap: Record<string, string> = {
      pension:         '#9370DB',
      social_security: '#4ECDC4',
      salary:          '#FF69B4',
      self_employment: '#FFA500',
      other:           '#FFFF00',
      tax:             '#FF6B6B',
      expense:         '#FFD700',
      savings:         '#32CD32',
      contribution:    '#60a5fa',
    }

    const fmt = (v: number) => '$' + (v / 1000).toFixed(0) + 'K'

    // Links
    svg.append('g')
      .selectAll('path')
      .data(sankeyLinks)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', (d: any) => colorMap[sankeyNodes[d.source.index].category || 'income'] || '#999')
      .attr('stroke-width', (d: any) => Math.max(1, d.width))
      .attr('fill', 'none')
      .attr('opacity', 0.3)
      .style('cursor', 'pointer')
      .on('mouseenter', (_event: any, d: any) => {
        const src = sankeyNodes[d.source.index]
        const tgt = sankeyNodes[d.target.index]
        setHoverInfo({
          source: src.name,
          target: tgt.name,
          value: d.value,
          type: 'link',
          label: `${src.name}  →  ${tgt.name}:  ${fmt(d.value)}`
        })
      })
      .on('mouseleave', () => setHoverInfo(null))

    // Nodes
    const incomeCategories = ['pension', 'social_security', 'salary', 'self_employment', 'other']
    const totalIncomeForPct = sankeyNodes
      .filter((n: any) => incomeCategories.includes(n.category))
      .reduce((sum: number, n: any) => sum + (n.value || 0), 0)

    svg.append('g')
      .selectAll('rect')
      .data(sankeyNodes)
      .join('rect')
      .attr('x', (d: any) => d.x0)
      .attr('y', (d: any) => d.y0)
      .attr('height', (d: any) => d.y1 - d.y0)
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('fill', (d: any) => colorMap[d.category || 'income'] || '#999')
      .attr('opacity', 0.8)
      .style('cursor', 'pointer')
      .on('mouseenter', (_event: any, d: any) => {
        const pct = totalIncomeForPct > 0
          ? ((d.value / totalIncomeForPct) * 100).toFixed(0)
          : '0'
        setHoverInfo({
          value: d.value,
          type: 'node',
          label: `${d.name}:  ${fmt(d.value)}  (${pct}% of income)`
        })
      })
      .on('mouseleave', () => setHoverInfo(null))

    // Labels
    svg.append('g')
      .selectAll('text')
      .data(sankeyNodes)
      .join('text')
      .attr('x', (d: any) => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
      .attr('y', (d: any) => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d: any) => d.x0 < width / 2 ? 'start' : 'end')
      .attr('font-size', '11px')
      .attr('fill', '#e2e8f0')
      .text((d: any) => {
        const pct = totalIncomeForPct > 0
          ? ((d.value / totalIncomeForPct) * 100).toFixed(0)
          : '0'
        return `${d.name} (${fmt(d.value)}, ${pct}%)`
      })

  }, [incomeBySource, incomeSourceTypes, expensesByCategory, federalTax, stateTax, savings, surplusAccountName, contributionsByAccount])

  return (
    <div className="bg-slate-900 rounded-lg p-6">
      <h3 className="font-sans text-lg font-semibold text-white mb-1">Cash Flow</h3>
      <p className="font-sans text-slate-400 text-sm mb-3">Where your money comes from and where it goes</p>

      {/* Info bar */}
      <div className="h-8 mb-4 flex items-center px-3 rounded-lg bg-slate-800/60 border border-violet-800/50">
        {hoverInfo ? (
          <p className="font-sans text-sm text-white">
            {hoverInfo.label}
          </p>
        ) : (
          <p className="font-sans text-xs text-slate-500 italic">
            Hover over a flow or node to see details
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <svg ref={svgRef}></svg>
      </div>
    </div>
  )
}
