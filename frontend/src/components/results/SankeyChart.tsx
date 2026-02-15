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

interface Props {
  incomeBySource: Record<string, number>
  incomeSourceTypes: Record<string, IncomeStreamType>  // NEW: map source name to type
  expensesByCategory: Record<string, number>
  federalTax: number
  stateTax: number
  savings: number
}
type IncomeStreamType = 'pension' | 'social_security' | 'salary' | 'self_employment' | 'other'

export default function SankeyChart({ incomeBySource, incomeSourceTypes, expensesByCategory, federalTax, stateTax, savings }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null)

  useEffect(() => {
    if (!svgRef.current) return

    const width = 800
    const height = 500
    const margin = { top: 10, right: 10, bottom: 10, left: 10 }

    // Build nodes and links
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

    // Destinations (right side)
    const destinationStart = nodeIndex

    // Federal Tax
    if (federalTax > 0) {
      const fedTaxIndex = nodeIndex
      nodes.push({ name: 'Federal Tax', category: 'tax' })
      nodeIndex++

      // Link from each income source proportionally
      const totalIncome = Object.values(incomeBySource).reduce((sum, v) => sum + v, 0)
      Object.entries(incomeBySource).forEach(([source, amount]) => {
        if (amount > 0) {
          const proportion = amount / totalIncome
          links.push({
            source: incomeNodes[source],
            target: fedTaxIndex,
            value: federalTax * proportion
          })
        }
      })
    }

    // State Tax
    if (stateTax > 0) {
      const stateTaxIndex = nodeIndex
      nodes.push({ name: 'State Tax', category: 'tax' })
      nodeIndex++

      const totalIncome = Object.values(incomeBySource).reduce((sum, v) => sum + v, 0)
      Object.entries(incomeBySource).forEach(([source, amount]) => {
        if (amount > 0) {
          const proportion = amount / totalIncome
          links.push({
            source: incomeNodes[source],
            target: stateTaxIndex,
            value: stateTax * proportion
          })
        }
      })
    }

    // Expenses by category
    Object.entries(expensesByCategory).forEach(([category, amount]) => {
      if (amount > 0) {
        const expenseIndex = nodeIndex
        nodes.push({ name: category, category: 'expense' })
        nodeIndex++

        const totalIncome = Object.values(incomeBySource).reduce((sum, v) => sum + v, 0)
        Object.entries(incomeBySource).forEach(([source, incomeAmount]) => {
          if (incomeAmount > 0) {
            const proportion = incomeAmount / totalIncome
            links.push({
              source: incomeNodes[source],
              target: expenseIndex,
              value: amount * proportion
            })
          }
        })
      }
    })

    // Savings
    if (savings > 0) {
      const savingsIndex = nodeIndex
      nodes.push({ name: 'Net Savings', category: 'savings' })
      nodeIndex++

      const totalIncome = Object.values(incomeBySource).reduce((sum, v) => sum + v, 0)
      Object.entries(incomeBySource).forEach(([source, amount]) => {
        if (amount > 0) {
          const proportion = amount / totalIncome
          links.push({
            source: incomeNodes[source],
            target: savingsIndex,
            value: savings * proportion
          })
          }
        })
      }

    // Create sankey generator
    const sankeyGenerator = sankey<SankeyNode, SankeyLink>()
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])

    const { nodes: sankeyNodes, links: sankeyLinks } = sankeyGenerator({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d }))
    })

    // Clear previous render
    select(svgRef.current).selectAll('*').remove()

    const svg = select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('max-width', '100%')
      .style('height', 'auto')

    // Color mapping
    const colorMap: Record<string, string> = {
      pension: '#9370DB',           // Medium purple
      social_security: '#4ECDC4',   // Teal
      salary: '#FF69B4',            // Hot pink
      self_employment: '#FFA500',   // Orange
      other: '#FFFF00',             // Sky blue
      tax: '#FF6B6B',               // Coral/Red
      expense: '#FFD700',           // Gold
      savings: '#32CD32'            // Green
    }

// Draw links
    svg.append('g')
      .selectAll('path')
      .data(sankeyLinks)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', (d: any) => {
        const sourceNode = sankeyNodes[d.source.index]
        return colorMap[sourceNode.category || 'income'] || '#999'
      })
      .attr('stroke-width', (d: any) => Math.max(1, d.width))
      .attr('fill', 'none')
      .attr('opacity', 0.3)
      .style('cursor', 'pointer')
      .on('mouseenter', (event: any, d: any) => {
        const sourceNode = sankeyNodes[d.source.index]
        const targetNode = sankeyNodes[d.target.index]
        const content = `${sourceNode.name} → ${targetNode.name}: $${(d.value / 1000).toFixed(0)}K`
        setTooltip({ x: event.clientX, y: event.clientY, content })
      })
      .on('mousemove', (event: any) => {
        setTooltip(prev => prev ? { ...prev, x: event.clientX, y: event.clientY } : null)
      })
      .on('mouseleave', () => {
        setTooltip(null)
      })

// Draw nodes
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
      .on('mouseenter', (event: any, d: any) => {
        const totalIncome = sankeyNodes
          .filter((n: any) => ['pension', 'social_security', 'salary', 'self_employment', 'other'].includes(n.category))
          .reduce((sum: number, n: any) => sum + (n.value || 0), 0)
        const percentage = totalIncome > 0 ? ((d.value / totalIncome) * 100).toFixed(0) : '0'
        const content = `${d.name}: $${(d.value / 1000).toFixed(0)}K (${percentage}%)`
        setTooltip({ x: event.clientX, y: event.clientY, content })
      })
      .on('mousemove', (event: any) => {
        setTooltip(prev => prev ? { ...prev, x: event.clientX, y: event.clientY } : null)
      })
      .on('mouseleave', () => {
        setTooltip(null)
      })

    // Draw labels
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
        const totalIncome = sankeyNodes
          .filter((n: any) => ['pension', 'social_security', 'salary', 'self_employment', 'other'].includes(n.category))
          .reduce((sum: number, n: any) => sum + (n.value || 0), 0)
        const percentage = totalIncome > 0 ? ((d.value / totalIncome) * 100).toFixed(0) : '0'
        return `${d.name} ($${(d.value / 1000).toFixed(0)}K, ${percentage}%)`
      })
  }, [incomeBySource, expensesByCategory, federalTax, stateTax, savings])

return (
    <>
      <div className="bg-slate-900 rounded-lg p-6">
        <h3 className="font-sans text-lg font-semibold text-white mb-2">Cash Flow</h3>
        <p className="font-sans text-slate-400 text-sm mb-4">Where your money comes from and where it goes</p>
        <div className="overflow-x-auto">
          <svg ref={svgRef}></svg>
        </div>
      </div>
      
      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 10,
            top: tooltip.y + 10,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            pointerEvents: 'none',
            zIndex: 1000,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
          }}
        >
          {tooltip.content}
        </div>
      )}
    </>
  )
}