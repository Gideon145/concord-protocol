'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ──────────────────────────────────────────

const STATES = [
  'PROPOSED', 'NEGOTIATING', 'VALIDATING', 'ACTIVE', 'DEGRADING',
  'RENEGOTIATING', 'BREACHED', 'CURING', 'ARBITRATING', 'RESOLVING',
  'SETTLING', 'SETTLED', 'TERMINATED'
] as const;

const STATE_PHASES: Record<string, number[]> = {
  'Formation': [0, 1, 2],
  'Active Operations': [3, 4, 5],
  'Breach Response': [6, 7, 8],
  'Resolution': [9, 10, 11, 12],
};

interface Treaty {
  treatyId: string;
  state: number;
  health: number;
  status: string;
  activatedAt: number;
  degradationCount: number;
  renegotiationCount: number;
  breachCount: number;
}

interface TreatyDetail {
  treatyId: string;
  state: number;
  stateName: string;
  health: number;
  status: string;
  terms: {
    amount: string;
    interestRate: number;
    duration: number;
    collateralRatio: number;
    liquidationThreshold: number;
  };
  partyA: string;
  partyB: string;
  activatedAt: number;
  escrowBalance: string;
  degradationCount: number;
  renegotiationCount: number;
  breachCount: number;
}

interface MonitorCycle {
  cycleCount: number;
  lastCycleTime: number;
  results: MonitorResult[];
}

interface MonitorResult {
  treatyId: string;
  timestamp: number;
  newState: number;
  breachTier: number;
  reason: string;
  blake3Hash: string;
  details: {
    cviStatusA: boolean;
    cviStatusB: boolean;
    cvaClean: boolean;
    collateralRatio: number;
    paymentCurrent: boolean;
    collateralApproaching: boolean;
    yieldOnTarget: boolean;
    counterpartyHealthy: boolean;
    oracleStable: boolean;
    liquidityAdequate: boolean;
    milestonesOnTrack: boolean;
  };
}

interface AgentStatus {
  status: string;
  startTime: number;
  cycleCount: number;
  lastCycleTime: number;
  activeTreaties: number;
  treatiesMonitored: number;
  alertsTriggered: number;
  renegotiationsInitiated: number;
  breachesDetected: number;
  uptime: number;
  lastError: string | null;
  config: {
    chainId: number;
    treatyContract: string;
    monitorIntervalMs: number;
  };
}

// ─── Helpers ────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:3001';

function stateColor(state: number): string {
  if (state <= 2) return 'var(--text-tertiary)';
  if (state === 3) return 'var(--color-success)';
  if (state === 4 || state === 5) return 'var(--color-warning)';
  if (state >= 6 && state <= 8) return 'var(--color-danger)';
  if (state >= 9 && state <= 10) return 'var(--color-info)';
  if (state === 11) return 'var(--color-success)';
  return 'var(--text-muted)';
}

function stateNodeClass(state: number, currentState: number): string {
  if (state === currentState) {
    if (currentState >= 6 && currentState <= 8) return 'state-node state-node--danger';
    if (currentState === 4 || currentState === 5) return 'state-node state-node--warning';
    if (currentState === 11) return 'state-node state-node--success';
    return 'state-node state-node--current';
  }
  if (state < currentState) return 'state-node state-node--past';
  return 'state-node';
}

function healthColor(health: number): string {
  if (health >= 80) return 'var(--color-success)';
  if (health >= 50) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr || '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function timeAgo(ts: number): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function formatWei(val: string): string {
  if (!val || val === '0') return '0';
  const n = BigInt(val);
  const eth = Number(n) / 1e18;
  if (eth >= 1) return eth.toFixed(2);
  if (eth >= 0.01) return eth.toFixed(4);
  return eth.toExponential(2);
}

// ─── Main Page ──────────────────────────────────────

const DEMO_STEPS = [
  { time: '0:00', title: 'Two Agents Appear', highlight: 'agents', text: 'Agent Alpha (Treasury Manager, CVI Tier 3) and Agent Beta (Yield Protocol, CVI Tier 2) meet on-chain.' },
  { time: '0:20', title: 'Identity Handshake', highlight: 'cvi', text: 'Both agents query CVI. Green checkmarks: Tier 3 Verified / Tier 2 Verified. Cleanverse identity confirmed.' },
  { time: '0:45', title: 'Negotiation', highlight: 'terms', text: 'Structured terms: $50K USDC, 8.0% APY, 7-day, 150% collateral. Constitutional checks pass.' },
  { time: '1:15', title: 'Treaty Activation', highlight: 'escrow', text: 'CCP clears. CVA escrow locks $50K in verified USDC. Treaty state: ACTIVE. Monitor loop starts.' },
  { time: '1:45', title: 'Live Monitoring', highlight: 'conditions', text: 'Dashboard: 10-condition grid. All green. Health score: 90%. 15-second attestation cycle running.' },
  { time: '2:05', title: 'Degradation', highlight: 'state-machine', text: 'Collateral drops to 118%. Condition turns yellow. State → DEGRADING.' },
  { time: '2:20', title: 'Autonomous Renegotiation', highlight: 'mediator', text: 'Alpha proposes new terms. Mediator Swarm evaluates: 84/100 Fair. Beta accepts. Treaty amended on-chain.' },
  { time: '2:45', title: 'Hard Breach', highlight: 'breach', text: 'Beta CVI revoked. Immediate BREACHED (Tier 3). Mediator Swarm resolves: escrow → Alpha. Settlement executed.' },
  { time: '3:00', title: 'Closing', highlight: 'all', text: 'CONCORD. Six Cleanverse primitives. Nine chains. Autonomous economic relationships. This is how AI agents will do business.' },
];

export default function MissionControl() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [treaties, setTreaties] = useState<Treaty[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TreatyDetail | null>(null);
  const [monitorCycle, setMonitorCycle] = useState<MonitorCycle | null>(null);
  const [feedHistory, setFeedHistory] = useState<MonitorResult[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [tick, setTick] = useState(0);
  const [demoStep, setDemoStep] = useState(-1); // -1 = hidden, 0-8 = steps
  const [isPlaying, setIsPlaying] = useState(false);
  const feedRef = useRef<MonitorResult[]>([]);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Demo Playback ──
  const startPlayback = useCallback(() => {
    setIsPlaying(true);
    setDemoStep(0);
    let step = 0;
    playRef.current = setInterval(() => {
      step++;
      if (step >= DEMO_STEPS.length) {
        setIsPlaying(false);
        if (playRef.current) clearInterval(playRef.current);
      } else {
        setDemoStep(step);
      }
    }, 20000); // 20s per step (matches demo timing)
  }, []);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (playRef.current) { clearInterval(playRef.current); playRef.current = null; }
  }, []);

  const nextStep = useCallback(() => {
    stopPlayback();
    setDemoStep((s) => Math.min(s + 1, DEMO_STEPS.length - 1));
  }, [stopPlayback]);

  const prevStep = useCallback(() => {
    stopPlayback();
    setDemoStep((s) => Math.max(s - 1, 0));
  }, [stopPlayback]);

  const startDemo = useCallback(() => {
    setDemoStep(0);
    if (treaties.length > 0) setSelectedId(treaties[0].treatyId);
  }, [treaties]);

  // ── Highlight target ──
  const demoHighlight = demoStep >= 0 ? DEMO_STEPS[demoStep].highlight : null;

  // ── Polling ──

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, treatiesRes, cycleRes] = await Promise.allSettled([
        fetch(`${API}/status`),
        fetch(`${API}/treaties`),
        fetch(`${API}/monitor/cycle`),
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        const data = await statusRes.value.json();
        setAgentStatus(data);
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }

      if (treatiesRes.status === 'fulfilled' && treatiesRes.value.ok) {
        const data = await treatiesRes.value.json();
        setTreaties(data.treaties || []);
      }

      if (cycleRes.status === 'fulfilled' && cycleRes.value.ok) {
        const data: MonitorCycle = await cycleRes.value.json();
        setMonitorCycle(data);

        // Append new results to feed history
        if (data.results && data.results.length > 0) {
          const existing = feedRef.current;
          const newItems = data.results.filter(
            (r) => !existing.some((e) => e.blake3Hash === r.blake3Hash)
          );
          if (newItems.length > 0) {
            const updated = [...newItems, ...existing].slice(0, 100);
            feedRef.current = updated;
            setFeedHistory(updated);
          }
        }
      }
    } catch {
      setIsOnline(false);
    }
  }, []);

  // Fetch treaty detail when selected
  const fetchDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API}/treaties/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => {
      fetchAll();
      setTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
  }, [selectedId, tick, fetchDetail]);

  // Auto-select first treaty
  useEffect(() => {
    if (!selectedId && treaties.length > 0) {
      setSelectedId(treaties[0].treatyId);
    }
  }, [treaties, selectedId]);

  // ── Derived data ──
  const currentState = detail?.state ?? -1;
  const monitorResultForSelected = monitorCycle?.results?.find(
    (r) => r.treatyId === selectedId
  );

  return (
    <div className="mission-control">
      {/* ── Top Bar ── */}
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-logo">CONCORD</span>
          <div className="topbar-divider" />
          <span className="topbar-subtitle">Mission Control</span>
        </div>
        <div className="topbar-right">
          {agentStatus && (
            <>
              <div className="topbar-stat">
                <span className="topbar-stat-label">Uptime</span>
                <span className="topbar-stat-value">{formatUptime(agentStatus.uptime)}</span>
              </div>
              <div className="topbar-stat">
                <span className="topbar-stat-label">Cycles</span>
                <span className="topbar-stat-value">{agentStatus.cycleCount.toLocaleString()}</span>
              </div>
              <div className="topbar-stat">
                <span className="topbar-stat-label">Chain</span>
                <span className="topbar-stat-value">{agentStatus.config.chainId}</span>
              </div>
            </>
          )}
          <div className={`status-beacon status-beacon--${isOnline ? (agentStatus?.status || 'running') : 'offline'}`}>
            <span className={`beacon-dot ${isOnline && agentStatus?.status === 'running' ? 'beacon-dot--pulse' : ''}`} />
            {isOnline ? (agentStatus?.status || 'Online').toUpperCase() : 'OFFLINE'}
          </div>
          <button
            className={`demo-toggle ${demoStep >= 0 ? 'demo-toggle--active' : ''}`}
            onClick={() => demoStep >= 0 ? setDemoStep(-1) : startDemo()}
          >
            {demoStep >= 0 ? '✕ Exit Demo' : '▶ Demo Guide'}
          </button>
        </div>
      </div>

      {/* ── Offline Banner ── */}
      {!isOnline && (
        <div className="offline-banner">
          ⚠ Agent not reachable at {API} — ensure the backend is running on port 3001
        </div>
      )}

      {/* ── Left Panel: Treaty List ── */}
      <div className="panel-left">
        <div className="panel-header">
          <span className="panel-title">
            Treaties<span className="panel-count">{treaties.length}</span>
          </span>
        </div>
        <div className="treaty-list">
          {treaties.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">◇</div>
              <div className="empty-state-title">No active treaties</div>
              <div className="empty-state-desc">
                Treaties will appear here once the agent begins negotiating.
              </div>
            </div>
          )}
          {treaties.map((t) => (
            <div
              key={t.treatyId}
              className={`treaty-item ${selectedId === t.treatyId ? 'treaty-item--active' : ''}`}
              onClick={() => setSelectedId(t.treatyId)}
            >
              <div
                className="treaty-item-indicator"
                style={{ background: stateColor(t.state) }}
              />
              <div className="treaty-item-content">
                <div className="treaty-item-id">{t.treatyId}</div>
                <div className="treaty-item-meta">
                  <span
                    className="treaty-item-state"
                    style={{
                      color: stateColor(t.state),
                      background: `color-mix(in srgb, ${stateColor(t.state)} 12%, transparent)`,
                    }}
                  >
                    {STATES[t.state]}
                  </span>
                  <span className="treaty-item-health">{t.health}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Center Panel: Mission Control ── */}
      <div className="panel-center">
        {!detail ? (
          <div className="welcome-state">
            <div className="welcome-icon">◈</div>
            <div className="welcome-title">Mission Control</div>
            <div className="welcome-desc">
              {isOnline
                ? 'Select a treaty from the sidebar to begin monitoring autonomous economic operations.'
                : 'Waiting for the CONCORD agent to come online. Start the backend with npm run dev in the agent directory.'}
            </div>
          </div>
        ) : (
          <>
            {/* Treaty Header */}
            <div className="treaty-detail-header">
              <div className="treaty-detail-id">{detail.treatyId}</div>
              <div className="treaty-detail-state">{detail.stateName}</div>
              <div className="treaty-detail-status">{detail.status}</div>
            </div>

            {/* Detail Grid */}
            <div className="detail-grid">
              <div className="detail-card">
                <div className="detail-card-label">Health Score</div>
                <div className="detail-card-value" style={{ color: healthColor(detail.health) }}>
                  {detail.health}<span className="detail-card-unit">%</span>
                </div>
              </div>
              <div className="detail-card">
                <div className="detail-card-label">CVA Escrow</div>
                <div className="detail-card-value detail-card-value--mono" style={{color:'var(--color-success)'}}>
                  ${Number(detail.terms.amount) / 1e6}K<span className="detail-card-unit">USDC</span>
                </div>
              </div>
              <div className="detail-card">
                <div className="detail-card-label">Interest Rate</div>
                <div className="detail-card-value detail-card-value--mono">
                  {(detail.terms.interestRate / 100).toFixed(2)}<span className="detail-card-unit">%</span>
                </div>
              </div>
              <div className="detail-card">
                <div className="detail-card-label">Collateral Ratio</div>
                <div className="detail-card-value detail-card-value--mono">
                  {detail.terms.collateralRatio.toFixed(0)}<span className="detail-card-unit">%</span>
                </div>
              </div>
            </div>

            {/* State Machine */}
            <div className="state-machine">
              <div className="state-machine-title">Treaty State Machine</div>
              <div className="state-machine-track">
                {Object.entries(STATE_PHASES).map(([phase, indices], pi) => (
                  <div key={phase}>
                    {pi > 0 && (
                      <div className="state-connector">↓</div>
                    )}
                    <div className="state-machine-phase">
                      <div className="state-machine-phase-label">{phase}</div>
                      <div className="state-machine-nodes">
                        {indices.map((idx) => (
                          <div key={idx} className={stateNodeClass(idx, currentState)}>
                            <span className="state-node-dot" />
                            <span className="state-node-label">{STATES[idx]}</span>
                            <span className="state-node-index">{idx}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Negotiation Panel */}
            <div className="negotiation">
              <div className="negotiation-title">Autonomous Negotiation</div>
              <div className="negotiation-agents">
                <div className="agent-panel">
                  <div className="agent-panel-header">
                    <div className="agent-avatar agent-avatar--alpha">α</div>
                    <div>
                      <div className="agent-name">Agent Alpha</div>
                      <div className="agent-address">{truncateAddress(detail.partyA)}</div>
                      <div className="cvi-badge cvi-badge--tier3">
                        <span className="cvi-badge-icon">✓</span>
                        CVI Tier 3 — Verified
                      </div>
                    </div>
                  </div>
                  <div className="agent-terms">
                    <div className="agent-term-row">
                      <span className="agent-term-label">Role</span>
                      <span className="agent-term-value">Treasury Manager</span>
                    </div>
                    <div className="agent-term-row">
                      <span className="agent-term-label">Treaty Value</span>
                      <span className="agent-term-value" style={{color:'var(--color-success)'}}>${Number(detail.terms.amount) / 1e6}K USDC</span>
                    </div>
                    <div className="agent-term-row">
                      <span className="agent-term-label">Rate</span>
                      <span className="agent-term-value">{(detail.terms.interestRate / 100).toFixed(2)}% APY</span>
                    </div>
                    <div className="agent-term-row">
                      <span className="agent-term-label">Duration</span>
                      <span className="agent-term-value">{Math.round(Number(detail.terms.duration) / 1440)} days</span>
                    </div>
                    <div className="agent-term-row">
                      <span className="agent-term-label">Collateral</span>
                      <span className="agent-term-value">{detail.terms.collateralRatio}%</span>
                    </div>
                    <div className="agent-term-row">
                      <span className="agent-term-label">Liquidation</span>
                      <span className="agent-term-value">{detail.terms.liquidationThreshold}%</span>
                    </div>
                  </div>
                </div>

                <div className="negotiation-connector">
                  <div className="negotiation-connector-icon">⇄</div>
                  <div className="negotiation-connector-label">TREATY</div>
                  <div className="escrow-status">
                    <span className="escrow-dot escrow-dot--locked" />
                    CVA Escrow Locked: ${Number(detail.terms.amount) / 1e6}K
                  </div>
                </div>

                <div className="agent-panel">
                  <div className="agent-panel-header">
                    <div className="agent-avatar agent-avatar--beta">β</div>
                    <div>
                      <div className="agent-name">Agent Beta</div>
                      <div className="agent-address">{truncateAddress(detail.partyB)}</div>
                      <div className="cvi-badge cvi-badge--tier2">
                        <span className="cvi-badge-icon">✓</span>
                        CVI Tier 2 — Verified
                      </div>
                    </div>
                  </div>
                  <div className="agent-terms">
                    <div className="agent-term-row">
                      <span className="agent-term-label">Role</span>
                      <span className="agent-term-value">Yield Protocol</span>
                    </div>
                    <div className="agent-term-row">
                      <span className="agent-term-label">Degradations</span>
                      <span className="agent-term-value">{detail.degradationCount}</span>
                    </div>
                    <div className="agent-term-row">
                      <span className="agent-term-label">Renegotiations</span>
                      <span className="agent-term-value">{detail.renegotiationCount}</span>
                    </div>
                    <div className="agent-term-row">
                      <span className="agent-term-label">Breaches</span>
                      <span className="agent-term-value" style={{ color: detail.breachCount > 0 ? 'var(--color-danger)' : undefined }}>
                        {detail.breachCount}
                      </span>
                    </div>
                    <div className="agent-term-row">
                      <span className="agent-term-label">Escrow</span>
                      <span className="agent-term-value" style={{color:'var(--color-success)'}}>${Number(detail.terms.amount) / 1e6}K USDC</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mediator Swarm Panel */}
            <div className="mediator-panel">
              <div className="mediator-title">Mediator Swarm Consensus</div>
              <div className="mediator-grid">
                <div className="mediator-card">
                  <div className="mediator-card-header">Mediator 1</div>
                  <div className="mediator-card-score" style={{color:'var(--color-success)'}}>FAIR</div>
                  <div className="mediator-card-value">82/100</div>
                </div>
                <div className="mediator-card">
                  <div className="mediator-card-header">Mediator 2</div>
                  <div className="mediator-card-score" style={{color:'var(--color-success)'}}>FAIR</div>
                  <div className="mediator-card-value">84/100</div>
                </div>
                <div className="mediator-card">
                  <div className="mediator-card-header">Mediator 3</div>
                  <div className="mediator-card-score" style={{color:'var(--color-success)'}}>FAIR</div>
                  <div className="mediator-card-value">86/100</div>
                </div>
              </div>
              <div className="mediator-consensus">
                <div className="consensus-badge consensus-badge--reached">
                  2/3 CONSENSUS REACHED
                </div>
                <div className="consensus-score">84/100 Fair — Proposed terms accepted</div>
              </div>
            </div>

            {/* Conditions Panel */}
            {monitorResultForSelected && (
              <div className="conditions-grid">
                <div className="conditions-title">Monitored Conditions</div>

                <div className="condition-group">
                  <div className="condition-group-label condition-group-label--hard">Hard Conditions — Breach Triggers</div>
                  {[
                    { name: 'CVI Status (Party A)', pass: monitorResultForSelected.details.cviStatusA },
                    { name: 'CVI Status (Party B)', pass: monitorResultForSelected.details.cviStatusB },
                    { name: 'CVA Asset Provenance', pass: monitorResultForSelected.details.cvaClean },
                    { name: 'Payment Current', pass: monitorResultForSelected.details.paymentCurrent },
                  ].map((c) => (
                    <div key={c.name} className="condition-row">
                      <div className={`condition-indicator ${c.pass ? 'condition-indicator--pass' : 'condition-indicator--fail'}`}>
                        {c.pass ? '✓' : '✗'}
                      </div>
                      <span className="condition-name">{c.name}</span>
                      <span className="condition-value">{c.pass ? 'PASS' : 'FAIL'}</span>
                    </div>
                  ))}
                  <div className="condition-row">
                    <div className={`condition-indicator ${monitorResultForSelected.details.collateralRatio >= (detail?.terms.liquidationThreshold || 120) ? 'condition-indicator--pass' : 'condition-indicator--fail'}`}>
                      {monitorResultForSelected.details.collateralRatio >= (detail?.terms.liquidationThreshold || 120) ? '✓' : '✗'}
                    </div>
                    <span className="condition-name">Collateral Ratio</span>
                    <span className="condition-value">{monitorResultForSelected.details.collateralRatio}%</span>
                  </div>
                </div>

                <div className="condition-group">
                  <div className="condition-group-label condition-group-label--soft">Soft Conditions — Degradation Triggers</div>
                  {[
                    { name: 'Collateral Buffer', pass: !monitorResultForSelected.details.collateralApproaching, value: monitorResultForSelected.details.collateralApproaching ? 'APPROACHING' : 'ADEQUATE' },
                    { name: 'Yield Target', pass: monitorResultForSelected.details.yieldOnTarget, value: monitorResultForSelected.details.yieldOnTarget ? 'ON TARGET' : 'BELOW' },
                    { name: 'Counterparty Health', pass: monitorResultForSelected.details.counterpartyHealthy, value: monitorResultForSelected.details.counterpartyHealthy ? 'HEALTHY' : 'DEGRADED' },
                    { name: 'Oracle Stability', pass: monitorResultForSelected.details.oracleStable, value: monitorResultForSelected.details.oracleStable ? 'STABLE' : 'DEVIATED' },
                    { name: 'Liquidity', pass: monitorResultForSelected.details.liquidityAdequate, value: monitorResultForSelected.details.liquidityAdequate ? 'ADEQUATE' : 'TIGHT' },
                    { name: 'Milestones', pass: monitorResultForSelected.details.milestonesOnTrack, value: monitorResultForSelected.details.milestonesOnTrack ? 'ON TRACK' : 'BEHIND' },
                  ].map((c) => (
                    <div key={c.name} className="condition-row">
                      <div className={`condition-indicator ${c.pass ? 'condition-indicator--pass' : 'condition-indicator--warn'}`}>
                        {c.pass ? '✓' : '!'}
                      </div>
                      <span className="condition-name">{c.name}</span>
                      <span className="condition-value">{c.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Right Panel: Monitoring & Activity ── */}
      <div className="panel-right">
        {/* Health Gauge */}
        {detail && (
          <div className="health-gauge">
            <div className="health-gauge-header">
              <span className="health-gauge-label">Treaty Health</span>
              <span className="health-gauge-value" style={{ color: healthColor(detail.health) }}>
                {detail.health}%
              </span>
            </div>
            <div className="health-gauge-bar">
              <div
                className="health-gauge-fill"
                style={{
                  width: `${detail.health}%`,
                  background: healthColor(detail.health),
                }}
              />
            </div>
          </div>
        )}

        {/* Agent Metrics */}
        {agentStatus && (
          <div className="activity-section">
            <div className="activity-section-title">Agent Metrics</div>
            <div className="activity-metric">
              <span className="activity-metric-label">Active Treaties</span>
              <span className="activity-metric-value">{agentStatus.activeTreaties}</span>
            </div>
            <div className="activity-metric">
              <span className="activity-metric-label">Monitored / Cycle</span>
              <span className="activity-metric-value">{agentStatus.treatiesMonitored}</span>
            </div>
            <div className="activity-metric">
              <span className="activity-metric-label">Alerts Triggered</span>
              <span className="activity-metric-value" style={{ color: agentStatus.alertsTriggered > 0 ? 'var(--color-warning)' : undefined }}>
                {agentStatus.alertsTriggered}
              </span>
            </div>
            <div className="activity-metric">
              <span className="activity-metric-label">Breaches Detected</span>
              <span className="activity-metric-value" style={{ color: agentStatus.breachesDetected > 0 ? 'var(--color-danger)' : undefined }}>
                {agentStatus.breachesDetected}
              </span>
            </div>
            <div className="activity-metric">
              <span className="activity-metric-label">Last Cycle</span>
              <span className="activity-metric-value">{timeAgo(agentStatus.lastCycleTime)}</span>
            </div>
            {agentStatus.lastError && (
              <div className="activity-metric">
                <span className="activity-metric-label" style={{ color: 'var(--color-danger)' }}>Last Error</span>
                <span className="activity-metric-value" style={{ color: 'var(--color-danger)', fontSize: '12px' }}>
                  {agentStatus.lastError.slice(0, 40)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Attestation Log */}
        {detail && (
          <div className="activity-section">
            <div className="activity-section-title">Attestation</div>
            <div className="activity-metric">
              <span className="activity-metric-label">Contract</span>
              <span className="activity-metric-value" style={{ fontSize: '12px' }}>
                {agentStatus ? truncateAddress(agentStatus.config.treatyContract) : '—'}
              </span>
            </div>
            <div className="activity-metric">
              <span className="activity-metric-label">Monitor Interval</span>
              <span className="activity-metric-value">
                {agentStatus ? `${agentStatus.config.monitorIntervalMs / 1000}s` : '—'}
              </span>
            </div>
            <div className="activity-metric">
              <span className="activity-metric-label">Activated</span>
              <span className="activity-metric-value">
                {detail.activatedAt > 0 ? timeAgo(detail.activatedAt * 1000) : '—'}
              </span>
            </div>
          </div>
        )}

        {/* Live Monitor Feed */}
        <div className="panel-header">
          <span className="panel-title">
            Live Feed<span className="panel-count">{feedHistory.length}</span>
          </span>
        </div>
        <div className="feed-list">
          {feedHistory.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">◎</div>
              <div className="empty-state-title">No events yet</div>
              <div className="empty-state-desc">
                Monitor events will stream here every cycle.
              </div>
            </div>
          )}
          {feedHistory.map((r, i) => {
            let type = 'nominal';
            let typeLabel = 'NOMINAL';
            if (r.breachTier > 0) { type = 'breach'; typeLabel = `BREACH T${r.breachTier}`; }
            else if (r.newState === 4) { type = 'degradation'; typeLabel = 'DEGRADING'; }
            else if (r.newState === 3) { type = 'attestation'; typeLabel = 'ATTESTATION'; }

            return (
              <div key={r.blake3Hash + i} className="feed-item">
                <div className="feed-item-header">
                  <span className={`feed-item-type feed-item-type--${type}`}>{typeLabel}</span>
                  <span className="feed-item-time">{timeAgo(r.timestamp)}</span>
                </div>
                <div className="feed-item-reason">{r.reason}</div>
                <div className="feed-item-hash">{r.blake3Hash?.slice(0, 18)}…</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Demo Guide Overlay ── */}
      {demoStep >= 0 && (
        <div className="demo-overlay">
          <div className="demo-guide">
            <div className="demo-guide-header">
              <div className="demo-guide-title">🎬 Demo Guide</div>
              <div className="demo-guide-controls">
                <button className="demo-btn demo-btn--small" onClick={prevStep} disabled={demoStep === 0}>◀</button>
                <span className="demo-step-indicator">{demoStep + 1} / {DEMO_STEPS.length}</span>
                <button className="demo-btn demo-btn--small" onClick={nextStep} disabled={demoStep === DEMO_STEPS.length - 1}>▶</button>
                {isPlaying ? (
                  <button className="demo-btn demo-btn--pause" onClick={stopPlayback}>⏸ Pause</button>
                ) : (
                  <button className="demo-btn demo-btn--play" onClick={startPlayback}>▶ Play All</button>
                )}
              </div>
            </div>
            <div className="demo-guide-steps">
              {DEMO_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`demo-step ${i === demoStep ? 'demo-step--active' : ''} ${i < demoStep ? 'demo-step--done' : ''}`}
                  onClick={() => { stopPlayback(); setDemoStep(i); }}
                >
                  <div className="demo-step-dot">
                    {i < demoStep ? '✓' : i === demoStep ? '●' : i + 1}
                  </div>
                  <div className="demo-step-content">
                    <div className="demo-step-time">{step.time}</div>
                    <div className="demo-step-title">{step.title}</div>
                    {i === demoStep && (
                      <div className="demo-step-text">{step.text}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Highlight targets */}
          <div className={`demo-highlight demo-highlight--${demoHighlight}`} />
        </div>
      )}
    </div>
  );
}
