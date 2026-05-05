/**
 * Copyright (c) 2026 Custom Agile LLC. All rights reserved.
 */

import type { WidgetSettings } from '@customagile/widget-ai/components/settings';

// ── Story data shape ───────────────────────────────────────────────────

/**
 * A single User Story node in the dependency graph.
 * Fields match the legacy Rally app's WSAPI fetch set.
 */
export interface DependencyStory {
  ObjectID: number;
  FormattedID: string;
  Name: string;
  /** Story points estimate — displayed on the node label */
  PlanEstimate: number | null;
  /** ScheduleState: Defined | In-Progress | Completed | Accepted */
  ScheduleState: string;
  /** Whether this story is currently blocked */
  Blocked: boolean;
  /** Reason the story is blocked (if Blocked is true) */
  BlockedReason: string | null;
  /** Display color set on the story (Rally hex string or null) */
  DisplayColor: string | null;
  /** ObjectIDs of predecessor stories (stories this depends on) */
  PredecessorOIDs: number[];
  /** ObjectIDs of successor stories (stories that depend on this) */
  SuccessorOIDs: number[];
}

// ── App settings ───────────────────────────────────────────────────────

export interface SankeySettings extends WidgetSettings {
  /**
   * Optional WSAPI query string to filter stories shown in the graph,
   * e.g. '(Iteration.Name = "Sprint 42")'
   */
  query: string;
  /**
   * Whether to show stories with no dependencies (isolated nodes).
   * Default: false — only show stories that have at least one link.
   */
  showIsolated: boolean;
}

// ── DataProvider interface ─────────────────────────────────────────────

export interface SankeyDataProvider {
  /**
   * Fetch User Stories with their dependency relationships.
   *
   * @param extraQuery  Optional additional WSAPI filter (may be empty string).
   * @returns           All stories in scope, with predecessor/successor OIDs resolved.
   */
  fetchStories(extraQuery: string | null): Promise<DependencyStory[]>;
}
