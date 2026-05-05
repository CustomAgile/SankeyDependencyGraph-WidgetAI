/**
 * Copyright (c) 2026 Custom Agile LLC. All rights reserved.
 */

import React, { useState, useMemo, useEffect } from 'react';
import '@customagile/widget-ai/styles/rally-app-tokens.css';

import type { RallyContext } from '@customagile/widget-ai/types/rally-context';
import { AppHeader } from '@customagile/widget-ai/components/AppHeader';
import { EditModePanel, SettingRow } from '@customagile/widget-ai/components/EditModePanel';
import { useWidgetSettings, defineWidgetSettings } from '@customagile/widget-ai/components/settings';

import type { SankeyDataProvider, SankeySettings, DependencyStory } from './types';
import { SankeyChart } from './components/SankeyChart';

// ── Settings defaults ──────────────────────────────────────────────────

const SETTINGS_DEFAULTS = defineWidgetSettings<SankeySettings>({
  query: '',
  showIsolated: false,
});

// ── App component ──────────────────────────────────────────────────────

interface AppProps {
  rallyContext: RallyContext;
  data: SankeyDataProvider;
}

export default function App({ rallyContext, data }: AppProps) {
  // ── Settings ─────────────────────────────────────────────────────────
  const { settings, updateSetting, updateSettings } = useWidgetSettings<SankeySettings>(
    rallyContext,
    SETTINGS_DEFAULTS,
  );

  // ── Data state ────────────────────────────────────────────────────────
  const [stories, setStories] = useState<DependencyStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rallyContext.isEditMode) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    data.fetchStories(settings.query || null).then(
      (results) => { if (!cancelled) { setStories(results); setLoading(false); } },
      (err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load stories');
          setLoading(false);
        }
      },
    );
    return () => { cancelled = true; };
  }, [data, settings.query, rallyContext.isEditMode]);

  // ── Filter isolated nodes ─────────────────────────────────────────────
  // Convert settings.showIsolated from boolean or string (Rally stores as string)
  const showIsolated =
    typeof settings.showIsolated === 'boolean'
      ? settings.showIsolated
      : settings.showIsolated === 'true';

  const visibleStories = useMemo(() => {
    if (showIsolated) return stories;
    const oidSet = new Set(stories.map((s) => s.ObjectID));
    return stories.filter(
      (s) =>
        s.PredecessorOIDs.some((p) => oidSet.has(p)) ||
        s.SuccessorOIDs.some((p) => oidSet.has(p)),
    );
  }, [stories, showIsolated]);

  // ── EditMode ──────────────────────────────────────────────────────────
  if (rallyContext.isEditMode) {
    return (
      <EditModePanel
        appName="Sankey Dependency Graph"
        version="0.1.0"
        appSlug="sankey-dependency-graph"
        settings={settings as unknown as Record<string, unknown>}
        onSave={(dirty: Partial<SankeySettings>) => updateSettings(dirty)}
        onClose={() => { /* Rally controls EditMode exit */ }}
      >
        <SettingRow label="Additional Filter" settingKey="query">
          <input
            type="text"
            value={settings.query ?? ''}
            onChange={(e) => updateSetting('query', e.target.value)}
            placeholder='e.g. (Iteration.Name = "Sprint 42")'
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '4px 8px',
              fontSize: 'var(--ca-font-size-sm)',
              color: 'var(--ca-text-primary)',
              backgroundColor: 'var(--ca-surface-raised)',
              border: '1px solid var(--ca-border-default)',
              borderRadius: 'var(--ca-radius-xs)',
            }}
          />
        </SettingRow>

        <SettingRow label="Show isolated stories (no dependencies)" settingKey="showIsolated">
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 'var(--ca-font-size-sm)',
              color: 'var(--ca-text-primary)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showIsolated}
              onChange={(e) => updateSetting('showIsolated', e.target.checked)}
            />
            Include stories with no predecessor/successor links
          </label>
        </SettingRow>
      </EditModePanel>
    );
  }

  // ── Normal view ───────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'var(--ca-font-family)',
        backgroundColor: 'var(--ca-surface-page)',
        color: 'var(--ca-text-primary)',
        overflow: 'hidden',
      }}
    >
      <AppHeader
        title="Sankey Dependency Graph"
        help={{
          content: (
            <>
              <p>
                Visualizes predecessor and successor dependency relationships between User Stories
                as a Sankey flow diagram. Nodes represent stories; links show dependencies.
              </p>
              <p>
                Story nodes are colored by <strong>ScheduleState</strong>. Stories with a custom
                Display Color in Rally use that color instead. Blocked stories show a red stripe
                at the top of their node; blocked dependency links are drawn in red.
              </p>
              <p>
                <strong>Double-click</strong> any node to open the story detail page in Rally.
                Hover a node for a tooltip with full name, state, estimate, and blocked reason.
              </p>
              <p>
                Use Edit Mode to add a custom WSAPI query filter, or to show stories with no
                dependency links (isolated nodes).
              </p>
            </>
          ),
        }}
      />

      {error && (
        <div
          role="alert"
          style={{
            margin: 'var(--ca-space-2)',
            padding: 'var(--ca-space-2)',
            backgroundColor: 'var(--ca-status-red-bg)',
            color: 'var(--ca-status-red)',
            borderRadius: 'var(--ca-radius-sm)',
            fontSize: 'var(--ca-font-size-sm)',
          }}
        >
          ⚠ Error loading stories: {error}
        </div>
      )}

      {loading && (
        <div
          aria-live="polite"
          aria-busy="true"
          style={{
            padding: 'var(--ca-space-4)',
            textAlign: 'center',
            color: 'var(--ca-text-secondary)',
            fontSize: 'var(--ca-font-size-sm)',
          }}
        >
          Loading…
        </div>
      )}

      {!loading && (
        <div style={{ flex: 1, overflow: 'hidden', padding: 'var(--ca-space-2)' }}>
          <SankeyChart
            stories={visibleStories}
            rallyBaseUrl={rallyContext.Url?.origin}
          />
        </div>
      )}
    </div>
  );
}
