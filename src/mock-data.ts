/**
 * Copyright (c) 2026 Custom Agile LLC. All rights reserved.
 */

import { DEFAULT_RALLY_CONTEXT } from '@customagile/widget-ai/types/rally-context';
import type { RallyContext } from '@customagile/widget-ai/types/rally-context';
import type { SankeyDataProvider, DependencyStory } from './types';

/**
 * Mock scenario: "Platform Modernisation" sprint.
 *
 * Dependency chain modelled here:
 *
 *   US1001 (Auth Service) ──► US1003 (API Gateway)  ──► US1005 (Mobile App)
 *                                                     └──► US1006 (Analytics)
 *   US1002 (DB Schema)   ──► US1003 (API Gateway)
 *   US1002 (DB Schema)   ──► US1004 (Report Engine) ──► US1006 (Analytics)
 *   US1007 (CI Pipeline) — no deps (isolated node to test showIsolated toggle)
 *
 * Blocked story: US1004 is blocked (missing data model sign-off).
 */

function makeStory(
  oid: number,
  fid: string,
  name: string,
  estimate: number | null,
  state: DependencyStory['ScheduleState'],
  blocked: boolean,
  blockedReason: string | null,
  color: string | null,
  predecessorOIDs: number[],
  successorOIDs: number[],
): DependencyStory {
  return {
    ObjectID: oid,
    FormattedID: fid,
    Name: name,
    PlanEstimate: estimate,
    ScheduleState: state,
    Blocked: blocked,
    BlockedReason: blockedReason,
    DisplayColor: color,
    PredecessorOIDs: predecessorOIDs,
    SuccessorOIDs: successorOIDs,
  };
}

export const MOCK_STORIES: DependencyStory[] = [
  makeStory(1001, 'US1001', 'Auth Service — OAuth2 provider setup',     5,    'Accepted',    false, null,                                     '#4a90d9', [],           [1003]),
  makeStory(1002, 'US1002', 'DB Schema — user & permissions tables',    8,    'Completed',   false, null,                                     '#7ed321', [],           [1003, 1004]),
  makeStory(1003, 'US1003', 'API Gateway — route configuration',        13,   'In-Progress', false, null,                                     '#f5a623', [1001, 1002], [1005, 1006]),
  makeStory(1004, 'US1004', 'Report Engine — aggregate queries',        8,    'Defined',     true,  'Awaiting data model sign-off from arch', '#d0021b', [1002],       [1006]),
  makeStory(1005, 'US1005', 'Mobile App — deep-link authentication',    5,    'Defined',     false, null,                                     null,      [1003],       []),
  makeStory(1006, 'US1006', 'Analytics Dashboard — dependency view',    3,    'Backlog',     false, null,                                     null,      [1003, 1004], []),
  makeStory(1007, 'US1007', 'CI/CD Pipeline — blue/green deployment',   5,    'In-Progress', false, null,                                     '#9b59b6', [],           []),
  makeStory(1008, 'US1008', 'Notification Service — email templates',   3,    'Defined',     false, null,                                     null,      [1003],       [1009]),
  makeStory(1009, 'US1009', 'User Onboarding — welcome email flow',     2,    'Backlog',     false, null,                                     null,      [1008],       []),
];

// ── Mock provider ──────────────────────────────────────────────────────

export const mockProvider: SankeyDataProvider = {
  fetchStories: async () => MOCK_STORIES,
};

// ── Mock context ───────────────────────────────────────────────────────

export const mockContext: RallyContext = {
  ...DEFAULT_RALLY_CONTEXT,
  User: {
    _ref: '/user/999',
    DisplayName: 'Mock User',
    EmailAddress: 'mock@example.com',
    UserName: 'mockuser',
    ObjectID: 999,
  },
  WidgetName: 'Sankey Dependency Graph',
  WidgetUUID: 'mock-sankey-dep-graph-uuid',
  isEditMode: false,
  Settings: {
    query: '',
    showIsolated: 'false',
  },
};
