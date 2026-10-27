import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bike, CalendarDays,
  Check, ChevronDown, CircleHelp, ClipboardList, Database, Send,
  Sparkles, Users, WandSparkles, Waves, X,
} from 'lucide-react';
import {
  useAskOperationsAgent, useExtractEventDetails, useGetBacktest,
  useGetOperationsOverview, useGetSensitivity, useGetStaffingPlan,
} from '@workspace/api-client-react';
import type { AgentChatResponse, ChatTurn } from '@workspace/api-client-react';

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-US').format(n);
const pct = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toFixed(1)}%`;
const sharePct = (n: number | null | undefined) =>
  n == null ? '—' : `${(Number(n) <= 1 ? Number(n) * 100 : Number(n)).toFixed(1)}%`;
const monthLabel = (month: number) =>
  new Date(2026, month - 1, 1).toLocaleString('en-US', { month: 'short' });

type ChatMessage = { role: 'user' | 'assistant'; content: string; response?: AgentChatResponse };

function LoadingPanel({ rows = 4 }: { rows?: number }) {
  return <div className="space-y-3 p-5" aria-label="Loading data">
    {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-4 animate-pulse rounded bg-[#e7e3d9]" style={{ width: `${88 - i * 9}%` }} />)}
  </div>;
}

function PanelError({ onRetry }: { onRetry: () => void }) {
  return <div className="flex min-h-36 flex-col items-center justify-center gap-2 p-5 text-center" data-testid="status-load-error">
    <AlertTriangle size={18} className="text-[#bf5b3e]" />
    <p className="text-sm text-[#66727a]">Couldn’t load this dataset.</p>
    <button onClick={onRetry} data-testid="button-retry" className="text-sm font-semibold text-[#14735c] underline underline-offset-4">Retry</button>
  </div>;
}

function Metric({ label, value, sub, accent = 'teal', icon: Icon }: {
  label: string; value: string; sub: string; accent?: 'teal' | 'orange' | 'blue'; icon: typeof Activity;
}) {
  return <article className="min-w-0 border-l-2 border-[#d8d2c5] pl-4 first:border-0 first:pl-0" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.11em] text-[#738087]">
      <Icon size={14} className={accent === 'orange' ? 'text-[#d76a43]' : accent === 'blue' ? 'text-[#4d8292]' : 'text-[#19745d]'} />
      {label}
    </div>
    <div className="display-font text-[27px] font-semibold leading-none tracking-[-.04em] text-[#20333d]">{value}</div>
    <div className="mt-2 text-xs text-[#788188]">{sub}</div>
  </article>;
}

function SectionHeading({ eyebrow, title, detail, right }: {
  eyebrow: string; title: string; detail: string; right?: ReactNode;
}) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div><p className="mono mb-1 text-[10px] uppercase tracking-[.15em] text-[#8b8d83]">{eyebrow}</p>
      <h2 className="display-font text-[21px] font-semibold tracking-[-.035em] text-[#243740]">{title}</h2>
      <p className="mt-1 text-sm text-[#768187]">{detail}</p></div>{right}
  </div>;
}

export default function Operations() {
  const [city, setCity] = useState('');
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [sourceText, setSourceText] = useState('');
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const overview = useGetOperationsOverview();
  const staffing = useGetStaffingPlan(city ? { city } : undefined);
  const backtest = useGetBacktest(city ? { city } : undefined);
  const sensitivity = useGetSensitivity(city ? { city } : undefined);
  const askAgent = useAskOperationsAgent();
  const extractEvents = useExtractEventDetails();

  const cities = useMemo(() => {
    const values = [...(staffing.data ?? []).map((row) => row.city), ...(backtest.data ?? []).map((row) => row.city)];
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }, [staffing.data, backtest.data]);
  useEffect(() => {
    if (!city && cities.length) setCityOptions(cities);
  }, [city, cities]);
  const staffingRows = staffing.data ?? [];
  const backtestRows = backtest.data ?? [];
  const sensitivityRows = sensitivity.data ?? [];
  const planForChart = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const rows = staffingRows.filter((row) => row.month === month);
      return {
        month,
        monthName: monthLabel(month),
        forecastTripStarts: rows.reduce((sum, row) => sum + row.forecastTripStarts, 0),
        totalCrewsNeeded: rows.reduce((sum, row) => sum + row.totalCrewsNeeded, 0),
        seasonalCrews: rows.reduce((sum, row) => sum + row.seasonalCrews, 0),
      };
    });
  }, [staffingRows]);
  const maxCrews = Math.max(1, ...planForChart.map((r) => r.totalCrewsNeeded));
  const chartTripStarts = planForChart.reduce((sum, row) => sum + row.forecastTripStarts, 0);

  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const submitQuestion = (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || askAgent.isPending) return;
    const previous = chat.slice(-10).map(({ role, content }) => ({ role, content })) as ChatTurn[];
    setChat((items) => [...items, { role: 'user', content: text }]);
    setQuestion('');
    askAgent.mutate({ data: { question: text, history: previous } }, {
      onSuccess: (response) => setChat((items) => [...items, { role: 'assistant', content: response.answer, response }]),
      onError: () => setChat((items) => [...items, { role: 'assistant', content: 'The assistant could not reach the planning data just now. Please try again.' }]),
    });
  };
  const submitEvent = (event: FormEvent) => {
    event.preventDefault();
    if (sourceText.trim().length < 10 || extractEvents.isPending) return;
    extractEvents.mutate({ data: { sourceText: sourceText.trim() } });
  };
  const quickAsk = (value: string) => {
    setQuestion(value);
    requestAnimationFrame(() => document.getElementById('assistant-input')?.focus());
  };

  const overviewData = overview.data;
  const navItems = [
    { id: 'staffing', label: 'Staffing plan', icon: ClipboardList },
    { id: 'backtest', label: 'Forecast backtest', icon: Activity },
    { id: 'sensitivity', label: 'Sensitivity', icon: Waves },
    { id: 'assistant', label: 'Operations assistant', icon: Sparkles },
    { id: 'event-parser', label: 'Event intake', icon: CalendarDays },
  ];

  return <div className="ops-shell flex">
    <aside className="ops-sidebar sticky top-0 hidden h-[100dvh] w-[244px] shrink-0 flex-col px-5 py-6 md:flex">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#17765e] text-[#f6f1df]"><Bike size={21} strokeWidth={1.8} /></div>
        <div><div className="display-font text-[17px] font-bold tracking-[-.04em]">BlueBikes</div><div className="mono text-[9px] uppercase tracking-[.18em] text-[#a8b7b5]">Operations desk</div></div>
      </div>
      <div className="mb-3 px-2 mono text-[9px] uppercase tracking-[.16em] text-[#91a2a7]">Workspace</div>
      <button onClick={() => goTo('overview')} data-testid="nav-overview" className="mb-1 flex items-center gap-3 rounded-lg bg-[#2c414a] px-3 py-2.5 text-left text-sm font-semibold text-[#faf7ed]">
        <Activity size={16} className="text-[#74c5a4]" /> Operations overview
      </button>
      <div className="mt-2 space-y-1">
        {navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => goTo(id)} data-testid={`nav-${id}`} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] text-[#b9c4c5] transition-colors hover:bg-[#2b3e47] hover:text-white">
          <Icon size={15} strokeWidth={1.8} />{label}
        </button>)}
      </div>
      <div className="mt-auto rounded-xl border border-[#394b54] bg-[#253842] p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#e5e9df]"><span className="h-2 w-2 rounded-full bg-[#73c59e]" /> Forecast feed active</div>
        <p className="text-[11px] leading-relaxed text-[#aebcbd]">Monthly demand model<br />2026 planning cycle</p>
        <div className="mono mt-3 border-t border-[#3a4e56] pt-3 text-[9px] uppercase tracking-wider text-[#82979b]">Boston · MA</div>
      </div>
    </aside>

    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 border-b border-[#e1ddd3] bg-[#f4f1e9]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-5 py-3.5 lg:px-9">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#203b43] text-[#f5f2e8] md:hidden"><Bike size={18} /></div>
            <div><div className="mono text-[9px] uppercase tracking-[.14em] text-[#8c918a]">Planning desk / 2026</div><div className="display-font text-[15px] font-semibold text-[#263a43]">Operations overview</div></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-[#7a8587] sm:inline">Planning scope</span>
            <div className="relative">
              <select value={city} onChange={(e) => setCity(e.target.value)} data-testid="select-city" aria-label="Filter by city" className="h-9 min-w-[142px] appearance-none rounded-lg border border-[#d9d3c7] bg-[#fbfaf6] pl-3 pr-9 text-xs font-semibold text-[#31474d] outline-none focus:border-[#19745d]">
              <option value="">All cities</option>{cityOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-[#728087]" />
            </div>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto border-t border-[#e6e1d7] px-5 py-2 md:hidden">
          {navItems.map((item) => <button key={item.id} onClick={() => goTo(item.id)} data-testid={`mobile-nav-${item.id}`} className="shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-[#5c6a6e] hover:bg-[#eae6dc]">{item.label}</button>)}
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 pb-16 pt-7 lg:px-9">
        <section id="overview" className="fade-up scroll-mt-24">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2"><span className="rounded bg-[#dceae1] px-2 py-1 mono text-[9px] font-medium uppercase tracking-[.13em] text-[#28735c]">FY 2026</span><span className="mono text-[10px] uppercase tracking-[.1em] text-[#8a9089]">Monthly staffing forecast</span></div>
              <h1 className="display-font text-[32px] font-semibold leading-[1.06] tracking-[-.055em] text-[#213740] sm:text-[39px]">Plan the people<br className="sm:hidden" /> behind every ride.</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#718087]">A live view of demand, rebalance pressure, and crew capacity across the BlueBikes system.</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#d9d4c9] bg-[#faf8f1] px-3 py-2 text-[11px] text-[#64757a]">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2c9b73] opacity-40" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#2c9b73]" /></span>
              Data current through <strong className="font-semibold text-[#364c52]">{overviewData?.actualThrough || '—'}</strong>
            </div>
          </div>

          <div className="mb-6 border-y border-[#d8d3c8] py-5">
            {overview.isLoading ? <LoadingPanel rows={2} /> : overview.isError ? <PanelError onRetry={() => overview.refetch()} /> : overviewData ? <div className="grid grid-cols-2 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
              <Metric label="Cities covered" value={fmt(overviewData.cityCount)} sub="Active service areas" icon={Bike} />
              <Metric label="Crew-months" value={fmt(overviewData.totalCrewMonths)} sub="Total 2026 requirement" icon={Users} accent="blue" />
              <Metric label="Seasonal months" value={fmt(overviewData.seasonalCrewMonths)} sub="Flexible capacity" icon={CalendarDays} accent="orange" />
              <Metric label="Peak staffing" value={fmt(overviewData.peakCrewCount)} sub={`${overviewData.peakMonth} peak`} icon={ArrowUpRight} accent="orange" />
              <Metric label="Trip WAPE" value={pct(overviewData.tripWapePct)} sub="Jan–Sep backtest" icon={Activity} />
              <Metric label="Imbalance WAPE" value={pct(overviewData.imbalanceWapePct)} sub="Rebalance proxy" icon={Waves} accent="blue" />
            </div> : <div className="p-4 text-sm text-[#738087]">No overview data available.</div>}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-xl border border-[#dfdbd1] bg-[#fbfaf6] p-5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div><p className="mono text-[9px] uppercase tracking-[.14em] text-[#8c918a]">Monthly demand signal</p><h2 className="display-font mt-1 text-[18px] font-semibold tracking-[-.03em] text-[#293d44]">Trip starts & crew plan</h2></div>
                <div className="flex gap-3 text-[10px] text-[#758087]"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#26785f]" />Total crews</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#e28a5b]" />Seasonal</span></div>
              </div>
              {staffing.isLoading ? <LoadingPanel rows={5} /> : staffing.isError ? <PanelError onRetry={() => staffing.refetch()} /> : staffingRows.length ? <div className="w-full min-w-0">
                <div className="grid w-full grid-cols-12 items-end gap-1 border-b border-[#e5e1d7] px-1 pb-3 pt-2 sm:gap-2" style={{ height: 172 }}>
                  {planForChart.map((row) => <div key={row.month} data-testid={`chart-month-${row.month}`} className="group flex min-w-0 h-full flex-col items-center justify-end gap-2" title={`${row.monthName}: ${row.totalCrewsNeeded} crews · ${fmt(row.forecastTripStarts)} trips`}>
                    <div className="relative flex h-[125px] w-full max-w-[34px] items-end overflow-hidden rounded-t-[4px] bg-[#e9e6dd]">
                      <div className="absolute bottom-0 w-full rounded-t-[4px] bg-[#2b8066] transition-all duration-500" style={{ height: `${Math.max(6, row.totalCrewsNeeded / maxCrews * 100)}%` }} />
                      <div className="absolute bottom-0 w-full rounded-t-[4px] bg-[#e28a5b] transition-all duration-500" style={{ height: `${Math.max(0, row.seasonalCrews / maxCrews * 100)}%` }} />
                    </div><span className="mono text-[9px] text-[#84908e]">{row.monthName.slice(0, 3)}</span>
                  </div>)}
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-[10px] text-[#79858a]"><span>Forecast trip starts: <strong className="mono text-[#344d52]">{fmt(chartTripStarts)}</strong></span><span>People capacity by month</span></div>
              </div> : <div className="p-6 text-sm text-[#758087]">No staffing plan is available for this selection.</div>}
            </div>

            <aside className="relative overflow-hidden rounded-xl bg-[#203a42] p-5 text-[#f1f0e7] sm:p-6">
              <div className="absolute -right-8 -top-9 h-40 w-40 rounded-full border border-[#42615e]/60" /><div className="absolute -right-1 -top-2 h-28 w-28 rounded-full border border-[#42615e]/50" />
              <p className="mono relative text-[9px] uppercase tracking-[.15em] text-[#9bb9ae]">Model notes</p>
              <h2 className="display-font relative mt-1 text-[18px] font-semibold tracking-[-.03em]">Read the forecast carefully.</h2>
              <div className="relative mt-4 flex gap-2 rounded-lg border border-[#49615f] bg-[#29464a] p-3">
                <CircleHelp size={15} className="mt-0.5 shrink-0 text-[#e9a276]" />
                <p className="text-[11px] leading-relaxed text-[#d3ded7]">{overviewData?.dataQualityNote || 'Data quality notes will appear when the overview is available.'}</p>
              </div>
              <div className="relative mt-4">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-[#9bb9ae]"><Database size={13} /> Assumptions</div>
                {overviewData?.modelAssumptions?.length ? <ul className="space-y-2">{overviewData.modelAssumptions.map((assumption, i) => <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-[#d3ded7]"><span className="mono text-[#e6a071]">{String(i + 1).padStart(2, '0')}</span>{assumption}</li>)}</ul> : <p className="text-[11px] text-[#a9b9b5]">No assumptions supplied.</p>}
              </div>
            </aside>
          </div>
        </section>

        <section id="staffing" className="fade-up fade-delay-1 mt-12 scroll-mt-24">
          <SectionHeading eyebrow="01 / Crew allocation" title="Staffing plan" detail="Monthly crews, hiring windows, and release timing." right={<span className="rounded-full bg-[#e6e2d8] px-3 py-1.5 mono text-[10px] text-[#647277]">{staffingRows.length} rows</span>} />
          <div className="overflow-hidden rounded-xl border border-[#dfdbd1] bg-[#fbfaf6]">
            {staffing.isLoading ? <LoadingPanel rows={6} /> : staffing.isError ? <PanelError onRetry={() => staffing.refetch()} /> : staffingRows.length ? <div className="thin-scroll overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                <thead><tr className="border-b border-[#e5e1d7] bg-[#f6f3eb] text-[9px] uppercase tracking-[.1em] text-[#828c8d]">
                  <th className="px-4 py-3">Month</th><th className="px-4 py-3">City</th><th className="px-4 py-3 text-right">Trip starts</th><th className="px-4 py-3 text-right">Rebalance bikes</th><th className="px-4 py-3 text-right">Crews</th><th className="px-4 py-3 text-right">Full-time</th><th className="px-4 py-3 text-right">Seasonal</th><th className="px-4 py-3">Seasonal movement</th><th className="px-4 py-3">Hire by</th><th className="px-4 py-3">Contract note</th>
                </tr></thead>
                <tbody>{staffingRows.slice().sort((a, b) => a.month - b.month || a.city.localeCompare(b.city)).map((row) => <tr key={`${row.city}-${row.month}`} data-testid={`row-staffing-${row.city}-${row.month}`} className="border-b border-[#eeeae1] last:border-0 hover:bg-[#f8f6ef]">
                  <td className="px-4 py-3 font-semibold text-[#32494e]">{row.monthName}</td><td className="px-4 py-3 text-[#66767a]">{row.city}</td><td className="mono px-4 py-3 text-right text-[#40585b]">{fmt(row.forecastTripStarts)}</td><td className="mono px-4 py-3 text-right text-[#40585b]">{fmt(row.forecastRebalanceProxyBikes)}</td><td className="mono px-4 py-3 text-right font-semibold text-[#19745d]">{fmt(row.totalCrewsNeeded)}</td><td className="mono px-4 py-3 text-right text-[#68787b]">{fmt(row.fullTimeCrews)}</td><td className="mono px-4 py-3 text-right text-[#b36140]">{fmt(row.seasonalCrews)}</td><td className="px-4 py-3 text-[#64757a]">{row.seasonalHires > 0 && <span className="mr-2 inline-flex items-center gap-1 text-[#16785d]"><ArrowUpRight size={12} />{row.seasonalHires}</span>}{row.seasonalReleases > 0 && <span className="inline-flex items-center gap-1 text-[#bd6847]"><ArrowDownRight size={12} />{row.seasonalReleases}</span>}{!row.seasonalHires && !row.seasonalReleases && '—'}</td><td className="mono px-4 py-3 text-[#65767b]">{row.hireBy || '—'}</td><td className="max-w-[190px] truncate px-4 py-3 text-[#7a8585]" title={row.contractNote}>{row.contractNote || '—'}</td>
                </tr>)}</tbody>
              </table>
            </div> : <div className="p-9 text-center text-sm text-[#758087]">No staffing rows match this city.</div>}
          </div>
        </section>

        <section id="backtest" className="fade-up fade-delay-2 mt-12 scroll-mt-24">
          <SectionHeading eyebrow="02 / Accuracy review" title="Forecast backtest" detail="January–September 2026 · forecast compared with observed trip and rebalance data." right={<span className="flex items-center gap-1.5 rounded-full bg-[#f4e6dc] px-3 py-1.5 text-[10px] font-semibold text-[#a85f40]"><Activity size={12} /> Actuals through {overviewData?.actualThrough || '—'}</span>} />
          <div className="overflow-hidden rounded-xl border border-[#dfdbd1] bg-[#fbfaf6]">
            {backtest.isLoading ? <LoadingPanel rows={6} /> : backtest.isError ? <PanelError onRetry={() => backtest.refetch()} /> : backtestRows.length ? <div className="thin-scroll overflow-x-auto">
              <table className="w-full min-w-[1060px] border-collapse text-left text-xs">
                <thead><tr className="border-b border-[#e5e1d7] bg-[#f6f3eb] text-[9px] uppercase tracking-[.1em] text-[#828c8d]">
                  <th className="px-4 py-3">Month</th><th className="px-4 py-3">City</th><th className="px-4 py-3 text-right">Forecast trips</th><th className="px-4 py-3 text-right">Actual trips</th><th className="px-4 py-3 text-right">Trip error</th><th className="px-4 py-3 text-right">Proxy error</th><th className="px-4 py-3 text-right">Planned crews</th><th className="px-4 py-3 text-right">Implied crews</th><th className="px-4 py-3 text-right">Crew gap</th><th className="px-4 py-3 text-right">Capacity gap</th>
                </tr></thead>
                <tbody>{backtestRows.slice().sort((a, b) => a.month - b.month).map((row) => <tr key={`${row.city}-${row.month}`} data-testid={`row-backtest-${row.city}-${row.month}`} className="border-b border-[#eeeae1] last:border-0 hover:bg-[#f8f6ef]">
                  <td className="px-4 py-3 font-semibold text-[#32494e]">{monthLabel(row.month)}</td><td className="px-4 py-3 text-[#66767a]">{row.city}</td><td className="mono px-4 py-3 text-right">{fmt(row.forecastTripStarts)}</td><td className="mono px-4 py-3 text-right">{fmt(row.actualTripStarts)}</td><td className={`mono px-4 py-3 text-right ${Math.abs(row.tripForecastErrorPct) > 15 ? 'text-[#bf6544]' : 'text-[#4d7e69]'}`}>{pct(row.tripForecastErrorPct)}</td><td className="mono px-4 py-3 text-right text-[#64777a]">{pct(row.imbalanceForecastErrorPct)}</td><td className="mono px-4 py-3 text-right">{fmt(row.plannedCrews)}</td><td className="mono px-4 py-3 text-right">{fmt(row.crewsImpliedByActualProxy)}</td><td className={`mono px-4 py-3 text-right ${row.crewShortfallProxy > 0 ? 'font-semibold text-[#b95d3f]' : 'text-[#4d7e69]'}`}>{row.crewShortfallProxy > 0 ? `+${fmt(row.crewShortfallProxy)}` : fmt(row.crewShortfallProxy)}</td><td className="mono px-4 py-3 text-right text-[#65767b]">{fmt(row.capacityShortfallProxyBikes)}</td>
                </tr>)}</tbody>
              </table>
            </div> : <div className="p-9 text-center text-sm text-[#758087]">No backtest rows match this city.</div>}
          </div>
          <p className="mt-2 text-[10px] text-[#8a918e]">Error values are displayed as provided by the forecast service. Crew gap is implied crews minus planned crews.</p>
        </section>

        <section id="sensitivity" className="mt-12 scroll-mt-24">
          <SectionHeading eyebrow="03 / Scenario lens" title="E-bike sensitivity" detail="How changes in e-bike share shift imbalance exposure and crew requirements." right={<div className="mono rounded-lg border border-[#ddd8cc] bg-[#f9f7f1] px-3 py-2 text-[10px] text-[#63747a]">SCENARIO VIEW</div>} />
          <div className="overflow-hidden rounded-xl border border-[#dfdbd1] bg-[#fbfaf6]">
            {sensitivity.isLoading ? <LoadingPanel rows={5} /> : sensitivity.isError ? <PanelError onRetry={() => sensitivity.refetch()} /> : sensitivityRows.length ? <div className="thin-scroll overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead><tr className="border-b border-[#e5e1d7] bg-[#f6f3eb] text-[9px] uppercase tracking-[.1em] text-[#828c8d]">
                  <th className="px-4 py-3">Scenario</th><th className="px-4 py-3">Month</th><th className="px-4 py-3">City</th><th className="px-4 py-3 text-right">Historical share</th><th className="px-4 py-3 text-right">Scenario share</th><th className="px-4 py-3 text-right">Imbalance bikes</th><th className="px-4 py-3 text-right">Required crews</th>
                </tr></thead>
                <tbody>{sensitivityRows.map((row, i) => <tr key={`${row.scenario}-${row.city}-${row.month}-${i}`} data-testid={`row-sensitivity-${i}`} className="border-b border-[#eeeae1] last:border-0 hover:bg-[#f8f6ef]">
                  <td className="px-4 py-3 font-semibold text-[#32494e]">{row.scenario}</td><td className="px-4 py-3 text-[#66767a]">{monthLabel(row.month)}</td><td className="px-4 py-3 text-[#66767a]">{row.city}</td><td className="mono px-4 py-3 text-right">{sharePct(row.historicalEbikeShare)}</td><td className="mono px-4 py-3 text-right text-[#19745d]">{sharePct(row.ebikeShareScenario)}</td><td className="mono px-4 py-3 text-right">{fmt(row.imbalanceBikes)}</td><td className="mono px-4 py-3 text-right font-semibold text-[#b36140]">{fmt(row.requiredCrews)}</td>
                </tr>)}</tbody>
              </table>
            </div> : <div className="p-9 text-center text-sm text-[#758087]">No sensitivity rows match this city.</div>}
          </div>
        </section>

        <section id="assistant" className="mt-12 scroll-mt-24">
          <SectionHeading eyebrow="04 / Ask the data" title="Operations assistant" detail="Explore the staffing forecast, backtest, and sensitivity results in plain language." />
          <div className="grid gap-4 xl:grid-cols-[1.4fr_.8fr]">
            <div className="overflow-hidden rounded-xl border border-[#d7d9cf] bg-[#fcfbf7]">
              <div className="flex items-center justify-between border-b border-[#e6e3d9] px-5 py-3.5">
                <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e1eee7] text-[#17765e]"><Sparkles size={15} /></div><span className="text-xs font-semibold text-[#384c51]">Planning analyst</span></div>
                <span className="mono flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-[#7f8b88]"><span className="h-1.5 w-1.5 rounded-full bg-[#65a889]" />Data-connected</span>
              </div>
              <div className="thin-scroll flex max-h-[440px] min-h-[250px] flex-col gap-4 overflow-y-auto p-5">
                {!chat.length && <div className="my-auto text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#eaf0e7] text-[#26785f]"><WandSparkles size={21} /></div>
                  <p className="display-font text-[16px] font-semibold text-[#31464d]">What should we pressure-test?</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#808c8c]">Ask a question about crew levels, forecast accuracy, or how an e-bike scenario changes the plan.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {['Where is the largest crew gap?', 'What changes at higher e-bike share?', 'Summarize the backtest'].map((prompt) => <button key={prompt} onClick={() => quickAsk(prompt)} data-testid={`suggestion-${prompt.slice(0, 8).toLowerCase().replaceAll(' ', '-')}`} className="rounded-full border border-[#dcded4] bg-[#f7f7f1] px-3 py-2 text-[10px] text-[#5b6c70] hover:border-[#82ad98] hover:text-[#176a54]">{prompt}</button>)}
                  </div>
                </div>}
                {chat.map((message, index) => <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`} data-testid={`chat-message-${message.role}-${index}`}>
                  <div className={`max-w-[90%] rounded-xl px-4 py-3 text-[12px] leading-relaxed ${message.role === 'user' ? 'bg-[#26785f] text-white' : 'border border-[#e3e1d8] bg-[#f4f3ec] text-[#405359]'}`}>
                    {message.content}
                    {message.response && <div className="mt-3 space-y-2">{message.response.toolsUsed.length > 0 && <div className="flex flex-wrap gap-1.5">{message.response.toolsUsed.map((tool) => <span key={tool} className="rounded bg-[#e2e9df] px-2 py-1 mono text-[9px] text-[#527060]">{tool}</span>)}</div>}
                      {message.response.dataBlocks.map((block, i) => <details key={i} className="rounded-lg border border-[#dcddd3] bg-[#faf9f4]">
                        <summary className="cursor-pointer px-3 py-2 text-[10px] font-semibold text-[#52666a]">{block.title}</summary><pre className="thin-scroll max-h-48 overflow-auto border-t border-[#e5e2d9] p-3 mono text-[9px] text-[#5d6b6b]">{block.json}</pre>
                      </details>)}</div>}
                  </div>
                </div>)}
                {askAgent.isPending && <div className="flex justify-start" data-testid="status-assistant-loading"><div className="flex items-center gap-2 rounded-xl border border-[#e3e1d8] bg-[#f4f3ec] px-4 py-3 text-xs text-[#71817e]"><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#33866b]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#33866b]" style={{ animationDelay: '.15s' }} /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#33866b]" style={{ animationDelay: '.3s' }} /></span>Checking the planning data…</div></div>}
              </div>
              <form onSubmit={submitQuestion} className="border-t border-[#e6e3d9] p-3">
                <div className="flex items-end gap-2 rounded-lg border border-[#dbded4] bg-white px-3 py-2 focus-within:border-[#79a893]">
                  <textarea id="assistant-input" value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} maxLength={4000} rows={1} placeholder="Ask about staffing, demand, or a scenario…" data-testid="input-assistant-question" className="max-h-28 min-h-[25px] flex-1 resize-y bg-transparent py-1 text-xs text-[#31474d] outline-none placeholder:text-[#9aa3a0]" />
                  <button type="submit" disabled={!question.trim() || askAgent.isPending} data-testid="button-send-question" aria-label="Send question" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#20765e] text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"><Send size={14} /></button>
                </div><div className="mt-1.5 flex justify-between px-1 text-[9px] text-[#9aa19c]"><span>Answers use available forecast data</span><span>{question.length}/4000</span></div>
              </form>
            </div>

            <div id="event-parser" className="scroll-mt-24 rounded-xl border border-[#dfdbd1] bg-[#fbfaf6] p-5">
              <div className="mb-4 flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f4e7dd] text-[#c36b46]"><CalendarDays size={17} /></div><div><p className="mono text-[9px] uppercase tracking-[.13em] text-[#9a897d]">Event intake</p><h3 className="display-font text-[17px] font-semibold tracking-[-.03em] text-[#30454b]">Turn a source into a brief</h3></div></div>
              <p className="mb-3 text-xs leading-relaxed text-[#768285]">Paste event notes, a bulletin, or a public notice. The assistant will structure the dates, place, attendance, and assumptions.</p>
              <form onSubmit={submitEvent}>
                <label htmlFor="event-source" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.08em] text-[#74817e]">Source text</label>
                <textarea id="event-source" value={sourceText} onChange={(e) => setSourceText(e.target.value)} minLength={10} maxLength={12000} rows={5} placeholder="Paste event information here…" data-testid="input-event-source" className="w-full resize-y rounded-lg border border-[#dedbd1] bg-[#fdfcf8] p-3 text-xs leading-relaxed text-[#31474d] outline-none placeholder:text-[#a0a7a1] focus:border-[#d48a65]" />
                <div className="mt-1 flex items-center justify-between text-[9px] text-[#9aa19c]"><span>Minimum 10 characters</span><span>{sourceText.length}/12000</span></div>
                <button type="submit" disabled={sourceText.trim().length < 10 || extractEvents.isPending} data-testid="button-extract-event" className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#bb6747] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#a9583b] disabled:cursor-not-allowed disabled:opacity-45">
                  {extractEvents.isPending ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />Structuring event…</> : <><WandSparkles size={14} />Extract event details</>}
                </button>
              </form>
              {extractEvents.isError && <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#f7e9e3] p-3 text-[11px] text-[#a14f38]" data-testid="status-event-error"><AlertTriangle size={14} className="mt-0.5 shrink-0" />Event details could not be extracted. Check the source text and try again.</div>}
              {extractEvents.data && <div className="mt-4 space-y-3" data-testid="event-results">
                <div className="flex items-center justify-between border-t border-[#e6e1d7] pt-3"><span className="text-[10px] font-bold uppercase tracking-[.09em] text-[#74817e]">Structured events</span><span className="mono text-[9px] text-[#89948f]">{extractEvents.data.length} found</span></div>
                {extractEvents.data.map((item, i) => <article key={`${item.eventName}-${i}`} className="rounded-lg border border-[#e3ded2] bg-[#f7f5ee] p-3" data-testid={`card-event-${i}`}>
                  <div className="flex items-start justify-between gap-2"><h4 className="text-xs font-semibold text-[#344a50]">{item.eventName}</h4><span className={`shrink-0 rounded-full px-2 py-1 mono text-[8px] uppercase ${item.confidence === 'high' ? 'bg-[#deeee3] text-[#286f56]' : item.confidence === 'medium' ? 'bg-[#f3ead6] text-[#92713a]' : 'bg-[#f3e2da] text-[#a1593e]'}`}>{item.confidence} confidence</span></div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
                    <div><dt className="text-[#89918d]">Dates</dt><dd className="mt-0.5 text-[#4c5e60]">{item.startDate || 'Unspecified'}{item.endDate && item.endDate !== item.startDate ? ` — ${item.endDate}` : ''}</dd></div>
                    <div><dt className="text-[#89918d]">City</dt><dd className="mt-0.5 text-[#4c5e60]">{item.city || 'Unspecified'}</dd></div>
                    <div><dt className="text-[#89918d]">Location</dt><dd className="mt-0.5 text-[#4c5e60]">{item.location || 'Unspecified'}</dd></div>
                    <div><dt className="text-[#89918d]">Expected crowd</dt><dd className="mt-0.5 text-[#4c5e60]">{fmt(item.expectedCrowdSize)}</dd></div>
                    <div><dt className="text-[#89918d]">Known participants</dt><dd className="mt-0.5 text-[#4c5e60]">{fmt(item.knownParticipantCount)}</dd></div>
                  </dl>
                  {!!item.assumptions.length && <div className="mt-3 border-t border-[#e2ded4] pt-2"><div className="text-[9px] font-semibold uppercase tracking-wider text-[#858e89]">Assumptions</div><ul className="mt-1 space-y-1">{item.assumptions.map((a, j) => <li key={j} className="text-[10px] leading-relaxed text-[#687574]">• {a}</li>)}</ul></div>}
                  <button onClick={() => setEventsExpanded((v) => !v)} data-testid={`button-source-text-${i}`} className="mt-2 flex items-center gap-1 text-[9px] font-medium text-[#73817e] hover:text-[#26785f]">{eventsExpanded ? <X size={11} /> : <Check size={11} />}{eventsExpanded ? 'Hide source' : 'View source'}</button>
                  {eventsExpanded && <p className="mt-2 max-h-24 overflow-auto rounded bg-[#eeece4] p-2 text-[9px] leading-relaxed text-[#73807e]">{item.sourceText}</p>}
                </article>)}
                {!extractEvents.data.length && <p className="text-xs text-[#7c8985]">No event details were found in this source.</p>}
              </div>}
            </div>
          </div>
        </section>
        <footer className="mt-14 flex flex-wrap items-center justify-between gap-2 border-t border-[#ddd8ce] pt-4 text-[10px] text-[#8b928e]"><span>BlueBikes operations planning · 2026 forecast cycle</span><span className="mono flex items-center gap-1.5"><Check size={11} className="text-[#33856b]" /> Connected to forecast data</span></footer>
      </div>
    </main>
  </div>;
}
