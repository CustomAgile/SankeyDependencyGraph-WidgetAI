/**
 * Copyright (c) 2026 Custom Agile LLC. All rights reserved.
 */

import type { RallyContext } from '@customagile/widget-ai/types/rally-context';
import { wsapiQueryAll } from '@customagile/widget-ai/data/wsapi';
import type { SankeyDataProvider, DependencyStory } from './types';

/**
 * Fields to fetch from WSAPI.
 * Predecessors and Successors are Rally collection refs — we request their
 * ObjectID and FormattedID via the dotted-field syntax so the API returns
 * them inline without a second round-trip.
 */
const FETCH_FIELDS =
  'ObjectID,FormattedID,Name,PlanEstimate,ScheduleState,Blocked,BlockedReason,DisplayColor,Predecessors,Successors';

/** Shape returned by WSAPI for a collection ref item */
interface RefItem {
  ObjectID?: number;
  _ref?: string;
  [key: string]: unknown;
}

/** Shape of the Predecessors/Successors collection as returned by WSAPI */
interface CollectionField {
  Count?: number;
  _tagsNameArray?: RefItem[];
  Results?: RefItem[];
  [key: string]: unknown;
}

function extractOIDs(field: unknown): number[] {
  if (!field || typeof field !== 'object') return [];
  const col = field as CollectionField;
  // Results array is present when fetch includes the collection
  const items = col.Results ?? col._tagsNameArray ?? [];
  return items
    .map((item) => {
      if (typeof item.ObjectID === 'number') return item.ObjectID;
      // Fall back to parsing the OID from the _ref string
      if (typeof item._ref === 'string') {
        const match = item._ref.match(/\/(\d+)$/);
        if (match) return parseInt(match[1], 10);
      }
      return null;
    })
    .filter((oid): oid is number => oid !== null);
}

function mapStory(r: Record<string, unknown>): DependencyStory {
  return {
    ObjectID: r.ObjectID as number,
    FormattedID: r.FormattedID as string,
    Name: (r.Name as string) ?? '',
    PlanEstimate: (r.PlanEstimate as number | null) ?? null,
    ScheduleState: (r.ScheduleState as string) ?? 'Defined',
    Blocked: (r.Blocked as boolean) ?? false,
    BlockedReason: (r.BlockedReason as string | null) ?? null,
    DisplayColor: (r.DisplayColor as string | null) ?? null,
    PredecessorOIDs: extractOIDs(r.Predecessors),
    SuccessorOIDs: extractOIDs(r.Successors),
  };
}

export function createRallyProvider(ctx: RallyContext): SankeyDataProvider {
  return {
    async fetchStories(extraQuery) {
      const workspaceRef =
        typeof ctx.GlobalScope.Workspace === 'string'
          ? ctx.GlobalScope.Workspace
          : ctx.GlobalScope.Workspace._ref;

      const projectRef =
        typeof ctx.GlobalScope.Project === 'string'
          ? ctx.GlobalScope.Project
          : ctx.GlobalScope.Project._ref;

      const results = await wsapiQueryAll('hierarchicalrequirement', {
        fetch: FETCH_FIELDS,
        query: extraQuery ?? '',
        workspace: workspaceRef || undefined,
        project: projectRef || undefined,
        projectScopeDown: ctx.GlobalScope.ProjectScopeDown,
        order: 'FormattedID ASC',
        pagesize: 2000,
      });

      return (results as Record<string, unknown>[]).map(mapStory);
    },
  };
}
