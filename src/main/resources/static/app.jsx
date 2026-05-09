/* global React, ReactDOM, Motion, Recharts */
const { useState, useEffect, useRef, useMemo, useCallback } = React;
const { motion, AnimatePresence, LayoutGroup } = Motion;
const {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell,
} = Recharts;

// ─────────────────────────────────────────────────────────────────────────────
// API layer
// ─────────────────────────────────────────────────────────────────────────────
const API_BASE = '/api';

async function apiFetch(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  const token = localStorage.getItem('jwt');
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const api = {
  get:   (path)        => apiFetch('GET',    path),
  post:  (path, body)  => apiFetch('POST',   path, body),
  put:   (path, body)  => apiFetch('PUT',    path, body),
  patch: (path, body)  => apiFetch('PATCH',  path, body),
  del:   (path)        => apiFetch('DELETE', path),
};

// ─────────────────────────────────────────────────────────────────────────────
// Data mapping — backend shape → frontend shape
// ─────────────────────────────────────────────────────────────────────────────
function mapTopic(t) {
  let lastStudied = t.lastStudied || null;
  if (lastStudied) {
    const s = String(lastStudied);
    // Backend may return full datetime — extract local date part only
    lastStudied = s.includes('T') ? s.split('T')[0] : s;
  }
  return {
    id: String(t.id),
    title: t.name,
    totalSec: t.totalSeconds || 0,
    lastStudied,
    notes: t.notes || '',
  };
}

function mapCourse(c, allTopics) {
  return {
    id: String(c.id),
    name: c.name,
    code: c.code || '',
    topics: (allTopics || [])
      .filter(t => t.courseId === c.id)
      .map(mapTopic),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart data transformer — converts API [{date, courseId, totalSeconds}]
// into stacked bar series [{label, courseId1: min, courseId2: min, ...}]
// ─────────────────────────────────────────────────────────────────────────────
const localDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function transformChartData(rawPoints, courses, range) {
  const today = new Date();
  const toMin = (sec) => Math.round(sec / 60);

  const buildRow = (label, dateKey) => {
    const row = { label };
    let total = 0;
    courses.forEach(c => {
      const pts = rawPoints.filter(p => {
        const pDate = p.date ? String(p.date).slice(0, dateKey.length) : '';
        return pDate === dateKey && String(p.courseId) === c.id;
      });
      const min = toMin(pts.reduce((a, p) => a + (p.totalSeconds || 0), 0));
      row[c.id] = min;
      total += min;
    });
    row.total = total;
    return row;
  };

  if (range === 'week') {
    const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return buildRow(DAY[d.getDay()], localDateStr(d));
    });
  }

  if (range === 'month') {
    const year  = today.getFullYear();
    const month = today.getMonth() + 1;
    const days  = new Date(year, month, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const day = i + 1;
      const iso = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      return buildRow(String(day), iso);
    });
  }

  if (range === 'year') {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const year   = today.getFullYear();
    return MONTHS.map((label, i) => {
      const iso = `${year}-${String(i + 1).padStart(2,'0')}`;
      return buildRow(label, iso);
    });
  }

  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Course colour palette
// ─────────────────────────────────────────────────────────────────────────────
const COURSE_HUES = [155, 195, 230, 100, 70, 280, 320, 25, 250, 180];
const courseColor = (idOrIndex, courses) => {
  if (idOrIndex === '__others') return 'rgba(148,163,184,0.35)';
  if (typeof idOrIndex === 'number') return `oklch(0.72 0.14 ${COURSE_HUES[idOrIndex % COURSE_HUES.length]})`;
  const idx = courses ? courses.findIndex(c => c.id === idOrIndex) : -1;
  return `oklch(0.72 0.14 ${COURSE_HUES[(idx >= 0 ? idx : 0) % COURSE_HUES.length]})`;
};

const MAX_VISIBLE_COURSES = 5;
function groupCoursesByTotal(courses, series) {
  const totals = courses.map(c => ({
    id: c.id, name: c.name, code: c.code,
    total: series.reduce((a, row) => a + (row[c.id] || 0), 0),
  })).sort((a, b) => b.total - a.total);

  if (totals.length <= MAX_VISIBLE_COURSES) return { top: totals, others: [], hasOthers: false };
  return { top: totals.slice(0, MAX_VISIBLE_COURSES), others: totals.slice(MAX_VISIBLE_COURSES), hasOthers: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');
const formatHMS = s => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
};
const formatHoursShort = s => {
  const h = s / 3600;
  if (h >= 10) return `${h.toFixed(0)}h`;
  if (h >= 1)  return `${h.toFixed(1)}h`;
  return `${Math.round(s / 60)}m`;
};
const relativeDate = iso => {
  if (!iso) return 'Never';
  const datePart = String(iso).split('T')[0];
  const d = new Date(datePart + 'T00:00:00');
  if (isNaN(d.getTime())) return 'Unknown';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return `${diff} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const toISO = d => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const initials = name => (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

// ─────────────────────────────────────────────────────────────────────────────
// Inline SVG icons — no CDN dependency
// ─────────────────────────────────────────────────────────────────────────────
const SVG_ICONS = {
  GraduationCap: '<path d="M22 10v6"/><path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  Timer: '<circle cx="12" cy="14" r="8"/><line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="14" x2="15" y2="11"/>',
  BarChart3: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  BookOpen: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  ArrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  LogOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  ChevronUp: '<path d="m18 15-6-6-6 6"/>',
  ChevronDown: '<path d="m6 9 6 6 6-6"/>',
  Plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  ChevronRight: '<path d="m9 18 6-6-6-6"/>',
  Pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  Trash2: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  Clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  Calendar: '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  StickyNote: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/>',
  Play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  Pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  Square: '<rect width="18" height="18" x="3" y="3" rx="2"/>',
  Star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  MoreHorizontal: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  Menu: '<line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/>',
  X: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  ChevronLeft: '<path d="m15 18-6-6 6-6"/>',
  Search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  Loader2: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  Activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  TrendingUp: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  Flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
};

const Icon = ({ name, size = 16, className = '', strokeWidth = 1.75 }) => {
  const inner = SVG_ICONS[name];
  if (!inner) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Stopwatch hook
// ─────────────────────────────────────────────────────────────────────────────
function useStopwatch() {
  const [elapsed, setElapsed]   = useState(0);
  const [running, setRunning]   = useState(false);
  const startTsRef  = useRef(null);
  const baseRef     = useRef(0);
  const rafRef      = useRef(null);

  const tick = useCallback(() => {
    if (startTsRef.current != null) {
      setElapsed(baseRef.current + (performance.now() - startTsRef.current) / 1000);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (running) rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running, tick]);

  const start = () => {
    if (running) return;
    startTsRef.current = performance.now();
    setRunning(true);
  };
  const pause = () => {
    if (!running) return;
    baseRef.current += (performance.now() - startTsRef.current) / 1000;
    startTsRef.current = null;
    setRunning(false);
    setElapsed(baseRef.current);
  };
  const reset = () => {
    baseRef.current = 0; startTsRef.current = null;
    setRunning(false); setElapsed(0);
  };
  const stopAndGet = () => {
    let total = baseRef.current;
    if (running && startTsRef.current != null) total += (performance.now() - startTsRef.current) / 1000;
    return total;
  };

  return { elapsed, running, start, pause, reset, stopAndGet };
}

// ─────────────────────────────────────────────────────────────────────────────
// InlineRename
// ─────────────────────────────────────────────────────────────────────────────
function InlineRename({ value, editing, onCommit, onCancel, onStartEdit, className = '', inputClassName = '', placeholder = 'Untitled' }) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      const id = requestAnimationFrame(() => {
        if (inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
      });
      return () => cancelAnimationFrame(id);
    }
  }, [editing]); // eslint-disable-line

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        placeholder={placeholder}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); onCommit(draft.trim() || value); }
          else if (e.key === 'Escape') { e.preventDefault(); onCancel?.(); }
        }}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        className={`bg-slate-900/80 border border-emerald-500/40 rounded px-1.5 py-0.5 outline-none focus:border-emerald-400 ${inputClassName}`}
      />
    );
  }
  return (
    <span onDoubleClick={e => { e.stopPropagation(); onStartEdit?.(); }} className={className} title="Double-click to rename">
      {value}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Landing Page
// ─────────────────────────────────────────────────────────────────────────────
function LandingPage() {
  const [showEmail, setShowEmail]   = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm]             = useState({ email: '', password: '', name: '' });
  const [authErr, setAuthErr]       = useState('');
  const [authBusy, setAuthBusy]     = useState(false);

  const handleEmailAuth = async () => {
    setAuthBusy(true);
    setAuthErr('');
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const body = isRegister
        ? { email: form.email, password: form.password, name: form.name }
        : { email: form.email, password: form.password };
      const res = await api.post(endpoint, body);
      localStorage.setItem('jwt', res.token);
      window.location.reload();
    } catch {
      setAuthErr(isRegister ? 'Kayıt başarısız. Email zaten kullanımda olabilir.' : 'Email veya şifre hatalı.');
    } finally {
      setAuthBusy(false);
    }
  };

  const features = [
    {
      icon: 'Timer', title: 'Session Timer',
      desc: 'Drift-free stopwatch with pause & resume. Every second counted.',
      grad: 'from-emerald-500/15 to-emerald-600/5', border: 'border-emerald-500/20',
      iconBg: 'bg-emerald-500/15 border-emerald-500/25', iconColor: 'text-emerald-400',
    },
    {
      icon: 'BarChart3', title: 'Analytics',
      desc: 'Weekly, monthly, yearly breakdowns per course. Spot your patterns.',
      grad: 'from-sky-500/15 to-sky-600/5', border: 'border-sky-500/20',
      iconBg: 'bg-sky-500/15 border-sky-500/25', iconColor: 'text-sky-400',
    },
    {
      icon: 'BookOpen', title: 'Topic Notes',
      desc: 'Attach reminder notes to each topic. Auto-saved, always there.',
      grad: 'from-violet-500/15 to-violet-600/5', border: 'border-violet-500/20',
      iconBg: 'bg-violet-500/15 border-violet-500/25', iconColor: 'text-violet-400',
    },
  ];

  const LatticeLogoSVG = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <path d="M13 4L4 9v8l9 5 9-5V9L13 4z" stroke="#f1f5f9" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M13 4v13M4 9l9 4M22 9l-9 4" stroke="#f1f5f9" strokeWidth="1.5" opacity="0.45"/>
    </svg>
  );

  return (
    <div className="h-screen w-screen overflow-hidden flex relative">
      {/* Left side — brand + slogan */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="hidden md:flex flex-col items-start justify-center w-1/2 px-14 lg:px-20 relative overflow-hidden"
      >
        {/* Logo row */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.55 }}
          className="flex items-center gap-3.5 mb-9"
        >
          <div className="relative w-[46px] h-[46px] rounded-[13px] bg-gradient-to-br from-emerald-600 to-emerald-500 grid place-items-center shrink-0 overflow-hidden shadow-lg shadow-emerald-900/40"
            style={{ boxShadow: '0 0 0 1px rgba(52,211,153,0.25), 0 8px 28px rgba(16,185,129,0.25)' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent" />
            <LatticeLogoSVG size={24} />
          </div>
          <span className="font-display text-[26px] text-slate-100" style={{ letterSpacing: '-0.5px' }}>Lattice</span>
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
          style={{ fontSize: 11, letterSpacing: '0.03em', alignSelf: 'flex-start' }}
        >
          <span className="w-[5px] h-[5px] rounded-full bg-emerald-400 animate-pulse-dot shrink-0" />
          Study smarter, not harder
        </motion.div>

        {/* Hero heading */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.20, duration: 0.65 }}
          className="font-display text-slate-100 mb-4 leading-[1.05]"
          style={{ fontSize: 'clamp(36px, 4.2vw, 58px)', letterSpacing: '-1.5px' }}
        >
          Track every<br /><em className="text-emerald-400 not-italic italic">second</em> you<br />learn.
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.6 }}
          className="text-[14px] text-slate-400 leading-[1.75] mb-10 max-w-[340px] font-light"
        >
          Understand exactly where your time goes — by course, by topic, by day. Patterns emerge. Progress becomes visible.
        </motion.p>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.6 }}
          className="flex flex-col gap-4"
        >
          {features.map(f => (
            <div key={f.title} className="flex items-start gap-3.5">
              <div className={`w-[34px] h-[34px] shrink-0 rounded-[9px] border ${f.iconBg} grid place-items-center`}>
                <Icon name={f.icon} size={14} className={f.iconColor} />
              </div>
              <div>
                <div className="text-[13px] font-medium text-slate-200 mb-0.5">{f.title}</div>
                <div className="text-[12px] text-slate-500 font-light leading-relaxed">{f.desc}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Vertical divider */}
      <div className="hidden md:block absolute" style={{ right: '50%', top: '15%', bottom: '15%', width: 1, background: 'linear-gradient(to bottom, transparent, rgba(148,163,184,0.12) 30%, rgba(148,163,184,0.12) 70%, transparent)' }} />

      {/* Right side — sign in */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center justify-center w-full md:w-1/2 px-8 md:px-14 lg:px-20 relative overflow-y-auto"
      >
        {/* Mobile logo */}
        <div className="md:hidden mb-8 flex flex-col items-center gap-3">
          <div className="w-[46px] h-[46px] rounded-[13px] bg-gradient-to-br from-emerald-600 to-emerald-500 grid place-items-center relative overflow-hidden"
            style={{ boxShadow: '0 0 0 1px rgba(52,211,153,0.25)' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent" />
            <LatticeLogoSVG size={22} />
          </div>
          <span className="font-display text-[28px] text-slate-100">Lattice</span>
        </div>

        <div className="w-full max-w-[380px]">
          {/* Greeting */}
          <div className="mb-8">
            <h2 className="font-display text-slate-100 mb-1.5" style={{ fontSize: 34, letterSpacing: '-0.8px' }}>Hoş geldiniz</h2>
            <p className="text-[14px] text-slate-400 font-light">Devam etmek için giriş yapın</p>
          </div>

          {/* Google button */}
          <a
            href="/oauth2/authorization/google"
            className="flex items-center justify-center gap-3 w-full rounded-xl bg-white hover:bg-gray-50 active:scale-[0.98] text-gray-800 text-[15px] font-medium transition-all"
            style={{ padding: '13px 20px', textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.30)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)'; }}
          >
            <svg viewBox="0 0 20 20" width="20" height="20" style={{ flexShrink: 0 }}>
              <path d="M19.6 10.23c0-.68-.06-1.36-.17-2H10v3.77h5.4a4.64 4.64 0 01-2 3.05v2.54h3.24c1.9-1.75 3-4.33 3-7.36z" fill="#4285F4"/>
              <path d="M10 20c2.7 0 4.97-.9 6.63-2.41l-3.24-2.54c-.9.6-2.04.96-3.39.96-2.61 0-4.82-1.76-5.6-4.13H1.07v2.62A9.99 9.99 0 0010 20z" fill="#34A853"/>
              <path d="M4.4 11.88A6.01 6.01 0 014.08 10c0-.65.11-1.28.32-1.88V5.5H1.07A9.99 9.99 0 000 10c0 1.62.39 3.14 1.07 4.5l3.33-2.62z" fill="#FBBC05"/>
              <path d="M10 3.99c1.47 0 2.79.51 3.83 1.5l2.86-2.86C14.96.9 12.7 0 10 0A9.99 9.99 0 001.07 5.5L4.4 8.12C5.18 5.75 7.39 3.99 10 3.99z" fill="#EA4335"/>
            </svg>
            Google ile giriş yap
          </a>

          {/* Divider */}
          <div className="flex items-center gap-4 my-5">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[11px] text-slate-600 font-light uppercase tracking-[0.08em]">ya da</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Email/password form */}
          {!showEmail ? (
            <button
              onClick={() => setShowEmail(true)}
              className="w-full py-3 px-5 rounded-xl border border-slate-700 text-[14px] text-slate-400 hover:text-slate-200 hover:border-slate-600 bg-transparent transition-all"
            >
              Email ile giriş yap / kayıt ol
            </button>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex rounded-xl overflow-hidden border border-slate-800">
                {['login', 'register'].map(t => (
                  <button key={t}
                    onClick={() => { setIsRegister(t === 'register'); setAuthErr(''); }}
                    className={`flex-1 py-2 text-[12px] font-medium transition-colors ${
                      (t === 'register') === isRegister
                        ? 'bg-slate-800 text-slate-100'
                        : 'bg-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {t === 'login' ? 'Giriş' : 'Kayıt Ol'}
                  </button>
                ))}
              </div>

              {isRegister && (
                <input
                  type="text" placeholder="İsim"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/70 text-slate-100 text-[13px] placeholder:text-slate-600 outline-none focus:border-emerald-500/60 transition-all"
                />
              )}
              <input
                type="email" placeholder="Email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/70 text-slate-100 text-[13px] placeholder:text-slate-600 outline-none focus:border-emerald-500/60 transition-all"
              />
              <input
                type="password" placeholder="Şifre (min. 6 karakter)"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/70 text-slate-100 text-[13px] placeholder:text-slate-600 outline-none focus:border-emerald-500/60 transition-all"
              />

              {authErr && <p className="text-[12px] text-red-400 text-center">{authErr}</p>}

              <button
                onClick={handleEmailAuth}
                disabled={authBusy}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 active:scale-95 text-slate-950 text-[13px] font-bold transition-all"
              >
                {authBusy ? '...' : (isRegister ? 'Kayıt Ol' : 'Giriş Yap')}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile dropdown
// ─────────────────────────────────────────────────────────────────────────────
function ProfileSection({ currentUser, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const name    = currentUser?.name  || 'User';
  const email   = currentUser?.email || '';
  const picture = currentUser?.picture;
  const abbr    = initials(name);

  return (
    <div ref={ref} className="relative px-5 py-4 border-t border-slate-800/80">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-3 right-3 mb-2 rounded-xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-slate-800/60">
              <div className="text-[12px] font-medium text-slate-200">{name}</div>
              {email && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{email}</div>}
            </div>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full px-4 py-2.5 text-left text-[13px] text-red-400 hover:bg-slate-800/50 flex items-center gap-2.5 transition-colors"
            >
              <Icon name="LogOut" size={13} />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-3 w-full group"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-emerald-600/40 to-slate-700 border border-emerald-500/20 grid place-items-center shrink-0">
          {picture
            ? <img src={picture} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            : <span className="text-[11px] font-semibold text-emerald-300">{abbr}</span>
          }
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[12px] text-slate-200 truncate">{name}</div>
          {email && <div className="text-[11px] text-slate-500 truncate">{email}</div>}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <Icon name="ChevronUp" size={12} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
        </motion.div>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Course Rail
// ─────────────────────────────────────────────────────────────────────────────
function CourseRail({
  courses, activeCourseId, onSelect, totalTodaySec,
  mobileOpen, onCloseMobile, view, onChangeView,
  onAddCourse, onRenameCourse, onDeleteCourse,
  editingCourseId, onStartEditCourse, onCancelEditCourse,
  currentUser, onLogout,
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [courseEditMode, setCourseEditMode] = useState(false);

  const content = (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 0 1px rgba(52,211,153,0.25)' }}>
          <svg width="16" height="16" viewBox="0 0 26 26" fill="none">
            <path d="M13 4L4 9v8l9 5 9-5V9L13 4z" stroke="#f1f5f9" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M13 4v13M4 9l9 4M22 9l-9 4" stroke="#f1f5f9" strokeWidth="1.8" opacity="0.5"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-[14px] text-slate-100" style={{ letterSpacing: '-0.3px' }}>Lattice</div>
          <div className="text-[10.5px] text-slate-500 -mt-0.5">Study tracker</div>
        </div>
        <button onClick={onCloseMobile} className="md:hidden p-1 text-slate-400 hover:text-slate-200">
          <Icon name="X" size={18} />
        </button>
      </div>

      {/* Today box */}
      <div className="px-5 pb-4">
        <div className="rounded-lg bg-slate-900/60 border border-slate-800 px-3.5 py-3">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-slate-500 font-medium">Today</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-[22px] text-slate-100 tabular-nums tracking-tight">
              {formatHMS(totalTodaySec)}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">total study time</div>
        </div>
      </div>

      {/* Stats nav */}
      <div className="px-3 pb-3">
        <button
          onClick={() => { onChangeView('stats'); onCloseMobile?.(); }}
          className={`relative w-full text-left px-2.5 py-2 rounded-md flex items-center gap-3 group transition-colors
            ${view === 'stats' ? 'bg-slate-800/70 border border-slate-700/60' : 'border border-transparent hover:bg-slate-900/60'}`}
        >
          <Icon name="BarChart3" size={14} className={view === 'stats' ? 'text-emerald-400' : 'text-slate-400'} />
          <span className={`text-[13px] flex-1 ${view === 'stats' ? 'text-slate-100 font-medium' : 'text-slate-300'}`}>
            Stats
          </span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">All</span>
        </button>
      </div>

      {/* Courses header */}
      <div className="px-5 pb-2">
        <div className="text-[10.5px] uppercase tracking-[0.12em] text-slate-500 font-medium">Courses</div>
      </div>

      {/* Course list — scrollable with thin scrollbar */}
      <nav className="flex-1 overflow-y-auto thin-scroll px-3 pb-4 space-y-0.5 min-h-0">
        <LayoutGroup>
          {courses.map(c => {
            const active = view === 'course' && c.id === activeCourseId;
            const totalSec = c.topics.reduce((a, t) => a + t.totalSec, 0);
            const isConfirmDelete = confirmDeleteId === c.id;

            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (editingCourseId === c.id || isConfirmDelete) return;
                  onSelect(c.id); onChangeView('course'); onCloseMobile?.();
                }}
                onKeyDown={e => {
                  if (editingCourseId === c.id || isConfirmDelete) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault(); onSelect(c.id); onChangeView('course'); onCloseMobile?.();
                  }
                }}
                className="relative w-full text-left px-2.5 py-2 rounded-md flex items-center gap-3 group cursor-pointer"
              >
                {active && (
                  <motion.div
                    key="active-bg"
                    layoutId="course-active"
                    className="absolute inset-0 bg-slate-800/70 rounded-md border border-slate-700/60"
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
                <span className={`relative w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-emerald-400' : 'bg-slate-600 group-hover:bg-slate-500'}`} />

                <div className="relative flex-1 min-w-0">
                  <div className={`text-[13px] truncate ${active ? 'text-slate-100 font-medium' : 'text-slate-300'}`}>
                    <InlineRename
                      value={c.name}
                      editing={editingCourseId === c.id}
                      onStartEdit={() => onStartEditCourse?.(c.id)}
                      onCommit={v => onRenameCourse?.(c.id, v)}
                      onCancel={() => onCancelEditCourse?.()}
                      placeholder="Course name"
                      inputClassName="text-[13px] w-full text-slate-100"
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {c.code ? `${c.code} · ` : ''}{c.topics.length} topics
                  </div>
                </div>

                <div className="relative font-mono text-[11px] text-slate-500 tabular-nums flex items-center gap-1">
                  {(courseEditMode || active) && editingCourseId !== c.id && !isConfirmDelete && (
                    <>
                      <span
                        role="button" tabIndex={0}
                        onClick={e => { e.stopPropagation(); onStartEditCourse?.(c.id); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onStartEditCourse?.(c.id); }}}
                        className={`${courseEditMode ? 'text-slate-400 hover:text-slate-200' : 'opacity-0 group-hover:opacity-100 hover:text-slate-200'} transition-all p-0.5 cursor-pointer`}
                        title="Rename"
                      >
                        <Icon name="Pencil" size={11} />
                      </span>
                      <span
                        role="button" tabIndex={0}
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setConfirmDeleteId(c.id); }}}
                        className={`${courseEditMode ? 'text-slate-400 hover:text-red-400' : 'opacity-0 group-hover:opacity-100 hover:text-red-400'} transition-all p-0.5 cursor-pointer`}
                        title="Delete course"
                      >
                        <Icon name="Trash2" size={11} />
                      </span>
                    </>
                  )}
                  {isConfirmDelete ? (
                    <span className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <span className="text-[10px] text-slate-400">Delete?</span>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); onDeleteCourse?.(c.id); }}
                        className="text-[10px] text-red-400 hover:text-red-300 font-medium"
                      >Yes</button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                        className="text-[10px] text-slate-500 hover:text-slate-300 font-medium"
                      >No</button>
                    </span>
                  ) : (
                    <span>{formatHoursShort(totalSec)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </LayoutGroup>

        {courses.length === 0 && (
          <div className="px-2 py-6 text-center">
            <div className="text-[11.5px] text-slate-500">No courses yet.</div>
            <button onClick={onAddCourse} className="mt-2 text-[11.5px] text-emerald-400 hover:text-emerald-300">
              + Add your first course
            </button>
          </div>
        )}
      </nav>

      {/* Footer action buttons */}
      <div className="px-3 pb-3 pt-3 border-t border-slate-800/60 flex gap-2">
        <button
          onClick={onAddCourse}
          className="flex-1 px-2 py-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 hover:text-emerald-300 text-[12px] text-slate-300 font-medium flex items-center justify-center gap-1.5 transition-colors"
        >
          <Icon name="Plus" size={13} strokeWidth={2.2} /> Add Course
        </button>
        <button
          onClick={() => { setCourseEditMode(v => !v); if (courseEditMode) onCancelEditCourse?.(); }}
          className={`flex-1 px-2 py-2 rounded-lg border text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors
            ${courseEditMode
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'}`}
        >
          <Icon name="Pencil" size={13} /> Set Course
        </button>
      </div>

      {/* Profile section */}
      <ProfileSection currentUser={currentUser} onLogout={onLogout} />
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex w-[260px] shrink-0 flex-col min-h-0 border-r border-slate-800/80 bg-slate-950/40 backdrop-blur-md">
        {content}
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 36 }}
              className="md:hidden fixed left-0 top-0 bottom-0 w-[280px] z-50 flex flex-col bg-slate-950 border-r border-slate-800"
            >
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stopwatch panel
// ─────────────────────────────────────────────────────────────────────────────
function StopwatchPanel({ topic, onSave }) {
  const sw = useStopwatch();

  const handleStop = () => {
    const total = sw.stopAndGet();
    if (total < 1) { sw.reset(); return; }
    onSave(total);
    sw.reset();
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 overflow-hidden">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${sw.running ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 font-medium">
            {sw.running ? 'Focus session' : 'Ready to focus'}
          </div>
        </div>
        <div className="text-[11.5px] text-slate-500 truncate max-w-[60%]">
          {topic ? topic.title : 'Select a topic to begin'}
        </div>
      </div>

      <div className="relative px-5 py-10 grid place-items-center">
        <AnimatePresence>
          {sw.running && (
            <>
              <motion.div key="r1" initial={{ scale: 0.9, opacity: 0.5 }} animate={{ scale: 1.35, opacity: 0 }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }} exit={{ opacity: 0 }}
                className="absolute w-[260px] h-[260px] rounded-full border border-emerald-400/40" />
              <motion.div key="r2" initial={{ scale: 0.9, opacity: 0.4 }} animate={{ scale: 1.35, opacity: 0 }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: 1.2 }} exit={{ opacity: 0 }}
                className="absolute w-[260px] h-[260px] rounded-full border border-emerald-400/40" />
            </>
          )}
        </AnimatePresence>

        <motion.div
          animate={sw.running ? { boxShadow: ['0 0 0 0 rgba(16,185,129,0.0)','0 0 0 8px rgba(16,185,129,0.12)','0 0 0 0 rgba(16,185,129,0.0)'] } : { boxShadow: '0 0 0 0 rgba(16,185,129,0)' }}
          transition={sw.running ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : {}}
          className={`relative w-[260px] h-[260px] rounded-full grid place-items-center
            ${sw.running ? 'bg-emerald-500/[0.04] border border-emerald-400/30' : 'bg-slate-950/40 border border-slate-800'}`}
        >
          <div className="text-center">
            <div className="font-mono text-[44px] sm:text-[52px] text-slate-100 tabular-nums tracking-tight leading-none">
              {formatHMS(sw.elapsed)}
            </div>
            <div className="mt-3 text-[10.5px] uppercase tracking-[0.18em] text-slate-500">
              {sw.running ? 'in focus' : sw.elapsed > 0 ? 'paused' : 'stopwatch'}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="px-5 pb-5 flex items-center justify-center gap-2.5">
        {!sw.running && sw.elapsed === 0 && (
          <button onClick={sw.start} disabled={!topic}
            className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-[13px] font-semibold flex items-center gap-2 transition-colors">
            <Icon name="Play" size={14} strokeWidth={2.5} /> Start
          </button>
        )}
        {sw.running && (
          <button onClick={sw.pause}
            className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-[13px] font-medium flex items-center gap-2 transition-colors">
            <Icon name="Pause" size={14} strokeWidth={2.5} /> Pause
          </button>
        )}
        {!sw.running && sw.elapsed > 0 && (
          <button onClick={sw.start}
            className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[13px] font-semibold flex items-center gap-2 transition-colors">
            <Icon name="Play" size={14} strokeWidth={2.5} /> Resume
          </button>
        )}
        {sw.elapsed > 0 && (
          <button onClick={handleStop}
            className="px-5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 text-[13px] font-medium flex items-center gap-2 transition-colors">
            <Icon name="Square" size={13} strokeWidth={2.5} /> Stop & save
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes panel
// ─────────────────────────────────────────────────────────────────────────────
function NotesPanel({ topic, onChange }) {
  const [val, setVal]     = useState(topic?.notes ?? '');
  const [saved, setSaved] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => { setVal(topic?.notes ?? ''); setSaved(true); }, [topic?.id]);

  const handle = e => {
    setVal(e.target.value);
    setSaved(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { onChange(e.target.value); setSaved(true); }, 600);
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 flex flex-col min-h-[260px]">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <Icon name="StickyNote" size={13} className="text-slate-400" />
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 font-medium">Reminder notes</div>
        </div>
        <div className={`text-[10.5px] tabular-nums ${saved ? 'text-slate-500' : 'text-emerald-400'}`}>
          {saved ? 'saved' : 'saving…'}
        </div>
      </div>
      <textarea
        value={val}
        onChange={handle}
        disabled={!topic}
        placeholder={topic ? 'What do you want to remember about this topic?' : 'Select a topic first…'}
        className="flex-1 bg-transparent px-5 py-4 text-[13.5px] text-slate-200 placeholder:text-slate-600 resize-none outline-none leading-relaxed"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Topic list pane
// ─────────────────────────────────────────────────────────────────────────────
function TopicList({
  course, activeTopicId, onSelect, onAdd, onDeleteTopic,
  onRenameTopic, editingTopicId, onStartEditTopic, onCancelEditTopic,
  onRenameCourse, editingCourseId, onStartEditCourse, onCancelEditCourse,
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b border-slate-800/60">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>{course.code || course.name}</span>
          <Icon name="ChevronRight" size={12} />
          <span className="text-slate-300">Topics</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <h2 className="font-display text-[20px] text-slate-100 truncate flex items-center gap-2 group" style={{ letterSpacing: '-0.3px' }}>
            <InlineRename
              value={course.name}
              editing={editingCourseId === course.id}
              onStartEdit={() => onStartEditCourse?.(course.id)}
              onCommit={v => onRenameCourse?.(course.id, v)}
              onCancel={() => onCancelEditCourse?.()}
              placeholder="Course name"
              inputClassName="text-[20px] font-semibold tracking-tight text-slate-100 min-w-0"
            />
            {editingCourseId !== course.id && (
              <button
                onClick={() => onStartEditCourse?.(course.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-500 hover:text-slate-200"
                title="Rename course"
              >
                <Icon name="Pencil" size={13} />
              </button>
            )}
          </h2>
          <button
            onClick={onAdd}
            className="shrink-0 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[12px] text-slate-100 font-medium flex items-center gap-1.5 transition-colors"
          >
            <Icon name="Plus" size={13} strokeWidth={2.5} /> Add topic
          </button>
        </div>
        <div className="mt-2 text-[12px] text-slate-500">
          {course.topics.length} topics · {formatHoursShort(course.topics.reduce((a, t) => a + t.totalSec, 0))} total
        </div>
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll px-3 py-3 space-y-1.5">
        <AnimatePresence mode="popLayout">
          {course.topics.map((t, i) => {
            const active  = t.id === activeTopicId;
            const editing = editingTopicId === t.id;
            const isConfirm = confirmDeleteId === t.id;

            return (
              <motion.div
                key={t.id}
                role="button"
                tabIndex={0}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => { if (!editing && !isConfirm) onSelect(t.id); }}
                onKeyDown={e => { if (!editing && !isConfirm && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(t.id); }}}
                className={`relative w-full text-left rounded-lg px-3.5 py-3 border transition-colors group cursor-pointer
                  ${active
                    ? 'bg-slate-800/70 border-slate-700'
                    : 'bg-slate-900/30 border-slate-800/60 hover:bg-slate-900/60 hover:border-slate-700/80'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 w-1 h-1 rounded-full shrink-0 ${active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13.5px] truncate ${active ? 'text-slate-100 font-medium' : 'text-slate-200'}`}>
                      <InlineRename
                        value={t.title}
                        editing={editing}
                        onStartEdit={() => onStartEditTopic?.(t.id)}
                        onCommit={v => onRenameTopic?.(t.id, v)}
                        onCancel={() => onCancelEditTopic?.()}
                        placeholder="Topic name"
                        inputClassName="text-[13.5px] w-full text-slate-100"
                      />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11.5px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Icon name="Clock" size={11} /> {formatHoursShort(t.totalSec)}
                      </span>
                      {t.lastStudied && (
                        <span className="flex items-center gap-1">
                          <Icon name="Calendar" size={11} /> {relativeDate(t.lastStudied)}
                        </span>
                      )}
                    </div>
                  </div>

                  {!editing && (
                    <div className="mt-1 shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isConfirm ? (
                        <span className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <span className="text-[10px] text-slate-400">Delete?</span>
                          <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); onDeleteTopic?.(t.id); }}
                            className="text-[10px] text-red-400 hover:text-red-300 font-medium">Yes</button>
                          <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                            className="text-[10px] text-slate-500 hover:text-slate-300 font-medium">No</button>
                        </span>
                      ) : (
                        <>
                          <span role="button" tabIndex={0}
                            onClick={e => { e.stopPropagation(); onStartEditTopic?.(t.id); }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onStartEditTopic?.(t.id); }}}
                            className="p-1 text-slate-500 hover:text-slate-200 cursor-pointer"
                            title="Rename topic">
                            <Icon name="Pencil" size={11} />
                          </span>
                          <span role="button" tabIndex={0}
                            onClick={e => { e.stopPropagation(); setConfirmDeleteId(t.id); }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setConfirmDeleteId(t.id); }}}
                            className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                            title="Delete topic">
                            <Icon name="Trash2" size={11} />
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  <Icon name="ChevronRight" size={14} className={`mt-1 shrink-0 ${active ? 'text-slate-300' : 'text-slate-600 group-hover:text-slate-400'}`} />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {course.topics.length === 0 && (
          <div className="py-8 text-center">
            <div className="text-[12px] text-slate-500">No topics yet.</div>
            <button onClick={onAdd} className="mt-2 text-[12px] text-emerald-400 hover:text-emerald-300">
              + Add first topic
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI card + Filter chip (used in Stats)
// ─────────────────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, accent }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'bg-emerald-500/[0.04] border-emerald-500/20' : 'bg-slate-900/40 border-slate-800/80'}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.12em] text-slate-500 font-medium">{label}</div>
        <Icon name={icon} size={13} className={accent ? 'text-emerald-400' : 'text-slate-500'} />
      </div>
      <div className={`mt-1.5 font-mono text-[22px] tabular-nums tracking-tight ${accent ? 'text-emerald-300' : 'text-slate-100'}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-500 truncate">{sub}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] border transition-colors shrink-0
        ${active
          ? 'bg-slate-800 border-slate-700 text-slate-100'
          : 'bg-transparent border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'}`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats view
// ─────────────────────────────────────────────────────────────────────────────
function StatsView({ courses, stats }) {
  const [range, setRange]           = useState('week');
  const [courseFilter, setCourseFilter] = useState('all');
  const [chartsReady, setChartsReady]   = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setChartsReady(true), 30);
    const t2 = setTimeout(() => window.dispatchEvent(new Event('resize')), 80);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const RC = chartsReady ? ResponsiveContainer : (() => null);

  const series = stats[range] || [];

  const grouping = useMemo(() => groupCoursesByTotal(courses, series), [courses, series]);
  const groupedSeries = useMemo(() => {
    if (!grouping.hasOthers) return series;
    const otherIds = new Set(grouping.others.map(o => o.id));
    return series.map(row => {
      let othersSum = 0;
      for (const id of otherIds) othersSum += (row[id] || 0);
      return { ...row, __others: othersSum };
    });
  }, [series, grouping]);

  const stackKeys = useMemo(() => {
    const keys = grouping.top.map(t => ({ id: t.id, name: t.name, color: courseColor(t.id, courses) }));
    if (grouping.hasOthers) keys.push({ id: '__others', name: `Others (${grouping.others.length})`, color: courseColor('__others') });
    return keys;
  }, [grouping, courses]);

  const visibleStackKeys = courseFilter === 'all' ? stackKeys : stackKeys.filter(k => k.id === courseFilter);

  const kpis = useMemo(() => {
    let total = 0, peak = 0, peakLabel = '—';
    groupedSeries.forEach(row => {
      const sum = visibleStackKeys.reduce((a, k) => a + (row[k.id] || 0), 0);
      total += sum;
      if (sum > peak) { peak = sum; peakLabel = row.label; }
    });
    const avg = groupedSeries.length > 0 ? Math.round(total / groupedSeries.length) : 0;
    let streak = 0;
    if (range === 'week') {
      for (let i = groupedSeries.length - 1; i >= 0; i--) {
        const s = visibleStackKeys.reduce((a, k) => a + (groupedSeries[i][k.id] || 0), 0);
        if (s > 0) streak++; else break;
      }
    } else {
      streak = groupedSeries.filter(r => visibleStackKeys.reduce((a, k) => a + (r[k.id] || 0), 0) > 0).length;
    }
    return { total, avg, peak, peakLabel, streak };
  }, [groupedSeries, visibleStackKeys, range]);

  const breakdown = useMemo(() => {
    const items = grouping.top.map(t => ({
      id: t.id, name: t.name, code: t.code, total: t.total,
      color: courseColor(t.id, courses),
    }));
    if (grouping.hasOthers) {
      const otherTotal = grouping.others.reduce((a, o) => a + o.total, 0);
      items.push({ id: '__others', name: 'Others', code: `${grouping.others.length} courses`, total: otherTotal, color: courseColor('__others') });
    }
    return items;
  }, [grouping, courses]);

  const grandTotal = breakdown.reduce((a, c) => a + c.total, 0);
  const rangeLabel = { week: 'this week', month: 'this month', year: 'this year' }[range];
  const xAxisHint = range === 'month' ? Math.ceil(series.length / 10) : 0;

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-[1280px] w-full mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-medium">Analytics</div>
          <h1 className="font-display mt-1 text-[26px] md:text-[30px] text-slate-100" style={{ letterSpacing: '-0.5px' }}>Stats</h1>
          <div className="mt-1.5 text-[12.5px] text-slate-500">
            All courses · {rangeLabel}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex p-1 rounded-lg bg-slate-900/60 border border-slate-800">
            {[{ id: 'week', label: 'Weekly' }, { id: 'month', label: 'Monthly' }, { id: 'year', label: 'Yearly' }].map(r => (
              <button key={r.id} onClick={() => setRange(r.id)}
                className={`relative px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors
                  ${range === r.id ? 'text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {range === r.id && (
                  <motion.div layoutId="range-pill" className="absolute inset-0 bg-slate-800 border border-slate-700 rounded-md"
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }} />
                )}
                <span className="relative">{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total studied" value={formatHMS(kpis.total * 60)} sub={courseFilter === 'all' ? `across ${courses.length} course${courses.length===1?'':'s'}` : '1 course filtered'} icon="Clock" />
        <KpiCard label="Daily average" value={`${Math.floor(kpis.avg/60)}h ${kpis.avg%60}m`} sub={range === 'year' ? 'per month' : 'per day'} icon="Activity" />
        <KpiCard label="Best session" value={`${Math.floor(kpis.peak/60)}h ${kpis.peak%60}m`} sub={`on ${kpis.peakLabel}`} icon="TrendingUp" accent />
        <KpiCard label={range === 'week' ? 'Current streak' : 'Active periods'} value={`${kpis.streak}`} sub={range === 'week' ? 'days in a row' : `of ${groupedSeries.length}`} icon="Flame" />
      </div>

      {/* Stacked chart */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5">
        <div className="flex items-start justify-between gap-3 mb-4 flex-col lg:flex-row">
          <div className="shrink-0">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-slate-500 font-medium">Time studied</div>
            <div className="mt-1 text-[15px] text-slate-200 font-medium">
              {grouping.hasOthers ? `Top ${MAX_VISIBLE_COURSES} courses + others · ${rangeLabel}` : `All courses, stacked · ${rangeLabel}`}
            </div>
          </div>
          {/* Course filter chips — styled horizontal scroll */}
          <div className="w-full lg:max-w-[60%] relative">
            <div className="flex items-center gap-1.5 overflow-x-auto chips-scroll pb-1.5 -mx-1 px-1">
              <FilterChip active={courseFilter === 'all'} onClick={() => setCourseFilter('all')}>
                <span className="w-2 h-2 rounded-full bg-slate-300" /> All
              </FilterChip>
              {stackKeys.map(k => (
                <FilterChip key={k.id} active={courseFilter === k.id} onClick={() => setCourseFilter(k.id)}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: k.color }} />
                  <span className="whitespace-nowrap">{k.name}</span>
                </FilterChip>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-slate-900/40 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-slate-900/40 to-transparent" />
          </div>
        </div>

        <div className="h-[280px] -mx-2">
          <RC width="100%" height="100%">
            <BarChart data={groupedSeries} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap={range === 'month' ? '12%' : '22%'}>
              <CartesianGrid stroke="rgba(148,163,184,0.06)" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} interval={xAxisHint} tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={v => v >= 60 ? `${Math.round(v/60)}h` : `${v}m`} width={36} />
              <Tooltip
                cursor={{ fill: 'rgba(148,163,184,0.05)' }}
                contentStyle={{ background: 'oklch(0.20 0.01 250)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 8, fontSize: 12, color: '#e2e8f0', padding: '8px 10px' }}
                labelStyle={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}
                formatter={(v, name) => {
                  const key = stackKeys.find(k => k.id === name);
                  const h = Math.floor(v/60), m = v%60;
                  return [h ? `${h}h ${m}m` : `${m}m`, key ? key.name : name];
                }}
              />
              {visibleStackKeys.map((k, i) => (
                <Bar key={k.id} dataKey={k.id} stackId="time" fill={k.color}
                  radius={i === visibleStackKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </RC>
        </div>
      </div>

      {/* Trend + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-slate-800/80 bg-slate-900/40 p-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-slate-500 font-medium">Combined trend</div>
              <div className="mt-1 text-[15px] text-slate-200 font-medium">Grand total over time</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[20px] text-slate-100 tabular-nums">{Math.floor(grandTotal/60)}h {grandTotal%60}m</div>
              <div className="text-[11px] text-slate-500">grand total · {rangeLabel}</div>
            </div>
          </div>
          <div className="h-[200px] -mx-2 mt-2">
            <RC width="100%" height="100%">
              <AreaChart data={groupedSeries} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.17 155)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.55 0.14 155)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.06)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} interval={xAxisHint} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => v >= 60 ? `${Math.round(v/60)}h` : `${v}m`} width={36} />
                <Tooltip
                  cursor={{ stroke: 'rgba(148,163,184,0.18)' }}
                  contentStyle={{ background: 'oklch(0.20 0.01 250)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 8, fontSize: 12, color: '#e2e8f0', padding: '6px 10px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                  formatter={v => [`${Math.floor(v/60)}h ${v%60}m`, 'Total']}
                />
                <Area type="monotone" dataKey={row => visibleStackKeys.reduce((a, k) => a + (row[k.id] || 0), 0)}
                  name="total" stroke="oklch(0.78 0.17 155)" strokeWidth={2} fill="url(#totalGrad)" />
              </AreaChart>
            </RC>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-slate-500 font-medium">Course breakdown</div>
          <div className="mt-1 text-[15px] text-slate-200 font-medium">Share of total · {rangeLabel}</div>

          <div className="mt-4 h-[140px] grid place-items-center">
            <RC width="100%" height="100%">
              <PieChart>
                <Pie data={breakdown} dataKey="total" innerRadius={42} outerRadius={62} paddingAngle={2} stroke="none">
                  {breakdown.map(c => <Cell key={c.id} fill={c.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'oklch(0.20 0.01 250)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 8, fontSize: 12, color: '#e2e8f0', padding: '6px 10px' }}
                  formatter={(v, _, p) => [`${Math.floor(v/60)}h ${v%60}m`, p.payload.name]}
                />
              </PieChart>
            </RC>
          </div>

          {/* Course breakdown list — scrollable */}
          <ul className="mt-3 space-y-2 max-h-[200px] overflow-y-auto thin-scroll pr-1">
            {breakdown.map(c => {
              const pct = grandTotal > 0 ? Math.round((c.total / grandTotal) * 100) : 0;
              return (
                <li key={c.id} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12.5px] text-slate-200 truncate">
                        {c.name}
                        {c.id === '__others' && <span className="ml-1.5 text-[11px] text-slate-500">({c.code})</span>}
                      </span>
                      <span className="font-mono text-[11.5px] text-slate-400 tabular-nums">{Math.floor(c.total/60)}h {c.total%60}m</span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums w-8 text-right">{pct}%</span>
                </li>
              );
            })}
            <li className="pt-2 mt-2 border-t border-slate-800/60 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full shrink-0 bg-slate-300" />
              <div className="flex-1 flex items-baseline justify-between">
                <span className="text-[12.5px] text-slate-100 font-medium">Grand total</span>
                <span className="font-mono text-[12px] text-slate-100 tabular-nums">{Math.floor(grandTotal/60)}h {grandTotal%60}m</span>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Per-course mini charts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-slate-500 font-medium">Per-course detail</div>
          <div className="text-[11px] text-slate-500">
            {grouping.hasOthers ? `Top ${MAX_VISIBLE_COURSES} · ${rangeLabel}` : rangeLabel}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {grouping.top.map(t => {
            const c = courses.find(x => x.id === t.id);
            if (!c) return null;
            const color = courseColor(c.id, courses);
            const peak = groupedSeries.reduce((m, row) => Math.max(m, row[c.id] || 0), 0);
            return (
              <div key={c.id} className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                      <span className="text-[10.5px] uppercase tracking-[0.12em] text-slate-500 font-medium">{c.code || c.name}</span>
                    </div>
                    <div className="mt-1 text-[14px] text-slate-100 font-medium truncate">{c.name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-[16px] text-slate-100 tabular-nums">{Math.floor(t.total/60)}h {t.total%60}m</div>
                    <div className="text-[10.5px] text-slate-500">peak {peak}m</div>
                  </div>
                </div>
                <div className="h-[80px] mt-2 -mx-1">
                  <RC width="100%" height="100%">
                    <AreaChart data={groupedSeries} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`g-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Tooltip
                        contentStyle={{ background: 'oklch(0.20 0.01 250)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 8, fontSize: 11, color: '#e2e8f0', padding: '4px 8px' }}
                        labelStyle={{ color: '#94a3b8', fontSize: 10 }}
                        formatter={v => [`${v}m`, c.name]}
                      />
                      <Area type="monotone" dataKey={c.id} stroke={color} strokeWidth={1.5} fill={`url(#g-${c.id})`} />
                    </AreaChart>
                  </RC>
                </div>
              </div>
            );
          })}

          {grouping.hasOthers && (() => {
            const total = grouping.others.reduce((a, o) => a + o.total, 0);
            const peak = groupedSeries.reduce((m, row) => Math.max(m, row.__others || 0), 0);
            const color = courseColor('__others');
            return (
              <div key="__others" className="rounded-xl border border-slate-800/60 bg-slate-900/20 p-4 border-dashed">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                      <span className="text-[10.5px] uppercase tracking-[0.12em] text-slate-500 font-medium">{grouping.others.length} courses</span>
                    </div>
                    <div className="mt-1 text-[14px] text-slate-200 font-medium truncate">Others</div>
                    <div className="mt-1 text-[11px] text-slate-500 truncate">
                      {grouping.others.slice(0,3).map(o=>o.name).join(' · ')}
                      {grouping.others.length > 3 ? ` · +${grouping.others.length-3} more` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-[16px] text-slate-100 tabular-nums">{Math.floor(total/60)}h {total%60}m</div>
                    <div className="text-[10.5px] text-slate-500">peak {peak}m</div>
                  </div>
                </div>
                <div className="h-[80px] mt-2 -mx-1">
                  <RC width="100%" height="100%">
                    <AreaChart data={groupedSeries} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="g-others" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Tooltip
                        contentStyle={{ background: 'oklch(0.20 0.01 250)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 8, fontSize: 11, color: '#e2e8f0', padding: '4px 8px' }}
                        labelStyle={{ color: '#94a3b8', fontSize: 10 }}
                        formatter={v => [`${v}m`, 'Others']}
                      />
                      <Area type="monotone" dataKey="__others" stroke={color} strokeWidth={1.5} fill="url(#g-others)" />
                    </AreaChart>
                  </RC>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top bar (mobile)
// ─────────────────────────────────────────────────────────────────────────────
function TopBar({ onOpenMenu, course, topic, onBack, mobileView }) {
  return (
    <div className="md:hidden flex items-center gap-3 px-4 h-14 backdrop-blur border-b border-slate-800/80 bg-slate-950/60">
      {mobileView === 'topics' && (
        <button onClick={onOpenMenu} className="p-1.5 -ml-1.5 text-slate-300">
          <Icon name="Menu" size={18} />
        </button>
      )}
      {mobileView !== 'topics' && (
        <button onClick={onBack} className="p-1.5 -ml-1.5 text-slate-300 flex items-center gap-1">
          <Icon name="ChevronLeft" size={18} />
          <span className="text-[13px]">Back</span>
        </button>
      )}
      <div className="flex-1 min-w-0 text-center">
        <div className="text-[10.5px] uppercase tracking-[0.1em] text-slate-500 truncate">{course?.code || course?.name}</div>
        <div className="text-[13px] text-slate-100 font-medium truncate">
          {mobileView === 'focus' ? (topic?.title ?? course?.name) : course?.name}
        </div>
      </div>
      <button className="p-1.5 -mr-1.5 text-slate-400">
        <Icon name="Search" size={18} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App root
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [authState, setAuthState]     = useState('checking'); // 'checking' | 'authenticated' | 'unauthenticated'
  const [currentUser, setCurrentUser] = useState(null);

  const [data, setData]             = useState({ courses: [] });
  const [stats, setStats]           = useState({ week: [], month: [], year: [] });
  const [totalTodaySec, setTodaySec] = useState(0);
  const [loading, setLoading]       = useState(false);

  const [activeCourseId, setActiveCourseId] = useState(null);
  const [activeTopicId, setActiveTopicId]   = useState(null);
  const [mobileNavOpen, setMobileNavOpen]   = useState(false);
  const [mobileView, setMobileView]         = useState('topics');
  const [view, setView]                     = useState('course');
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingTopicId, setEditingTopicId]   = useState(null);

  const activeCourse = useMemo(
    () => data.courses.find(c => c.id === activeCourseId) ?? data.courses[0] ?? null,
    [data, activeCourseId]
  );
  const activeTopic = useMemo(
    () => activeCourse?.topics.find(t => t.id === activeTopicId) ?? activeCourse?.topics[0] ?? null,
    [activeCourse, activeTopicId]
  );

  // ── Load all data from API ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [coursesRaw, topicsRaw] = await Promise.all([
        api.get('/courses'),
        api.get('/topics'),
      ]);

      const courses = coursesRaw.map(c => mapCourse(c, topicsRaw));
      setData({ courses });

      if (courses.length > 0 && !activeCourseId) {
        setActiveCourseId(courses[0].id);
        if (courses[0].topics.length > 0) setActiveTopicId(courses[0].topics[0].id);
      }

      const todayData = await api.get('/sessions/today-total');
      setTodaySec(todayData.totalSeconds || 0);

      const [w, m, y] = await Promise.all([
        api.get('/sessions/chart/weekly'),
        api.get('/sessions/chart/monthly'),
        api.get('/sessions/chart/yearly'),
      ]);

      setStats({
        week:  transformChartData(w.data || [], courses, 'week'),
        month: transformChartData(m.data || [], courses, 'month'),
        year:  transformChartData(y.data || [], courses, 'year'),
      });
    } catch (err) {
      console.error('loadData failed:', err);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    api.get('/auth/me')
      .then(user => {
        setCurrentUser(user);
        setAuthState('authenticated');
        api.post('/auth/claim').catch(() => {});
      })
      .catch(() => setAuthState('unauthenticated'));
  }, []); // eslint-disable-line

  useEffect(() => {
    if (authState === 'authenticated') loadData();
  }, [authState]); // eslint-disable-line

  // ── Refresh stats only ─────────────────────────────────────────────────
  const refreshStats = useCallback(async (courses) => {
    try {
      const [w, m, y] = await Promise.all([
        api.get('/sessions/chart/weekly'),
        api.get('/sessions/chart/monthly'),
        api.get('/sessions/chart/yearly'),
      ]);
      setStats({
        week:  transformChartData(w.data || [], courses, 'week'),
        month: transformChartData(m.data || [], courses, 'month'),
        year:  transformChartData(y.data || [], courses, 'year'),
      });
    } catch (e) { console.error('refreshStats:', e); }
  }, []);

  // ── Auth ───────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    localStorage.removeItem('jwt');
    try { await api.post('/auth/logout'); } catch (_) {}
    setAuthState('unauthenticated');
    setCurrentUser(null);
    setData({ courses: [] });
    setStats({ week: [], month: [], year: [] });
    setActiveCourseId(null);
    setActiveTopicId(null);
  };

  // ── Course handlers ────────────────────────────────────────────────────
  const handleSelectCourse = (id) => {
    setActiveCourseId(id);
    const c = data.courses.find(x => x.id === id);
    if (c?.topics[0]) setActiveTopicId(c.topics[0].id);
    setMobileView('topics');
    setView('course');
  };

  const handleAddCourse = async () => {
    try {
      const newCourse = await api.post('/courses', { name: 'Untitled course', code: '' });
      const newTopic  = await api.post('/topics', { courseId: newCourse.id, name: 'Untitled topic' });
      const cid = String(newCourse.id);
      const tid = String(newTopic.id);

      setData(prev => ({
        ...prev,
        courses: [...prev.courses, {
          id: cid, name: newCourse.name, code: newCourse.code || '',
          topics: [mapTopic(newTopic)],
        }],
      }));
      setActiveCourseId(cid);
      setActiveTopicId(tid);
      setView('course');
      setEditingCourseId(cid);
    } catch (e) { console.error('addCourse:', e); }
  };

  const handleRenameCourse = async (courseId, name) => {
    const course = data.courses.find(c => c.id === courseId);
    try {
      const updated = await api.put(`/courses/${courseId}`, { name, code: course?.code || '' });
      setData(prev => ({
        ...prev,
        courses: prev.courses.map(c => c.id === courseId ? { ...c, name: updated.name } : c),
      }));
    } catch (e) { console.error('renameCourse:', e); }
    setEditingCourseId(null);
  };

  const handleDeleteCourse = async (courseId) => {
    try {
      await api.del(`/courses/${courseId}`);
      const remaining = data.courses.filter(c => c.id !== courseId);
      setData(prev => ({ ...prev, courses: remaining }));
      if (activeCourseId === courseId) {
        if (remaining.length > 0) {
          setActiveCourseId(remaining[0].id);
          setActiveTopicId(remaining[0].topics[0]?.id ?? null);
        } else {
          setActiveCourseId(null); setActiveTopicId(null);
        }
      }
    } catch (e) { console.error('deleteCourse:', e); }
  };

  // ── Topic handlers ─────────────────────────────────────────────────────
  const handleSelectTopic = (id) => {
    setActiveTopicId(id);
    setMobileView('focus');
  };

  const handleAddTopic = async () => {
    if (!activeCourseId) return;
    try {
      const newTopic = await api.post('/topics', {
        courseId: parseInt(activeCourseId),
        name: 'Untitled topic',
      });
      const tid = String(newTopic.id);
      setData(prev => ({
        ...prev,
        courses: prev.courses.map(c => c.id === activeCourseId
          ? { ...c, topics: [...c.topics, mapTopic(newTopic)] }
          : c),
      }));
      setActiveTopicId(tid);
      setEditingTopicId(tid);
    } catch (e) { console.error('addTopic:', e); }
  };

  const handleRenameTopic = async (topicId, title) => {
    const topic = activeCourse?.topics.find(t => t.id === topicId);
    try {
      const updated = await api.put(`/topics/${topicId}`, {
        name: title,
        notes: topic?.notes || '',
      });
      setData(prev => ({
        ...prev,
        courses: prev.courses.map(c => ({
          ...c,
          topics: c.topics.map(t => t.id === topicId ? { ...t, title: updated.name } : t),
        })),
      }));
    } catch (e) { console.error('renameTopic:', e); }
    setEditingTopicId(null);
  };

  const handleDeleteTopic = async (topicId) => {
    try {
      await api.del(`/topics/${topicId}`);
      setData(prev => ({
        ...prev,
        courses: prev.courses.map(c => c.id === activeCourseId
          ? { ...c, topics: c.topics.filter(t => t.id !== topicId) }
          : c),
      }));
      if (activeTopicId === topicId) {
        const remaining = activeCourse?.topics.filter(t => t.id !== topicId) || [];
        setActiveTopicId(remaining[0]?.id ?? null);
      }
    } catch (e) { console.error('deleteTopic:', e); }
  };

  // ── Session save ───────────────────────────────────────────────────────
  const handleSaveSession = async (elapsedSeconds) => {
    if (elapsedSeconds < 1 || !activeTopicId) return;
    const endTime   = new Date();
    const startTime = new Date(endTime.getTime() - Math.round(elapsedSeconds) * 1000);

    try {
      await api.post('/sessions', {
        topicId:   parseInt(activeTopicId),
        startTime: toISO(startTime),
        endTime:   toISO(endTime),
      });

      const updatedTopic = await api.get(`/topics/${activeTopicId}`);
      setData(prev => ({
        ...prev,
        courses: prev.courses.map(c => c.id !== activeCourseId ? c : {
          ...c,
          topics: c.topics.map(t => t.id === activeTopicId ? mapTopic(updatedTopic) : t),
        }),
      }));

      const todayData = await api.get('/sessions/today-total');
      setTodaySec(todayData.totalSeconds || 0);

      await refreshStats(data.courses);
    } catch (e) { console.error('saveSession:', e); }
  };

  // ── Notes update ───────────────────────────────────────────────────────
  const handleUpdateNotes = async (value) => {
    if (!activeTopicId) return;
    try {
      await api.patch(`/topics/${activeTopicId}/notes`, { notes: value });
      setData(prev => ({
        ...prev,
        courses: prev.courses.map(c => c.id !== activeCourseId ? c : {
          ...c,
          topics: c.topics.map(t => t.id !== activeTopicId ? t : { ...t, notes: value }),
        }),
      }));
    } catch (e) { console.error('updateNotes:', e); }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  if (authState === 'checking') return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-950">
      <Icon name="Loader2" size={24} className="animate-spin text-emerald-400" />
    </div>
  );
  if (authState === 'unauthenticated') return <LandingPage />;

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-950">
      <div className="flex items-center gap-3 text-slate-500">
        <Icon name="Loader2" size={20} className="animate-spin text-emerald-400" />
        <span className="text-[14px]">Loading your data…</span>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-950 text-slate-200">
      <CourseRail
        courses={data.courses}
        activeCourseId={activeCourseId}
        onSelect={handleSelectCourse}
        totalTodaySec={totalTodaySec}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        view={view}
        onChangeView={setView}
        onAddCourse={handleAddCourse}
        onRenameCourse={handleRenameCourse}
        onDeleteCourse={handleDeleteCourse}
        editingCourseId={editingCourseId}
        onStartEditCourse={id => setEditingCourseId(id)}
        onCancelEditCourse={() => setEditingCourseId(null)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          onOpenMenu={() => setMobileNavOpen(true)}
          course={activeCourse}
          topic={activeTopic}
          onBack={() => setMobileView('topics')}
          mobileView={mobileView}
        />

        <div className="flex-1 flex min-h-0">
          {view === 'stats' ? (
            <div className="flex-1 min-w-0 min-h-0 overflow-y-auto thin-scroll">
              <StatsView courses={data.courses} stats={stats} />
            </div>
          ) : (
            <>
              {/* Topic list pane */}
              <div className={`
                ${mobileView === 'topics' ? 'flex' : 'hidden'} md:flex
                flex-col w-full md:w-[340px] md:shrink-0 md:border-r md:border-slate-800/80 min-h-0
              `}>
                {activeCourse ? (
                  <TopicList
                    course={activeCourse}
                    activeTopicId={activeTopicId}
                    onSelect={handleSelectTopic}
                    onAdd={handleAddTopic}
                    onDeleteTopic={handleDeleteTopic}
                    onRenameTopic={handleRenameTopic}
                    editingTopicId={editingTopicId}
                    onStartEditTopic={id => setEditingTopicId(id)}
                    onCancelEditTopic={() => setEditingTopicId(null)}
                    onRenameCourse={handleRenameCourse}
                    editingCourseId={editingCourseId}
                    onStartEditCourse={id => setEditingCourseId(id)}
                    onCancelEditCourse={() => setEditingCourseId(null)}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center px-6">
                      <div className="w-12 h-12 rounded-xl bg-slate-900/60 border border-slate-800 grid place-items-center mx-auto mb-3">
                        <Icon name="BookOpen" size={20} className="text-slate-500" />
                      </div>
                      <p className="text-[13px] text-slate-400 mb-3">No courses yet</p>
                      <button onClick={handleAddCourse}
                        className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[12.5px] font-semibold transition-colors">
                        Add first course
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Focus pane */}
              <div className={`
                ${mobileView === 'focus' ? 'flex' : 'hidden'} md:flex
                flex-1 flex-col min-w-0 min-h-0 overflow-y-auto thin-scroll
              `}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTopic?.id ?? 'none'}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="p-5 md:p-8 space-y-5 max-w-[1100px] w-full mx-auto"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-medium">
                          {activeCourse?.name}
                        </div>
                        <h1 className="font-display mt-1 text-[24px] md:text-[28px] text-slate-100 truncate" style={{ letterSpacing: '-0.4px' }}>
                          {activeTopic?.title ?? 'No topic selected'}
                        </h1>
                      </div>
                    </div>

                    {activeTopic && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 grid place-items-center shrink-0">
                            <Icon name="Clock" size={15} className="text-emerald-400" />
                          </div>
                          <div>
                            <div className="text-[10.5px] uppercase tracking-[0.1em] text-slate-500 font-medium">Total studied</div>
                            <div className="font-mono text-[20px] text-emerald-300 tabular-nums tracking-tight leading-none mt-0.5">{formatHMS(activeTopic.totalSec)}</div>
                          </div>
                        </div>
                        {activeTopic.lastStudied && (
                          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 px-4 py-3 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800/60 border border-slate-700/60 grid place-items-center shrink-0">
                              <Icon name="Calendar" size={15} className="text-slate-400" />
                            </div>
                            <div>
                              <div className="text-[10.5px] uppercase tracking-[0.1em] text-slate-500 font-medium">Last studied</div>
                              <div className="text-[15px] text-slate-200 mt-0.5">{relativeDate(activeTopic.lastStudied)}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <StopwatchPanel topic={activeTopic} onSave={handleSaveSession} />
                      <NotesPanel topic={activeTopic} onChange={handleUpdateNotes} />
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
