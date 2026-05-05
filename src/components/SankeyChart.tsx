/**
 * Copyright (c) 2026 Custom Agile LLC. All rights reserved.
 */

/**
 * SankeyChart — pure SVG Sankey diagram for story dependency visualization.
 *
 * Layout algorithm mirrors the legacy D3 Sankey plugin used in the original
 * ExtJS app (sankey.layout(32), nodeWidth=15, nodePadding=10). Implemented
 * here without the d3-sankey dependency so the widget is fully self-contained.
 *
 * Visual spec (from legacy):
 *  - Nodes: rectangles labeled "FormattedID — Name (N SP)"
 *  - Links: SVG paths (cubic bezier), color = source node color
 *  - Blocked links: drawn in var(--ca-status-red) stroke
 *  - Node height = proportional to PlanEstimate (min 20px)
 *  - Double-click on a node opens the story detail page in a new tab
 *  - Nodes assigned to columns (layers) by topological sort depth
 */

import React, { useMemo, useState } from 'react';
import type { DependencyStory } from '../types';

// ── Constants (matching legacy sankey config) ─────────────────────────

const NODE_WIDTH = 15;
const NODE_PADDING = 10;
const MIN_NODE_HEIGHT = 20;
const POINTS_SCALE = 8;   // px per story point
const LAYOUT_ITERATIONS = 32;
const LINK_OPACITY = 0.5;

// ── Types ─────────────────────────────────────────────────────────────

interface SankeyNode {
  story: DependencyStory;
  /** Column (0 = leftmost) */
  col: number;
  /** Computed x position */
  x: number;
  /** Computed y position (top of node rect) */
  y: number;
  /** Node height in pixels */
  height: number;
  /** Running y-offset for outgoing links */
  sourceY: number;
  /** Running y-offset for incoming links */
  targetY: number;
  color: string;
}

interface SankeyLink {
  source: SankeyNode;
  target: SankeyNode;
  /** Whether the target story is blocked */
  blocked: boolean;
  /** Link weight (story points of target, for link thickness) */
  value: number;
  /** Thickness in pixels */
  thickness: number;
  /** Start y of link at source node */
  sy: number;
  /** Start y of link at target node */
  ty: number;
}

// ── Color helpers ─────────────────────────────────────────────────────

const SCHEDULE_STATE_COLORS: Record<string, string> = {
  'Backlog':      '#8a8a8a',
  'Defined':      '#327c98',
  'In-Progress':  '#f5a623',
  'Completed':    '#417505',
  'Accepted':     '#2e7d32',
};

function nodeColor(story: DependencyStory): string {
  if (story.DisplayColor) return story.DisplayColor;
  return SCHEDULE_STATE_COLORS[story.ScheduleState] ?? '#888';
}

function nodeHeight(story: DependencyStory): number {
  const fromPoints = (story.PlanEstimate ?? 1) * POINTS_SCALE;
  return Math.max(MIN_NODE_HEIGHT, fromPoints);
}

// ── Layout ────────────────────────────────────────────────────────────

/**
 * Compute topological depth (column) for each node.
 * Nodes with no predecessors in-scope get column 0.
 * A node's column = max(predecessor columns) + 1.
 */
function assignColumns(stories: DependencyStory[]): Map<number, number> {
  const oidSet = new Set(stories.map((s) => s.ObjectID));
  const colMap = new Map<number, number>();

  function getCol(oid: number, visited: Set<number>): number {
    if (colMap.has(oid)) return colMap.get(oid)!;
    if (visited.has(oid)) return 0; // cycle guard

    visited.add(oid);
    const story = stories.find((s) => s.ObjectID === oid);
    if (!story) return 0;

    const inScopePreds = story.PredecessorOIDs.filter((p) => oidSet.has(p));
    if (inScopePreds.length === 0) {
      colMap.set(oid, 0);
      return 0;
    }

    const maxPredCol = Math.max(...inScopePreds.map((p) => getCol(p, new Set(visited))));
    const col = maxPredCol + 1;
    colMap.set(oid, col);
    return col;
  }

  for (const story of stories) {
    getCol(story.ObjectID, new Set());
  }
  return colMap;
}

function layoutNodes(
  stories: DependencyStory[],
  svgWidth: number,
  svgHeight: number,
): SankeyNode[] {
  const colMap = assignColumns(stories);
  const numCols = Math.max(...Array.from(colMap.values())) + 1;

  // Group stories by column
  const byCol: Map<number, DependencyStory[]> = new Map();
  for (const story of stories) {
    const col = colMap.get(story.ObjectID) ?? 0;
    if (!byCol.has(col)) byCol.set(col, []);
    byCol.get(col)!.push(story);
  }

  // Column x positions
  const colSpacing = numCols > 1
    ? (svgWidth - NODE_WIDTH) / (numCols - 1)
    : svgWidth / 2;

  const nodes: SankeyNode[] = [];

  for (const [col, colStories] of byCol) {
    const totalHeight = colStories.reduce((sum, s) => sum + nodeHeight(s), 0)
      + NODE_PADDING * (colStories.length - 1);
    const startY = Math.max(0, (svgHeight - totalHeight) / 2);

    let y = startY;
    for (const story of colStories) {
      const h = nodeHeight(story);
      nodes.push({
        story,
        col,
        x: col * colSpacing,
        y,
        height: h,
        sourceY: y,
        targetY: y,
        color: nodeColor(story),
      });
      y += h + NODE_PADDING;
    }
  }

  // Iterative relaxation (matches legacy sankey.layout(32))
  const oidToNode = new Map<number, SankeyNode>(nodes.map((n) => [n.story.ObjectID, n]));

  for (let iter = 0; iter < LAYOUT_ITERATIONS; iter++) {
    // Relax target nodes (pull toward weighted average of source y)
    for (const node of nodes) {
      const inLinks = nodes
        .filter((n) => n.story.SuccessorOIDs.includes(node.story.ObjectID))
        .map((n) => ({ node: n, value: nodeHeight(node.story) }));

      if (inLinks.length === 0) continue;
      const weightedY = inLinks.reduce((sum, lk) => sum + lk.node.y * lk.value, 0)
        / inLinks.reduce((sum, lk) => sum + lk.value, 0);
      const delta = weightedY - node.y;
      node.y += delta * 0.5;
    }

    // Re-resolve overlaps within each column
    for (const col of byCol.keys()) {
      const colNodes = nodes.filter((n) => n.col === col).sort((a, b) => a.y - b.y);
      let curY = 0;
      for (const n of colNodes) {
        if (n.y < curY) n.y = curY;
        curY = n.y + n.height + NODE_PADDING;
      }
    }
  }

  // Pre-compute source/target link offsets
  for (const node of nodes) {
    node.sourceY = node.y;
    node.targetY = node.y;
  }

  for (const node of nodes) {
    for (const succOID of node.story.SuccessorOIDs) {
      const target = oidToNode.get(succOID);
      if (!target) continue;
      const thickness = Math.max(2, nodeHeight(target.story) / 3);
      node.sourceY += thickness;
      target.targetY += thickness;
    }
  }

  return nodes;
}

function buildLinks(nodes: SankeyNode[]): SankeyLink[] {
  const oidToNode = new Map<number, SankeyNode>(nodes.map((n) => [n.story.ObjectID, n]));
  const links: SankeyLink[] = [];

  // Reset running offsets
  for (const node of nodes) {
    node.sourceY = node.y;
    node.targetY = node.y;
  }

  for (const source of nodes) {
    for (const succOID of source.story.SuccessorOIDs) {
      const target = oidToNode.get(succOID);
      if (!target) continue;

      const value = nodeHeight(target.story);
      const thickness = Math.max(2, value / 3);

      links.push({
        source,
        target,
        blocked: target.story.Blocked,
        value,
        thickness,
        sy: source.sourceY + thickness / 2,
        ty: target.targetY + thickness / 2,
      });

      source.sourceY += thickness;
      target.targetY += thickness;
    }
  }

  return links;
}

/** SVG cubic bezier path for a Sankey link */
function linkPath(link: SankeyLink, nodeWidth: number): string {
  const x0 = link.source.x + nodeWidth;
  const x1 = link.target.x;
  const y0 = link.sy;
  const y1 = link.ty;
  const midX = (x0 + x1) / 2;
  return `M${x0},${y0} C${midX},${y0} ${midX},${y1} ${x1},${y1}`;
}

// ── Main component ────────────────────────────────────────────────────

export interface SankeyChartProps {
  stories: DependencyStory[];
  /** Base Rally URL — used to build story detail links */
  rallyBaseUrl?: string;
  width?: number;
  height?: number;
}

export function SankeyChart({ stories, rallyBaseUrl, width = 900, height = 500 }: SankeyChartProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; story: DependencyStory } | null>(null);

  const { nodes, links } = useMemo(() => {
    const ns = layoutNodes(stories, width - 40, height - 40);
    const ls = buildLinks(ns);
    return { nodes: ns, links: ls };
  }, [stories, width, height]);

  if (stories.length === 0) {
    return (
      <div
        role="status"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--ca-text-secondary)',
          fontSize: 'var(--ca-font-size-sm)',
        }}
      >
        No stories with dependency relationships found.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <svg
          role="img"
          aria-label="Sankey dependency diagram"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ display: 'block', margin: '0 auto' }}
        >
          {/* Links */}
          <g aria-hidden="true">
            {links.map((link, i) => (
              <path
                key={i}
                d={linkPath(link, NODE_WIDTH)}
                fill="none"
                stroke={link.blocked ? 'var(--ca-status-red)' : link.source.color}
                strokeWidth={link.thickness}
                strokeOpacity={LINK_OPACITY}
              />
            ))}
          </g>

          {/* Nodes */}
          <g>
            {nodes.map((node) => {
              const label = `${node.story.FormattedID} — ${node.story.Name}${node.story.PlanEstimate != null ? ` (${node.story.PlanEstimate} SP)` : ''}`;
              const blockedLabel = node.story.Blocked ? ` ⚠ BLOCKED${node.story.BlockedReason ? ': ' + node.story.BlockedReason : ''}` : '';
              return (
                <g
                  key={node.story.ObjectID}
                  transform={`translate(${node.x},${node.y})`}
                  role="button"
                  aria-label={label + blockedLabel + (rallyBaseUrl ? ' — double-click to open in Rally' : '')}
                  tabIndex={0}
                  style={{ cursor: rallyBaseUrl ? 'pointer' : 'default' }}
                  onDoubleClick={() => {
                    if (!rallyBaseUrl) return;
                    window.open(
                      `${rallyBaseUrl}/#/detail/userstory/${node.story.ObjectID}`,
                      '_blank',
                      'noopener,noreferrer',
                    );
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && rallyBaseUrl) {
                      window.open(
                        `${rallyBaseUrl}/#/detail/userstory/${node.story.ObjectID}`,
                        '_blank',
                        'noopener,noreferrer',
                      );
                    }
                  }}
                  onMouseEnter={() => {
                    setTooltip({ x: node.x + NODE_WIDTH + 4, y: node.y, story: node.story });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Node rect */}
                  <rect
                    width={NODE_WIDTH}
                    height={node.height}
                    fill={node.color}
                    rx={2}
                    ry={2}
                  />
                  {/* Blocked indicator stripe */}
                  {node.story.Blocked && (
                    <rect
                      width={NODE_WIDTH}
                      height={4}
                      fill="var(--ca-status-red)"
                      rx={2}
                      ry={2}
                    />
                  )}
                  {/* Node label — positioned right of the node rect */}
                  <text
                    x={NODE_WIDTH + 4}
                    y={node.height / 2}
                    dominantBaseline="middle"
                    fontSize="11"
                    fill="var(--ca-text-primary)"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {node.story.FormattedID}
                    {node.story.Blocked && (
                      <tspan fill="var(--ca-status-red)"> ⚠</tspan>
                    )}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            role="tooltip"
            style={{
              position: 'absolute',
              left: tooltip.x + NODE_WIDTH + 8,
              top: tooltip.y,
              backgroundColor: 'var(--ca-surface-raised)',
              border: '1px solid var(--ca-border-default)',
              borderRadius: 'var(--ca-radius-sm)',
              padding: '6px 10px',
              fontSize: 'var(--ca-font-size-xs)',
              color: 'var(--ca-text-primary)',
              pointerEvents: 'none',
              maxWidth: 280,
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              zIndex: 10,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {tooltip.story.FormattedID} — {tooltip.story.Name}
            </div>
            <div style={{ color: 'var(--ca-text-secondary)' }}>
              {tooltip.story.ScheduleState}
              {tooltip.story.PlanEstimate != null && ` · ${tooltip.story.PlanEstimate} SP`}
            </div>
            {tooltip.story.Blocked && (
              <div style={{ color: 'var(--ca-status-red)', marginTop: 4 }}>
                ⚠ Blocked{tooltip.story.BlockedReason ? `: ${tooltip.story.BlockedReason}` : ''}
              </div>
            )}
            {rallyBaseUrl && (
              <div style={{ color: 'var(--ca-text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
                Double-click to open in Rally
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend — inlined (was a separate Legend sub-component) */}
      <div
        role="list"
        aria-label="Schedule state legend"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '6px 12px',
          fontSize: 'var(--ca-font-size-xs)',
          color: 'var(--ca-text-secondary)',
          borderTop: '1px solid var(--ca-border-default)',
        }}
      >
        {(
          [
            { color: SCHEDULE_STATE_COLORS['Accepted'],    label: 'Accepted',    symbol: '✓' },
            { color: SCHEDULE_STATE_COLORS['Completed'],   label: 'Completed',   symbol: '◉' },
            { color: SCHEDULE_STATE_COLORS['In-Progress'], label: 'In-Progress', symbol: '►' },
            { color: SCHEDULE_STATE_COLORS['Defined'],     label: 'Defined',     symbol: '○' },
            { color: SCHEDULE_STATE_COLORS['Backlog'],     label: 'Backlog',     symbol: '·' },
          ] as { color: string; label: string; symbol: string }[]
        ).map((item) => (
          <span key={item.label} role="listitem" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: item.color,
                flexShrink: 0,
              }}
            />
            <span>{item.symbol} {item.label}</span>
          </span>
        ))}
        <span role="listitem" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 20,
              height: 3,
              backgroundColor: 'var(--ca-status-red)',
              flexShrink: 0,
            }}
          />
          <span>⚠ Blocked link</span>
        </span>
      </div>
    </div>
  );
}
