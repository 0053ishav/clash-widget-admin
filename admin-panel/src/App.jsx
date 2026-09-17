import { useEffect, useMemo, useState } from "react";
import { ResourceType } from "./types/resource";

const BASE_URL = "https://clashwidget.online";
const CDN_URL = "https://cdn.clashwidget.online";
const CRAFTED_PATH = "/v2/crafted";

const TIMEZONES = [
  { value: "UTC", label: "UTC", iana: "UTC", offsetLabel: "UTC+00:00" },
  { value: "IST", label: "IST (India)", iana: "Asia/Kolkata", offsetLabel: "UTC+05:30" },
];

const RESOURCE_TYPES = [
  { value: ResourceType.GOLD, label: "Gold", key: "GOLD" },
  { value: ResourceType.ELIXIR, label: "Elixir", key: "ELIXIR" },
  { value: ResourceType.DARK_ELIXIR, label: "Dark Elixir", key: "DARK_ELIXIR" },
  { value: ResourceType.BUILDER_GOLD, label: "Builder Gold", key: "BUILDER_GOLD" },
  { value: ResourceType.BUILDER_ELIXIR, label: "Builder Elixir", key: "BUILDER_ELIXIR" },
  { value: ResourceType.GEMS, label: "Gems", key: "GEMS" },
  { value: ResourceType.SEASON_POINTS, label: "Season Points", key: "SEASON_POINTS" },
  { value: ResourceType.GOLD_OR_ELIXIR, label: "Gold or Elixir", key: "GOLD_OR_ELIXIR" },
  { value: ResourceType.BUILDER_GOLD_OR_ELIXIR, label: "Builder Gold or Elixir", key: "BUILDER_GOLD_OR_ELIXIR" },
];

const getResourceLabel = (value) =>
  RESOURCE_TYPES.find((resource) => resource.value === Number(value))?.label ||
  `Unknown (${value})`;

const getCraftedImageUrl = (dataId, level = 1) =>
  `${CDN_URL}${CRAFTED_PATH}/${dataId}/${level}.png`;

const createModuleId = (metadata) => {
  const ids = Object.values(metadata)
    .flatMap((defense) => Object.keys(defense.modules || {}))
    .map(Number)
    .filter(Number.isFinite);
  return String(Math.max(102000000, ...ids) + 1);
};

const createDefenseId = (metadata) => {
  const ids = Object.keys(metadata).map(Number).filter(Number.isFinite);
  return Math.max(103000000, ...ids) + 1;
};

const emptyModule = () => ({
  name: "",
  stat: "",
  resource: ResourceType.GOLD,
});

const normaliseMetadata = (metadata) => {
  const output = {};
  for (const [id, defense] of Object.entries(metadata || {})) {
    output[id] = {
      ...defense,
      modules: Object.fromEntries(
        Object.entries(defense.modules || {}).map(([moduleId, module]) => [
          moduleId,
          {
            ...module,
            resource: Number(module.resource ?? ResourceType.GOLD),
          },
        ]),
      ),
    };
  }
  return output;
};

export default function App() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [apiStatus, setApiStatus] = useState("checking");
  const [lastHealthCheck, setLastHealthCheck] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem("admin-theme") || "light");
  const [token, setToken] = useState(localStorage.getItem("admin-token") || "");
  const [route, setRoute] = useState("crafted");
  const [craftedFilter, setCraftedFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [eventTimezone, setEventTimezone] = useState(localStorage.getItem("admin-timezone") || "IST");
  const [goblin, setGoblin] = useState(null);
  const [craftedMetadata, setCraftedMetadata] = useState({});
  const [event, setEvent] = useState({
    version: "",
    name: "",
    availableFromTH: 11,
    availableForTH: 18,
    duration: { start: Date.now(), end: Date.now() },
    defenses: [],
  });

  const sortedDefenses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return Object.entries(craftedMetadata)
      .filter(([id, defense]) => {
        const selected = event.defenses?.includes(Number(id));
        if (craftedFilter === "included" && !selected) return false;
        if (craftedFilter === "excluded" && selected) return false;
        if (!normalizedSearch) return true;
        return (
          id.includes(normalizedSearch) ||
          String(defense.name || "").toLowerCase().includes(normalizedSearch)
        );
      })
      .sort(([a], [b]) => Number(a) - Number(b));
  }, [craftedMetadata, event.defenses, craftedFilter, search]);

  const defenseEntries = Object.entries(craftedMetadata);
  const includedCount = defenseEntries.filter(([id]) =>
    event.defenses?.includes(Number(id)),
  ).length;
  const moduleCount = defenseEntries.reduce(
    (total, [, defense]) => total + Object.keys(defense.modules || {}).length,
    0,
  );

  const loadCrafted = async () => {
    setFetching(true);
    try {
      const [metadataRes, eventRes] = await Promise.all([
        fetch(`${BASE_URL}/v2/metadata/crafted-defenses`),
        fetch(`${BASE_URL}/v2/events/crafted-defenses-event`),
      ]);
      if (!metadataRes.ok || !eventRes.ok) throw new Error();
      const metadata = await metadataRes.json();
      const eventData = await eventRes.json();
      setCraftedMetadata(normaliseMetadata(metadata));
      setEvent(eventData);
    } catch {
      alert("Failed to load Crafted data ❌");
    } finally {
      setFetching(false);
    }
  };

  const loadGoblin = async () => {
    try {
      const res = await fetch(`${BASE_URL}/v2/events/goblin-config`, {
        headers: { "x-admin-token": token },
      });
      if (!res.ok) throw new Error();
      setGoblin(await res.json());
    } catch {
      alert("Failed to load Goblin config ❌");
    }
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("admin-theme", theme);
  }, [theme]);

  const checkApiHealth = async ({ silent = false } = {}) => {
    if (!silent) setApiStatus("checking");
    try {
      const res = await fetch(`${BASE_URL}/health`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setApiStatus(data?.status === "ok" ? "online" : "offline");
      setLastHealthCheck(Date.now());
      sessionStorage.setItem("admin-last-health-check", String(Date.now()));
    } catch {
      setApiStatus("offline");
      setLastHealthCheck(Date.now());
      sessionStorage.setItem("admin-last-health-check", String(Date.now()));
    }
  };

  useEffect(() => {
    // Health is checked once when the admin opens. We intentionally do not poll
    // continuously; the API can also be checked manually with Refresh.
    checkApiHealth();

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const last = Number(sessionStorage.getItem("admin-last-health-check") || 0);
      if (Date.now() - last >= 5 * 60 * 1000) {
        sessionStorage.setItem("admin-last-health-check", String(Date.now()));
        checkApiHealth({ silent: true });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (token && route === "crafted") loadCrafted();
  }, [token, route]);

  useEffect(() => {
    if (token && route === "goblin") loadGoblin();
  }, [token, route]);

  const login = async () => {
    const password = prompt("Enter admin password");
    if (!password) return;
    try {
      const res = await fetch(`${BASE_URL}/v1/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      localStorage.setItem("admin-token", data.token);
      setToken(data.token);
    } catch {
      alert("Login failed ❌");
    }
  };

  const logout = () => {
    localStorage.removeItem("admin-token");
    setToken("");
  };

  const updateDefense = (id, patch) => {
    setCraftedMetadata((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const updateModule = (defenseId, moduleId, patch) => {
    setCraftedMetadata((prev) => ({
      ...prev,
      [defenseId]: {
        ...prev[defenseId],
        modules: {
          ...prev[defenseId].modules,
          [moduleId]: {
            ...prev[defenseId].modules[moduleId],
            ...patch,
          },
        },
      },
    }));
  };

  const addDefense = () => {
    const id = createDefenseId(craftedMetadata);
    setCraftedMetadata((prev) => ({
      ...prev,
      [id]: { name: "New Crafted Defense", modules: {} },
    }));
    setEvent((prev) => ({
      ...prev,
      defenses: [...new Set([...(prev.defenses || []), id])],
    }));
  };

  const deleteDefense = (id) => {
    if (!window.confirm(`Delete crafted defense ${id}?`)) return;
    setCraftedMetadata((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setEvent((prev) => ({
      ...prev,
      defenses: prev.defenses.filter((defenseId) => defenseId !== Number(id)),
    }));
  };

  const addModule = (defenseId) => {
    const moduleId = createModuleId(craftedMetadata);
    setCraftedMetadata((prev) => ({
      ...prev,
      [defenseId]: {
        ...prev[defenseId],
        modules: {
          ...prev[defenseId].modules,
          [moduleId]: emptyModule(),
        },
      },
    }));
  };

  const deleteModule = (defenseId, moduleId) => {
    if (!window.confirm(`Delete module ${moduleId}?`)) return;
    setCraftedMetadata((prev) => {
      const modules = { ...prev[defenseId].modules };
      delete modules[moduleId];
      return {
        ...prev,
        [defenseId]: { ...prev[defenseId], modules },
      };
    });
  };

  const toggleDefenseForEvent = (id, checked) => {
    setEvent((prev) => ({
      ...prev,
      defenses: checked
        ? [...new Set([...(prev.defenses || []), Number(id)])]
        : prev.defenses.filter((x) => x !== Number(id)),
    }));
  };

  const saveCrafted = async () => {
    setLoading(true);
    try {
      // craftedMetadata is the complete metadata document loaded from
      // /v2/metadata/crafted-defenses, so the admin API can safely write/merge
      // the complete object. The event endpoint replaces the whole event file.
      const metadataRes = await fetch(`${BASE_URL}/v2/admin/metadata/crafted-defenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify(craftedMetadata),
      });

      if (!metadataRes.ok) throw new Error("Metadata save failed");

      const eventRes = await fetch(`${BASE_URL}/v2/admin/events/crafted-defenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify(event),
      });

      if (!eventRes.ok) throw new Error("Event save failed");
      alert("Crafted metadata + event saved ✅");
    } catch (error) {
      alert(`${error.message} ❌`);
    } finally {
      setLoading(false);
    }
  };

  const downloadMetadata = () => {
    const blob = new Blob([JSON.stringify(craftedMetadata, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "crafted-defenses.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const saveGoblin = async () => {
    try {
      const res = await fetch(`${BASE_URL}/v2/admin/events/goblin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({
          ...goblin,
          version: (goblin.version || 0) + 1,
          workForHireEvents: goblin.workForHireEvents || [],
        }),
      });
      if (!res.ok) throw new Error();
      alert("Saved Goblin Config ✅");
    } catch {
      alert("Save Failed ❌");
    }
  };

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-icon">⚔</div>
            <h1 className="login-title">Clash One</h1>
            <p className="page-header-description">Internal admin console</p>
          </div>
          <button onClick={login} className="btn btn-primary login-submit">
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-shell">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-brand-icon">C</div>
            <div>
              <div className="section-title">Clash One</div>
              <div className="sidebar-brand-subtitle">Admin</div>
            </div>
          </div>

          <nav className="sidebar-content">
            <NavItem active={route === "crafted"} icon="◈" label="Crafted" onClick={() => setRoute("crafted")} />
            <NavItem active={route === "goblin"} icon="◉" label="Goblin" onClick={() => setRoute("goblin")} />
          </nav>

          <div className="sidebar-footer">
            <div className="environment-card">
              <div className="environment-label">Environment</div>
              <div className="environment-status">
                <span className="status-dot online" /> Production
              </div>
            </div>
            <button onClick={logout} className="sidebar-signout">
              Sign out
            </button>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="topbar-inner">
              <div className="topbar-brand">
                <div className="mobile-brand-icon">C</div>
                <div>
                  <div className="section-title">{route === "crafted" ? "Crafted Defenses" : "Goblin"}</div>
                  <div className="topbar-subtitle">Clash One data administration</div>
                </div>
              </div>
              <div className="topbar-actions">
                <div className={`api-status ${apiStatus}`} title={lastHealthCheck ? `Last checked ${new Date(lastHealthCheck).toLocaleTimeString()}` : "Health check pending"}>
                  <span className={`status-dot ${apiStatus}`} />
                  <span>{apiStatus === "checking" ? "Checking API…" : apiStatus === "online" ? "API online" : "API offline"}</span>
                </div>
                <button onClick={() => { checkApiHealth(); route === "crafted" ? loadCrafted() : loadGoblin(); }} className="btn btn-secondary refresh-button">
                  ↻ Refresh
                </button>
                <button onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} className="theme-toggle" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
                  <span>{theme === "dark" ? "☀" : "☾"}</span>
                  <span>{theme === "dark" ? "Light" : "Dark"}</span>
                </button>
              </div>
            </div>
          </header>

          <main className="content">
            <div className="mobile-nav">
              <NavItem active={route === "crafted"} label="Crafted" onClick={() => setRoute("crafted")} />
              <NavItem active={route === "goblin"} label="Goblin" onClick={() => setRoute("goblin")} />
            </div>

            {route === "crafted" && (
              <>
                <div className="page-header">
                  <div>
                    <div className="breadcrumb">
                      <span>Events</span><span>/</span><span>Crafted Defenses</span>
                    </div>
                    <h1 className="page-header-title">Crafted Defenses</h1>
                    <p className="page-header-description">Manage Clash of Clans crafted defense metadata and event membership.</p>
                  </div>
                  <div className="page-header-actions">
                    <button onClick={downloadMetadata} className="btn btn-secondary">
                      ↓ Export metadata
                    </button>
                    <button onClick={addDefense} className="btn btn-primary">
                      + Add defense
                    </button>
                  </div>
                </div>

                <div className="stats-grid">
                  <StatCard label="Defenses" value={defenseEntries.length} detail="Metadata records" />
                  <StatCard label="In event" value={includedCount} detail={`${defenseEntries.length - includedCount} excluded`} />
                  <StatCard label="Modules" value={moduleCount} detail="Across all defenses" />
                  <StatCard label="Event TH" value={`${event.availableFromTH ?? "—"}–${event.availableForTH ?? "—"}`} detail="Town Hall range" />
                </div>

                <section className="card event-config-card">
                  <div className="section-header">
                    <div>
                      <div className="section-title">Event configuration</div>
                      <div className="section-description">Saved through the existing crafted-defenses event endpoint.</div>
                    </div>
                    <div className="filter-group">
                      <FilterButton active={craftedFilter === "all"} onClick={() => setCraftedFilter("all")}>All <span>{defenseEntries.length}</span></FilterButton>
                      <FilterButton active={craftedFilter === "included"} onClick={() => setCraftedFilter("included")}>In event <span>{includedCount}</span></FilterButton>
                      <FilterButton active={craftedFilter === "excluded"} onClick={() => setCraftedFilter("excluded")}>Not in event <span>{defenseEntries.length - includedCount}</span></FilterButton>
                    </div>
                  </div>
                  <div className="event-config-grid">
                    <Field label="Version"><input value={event.version || ""} onChange={(e) => setEvent((p) => ({ ...p, version: e.target.value }))} className={inputClass} /></Field>
                    <Field label="Event name" className="xl:col-span-2"><input value={event.name || ""} onChange={(e) => setEvent((p) => ({ ...p, name: e.target.value }))} className={inputClass} /></Field>
                    <Field label="From TH"><input type="number" min="1" value={event.availableFromTH ?? ""} onChange={(e) => setEvent((p) => ({ ...p, availableFromTH: Number(e.target.value) }))} className={inputClass} /></Field>
                    <Field label="To TH"><input type="number" min="1" value={event.availableForTH ?? ""} onChange={(e) => setEvent((p) => ({ ...p, availableForTH: Number(e.target.value) }))} className={inputClass} /></Field>
                    <Field label="Timezone">
                      <select
                        value={eventTimezone}
                        onChange={(e) => {
                          const value = e.target.value;
                          setEventTimezone(value);
                          localStorage.setItem("admin-timezone", value);
                        }}
                        className={inputClass}
                      >
                        {TIMEZONES.map((zone) => (
                          <option key={zone.value} value={zone.value}>
                            {zone.label} · {zone.offsetLabel}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={`Start · ${eventTimezone}`}><input type="datetime-local" value={toDateInput(event.duration?.start, eventTimezone)} onChange={(e) => setEvent((p) => ({ ...p, duration: { ...p.duration, start: parseDateInput(e.target.value, eventTimezone) } }))} className={inputClass} /></Field>
                    <Field label={`End · ${eventTimezone}`}><input type="datetime-local" value={toDateInput(event.duration?.end, eventTimezone)} onChange={(e) => setEvent((p) => ({ ...p, duration: { ...p.duration, end: parseDateInput(e.target.value, eventTimezone) } }))} className={inputClass} /></Field>
                  </div>
                </section>

                <div className="filter-toolbar">
                  <div className="search">
                    <span className="search-icon">⌕</span>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search defense or ID..." className={`${inputClass} pl-9`} />
                  </div>
                  <div className="stat-label">Showing {sortedDefenses.length} of {defenseEntries.length}</div>
                </div>

                {fetching && <div className="loading-card">Loading Crafted metadata…</div>}

                {!fetching && sortedDefenses.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-title">No defenses match this filter</div>
                    <div className="empty-state-description">Try another filter or search term.</div>
                  </div>
                )}

                {!fetching && sortedDefenses.length > 0 && (
                  <div className="defense-list">
                    {sortedDefenses.map(([id, defense]) => (
                      <DefenseRow
                        key={id}
                        id={id}
                        defense={defense}
                        selected={event.defenses?.includes(Number(id))}
                        onUpdate={updateDefense}
                        onDelete={deleteDefense}
                        onToggle={toggleDefenseForEvent}
                        onAddModule={addModule}
                        onUpdateModule={updateModule}
                        onDeleteModule={deleteModule}
                      />
                    ))}
                  </div>
                )}

                <div className="save-container">
                  <div className="save-bar">
                    <button onClick={saveCrafted} disabled={loading} className="btn btn-primary save-button">
                      {loading ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {route === "goblin" && goblin && <GoblinDashboard goblin={goblin} setGoblin={setGoblin} saveGoblin={saveGoblin} eventTimezone={eventTimezone} setEventTimezone={setEventTimezone} />}
          </main>
        </div>
      </div>
    </div>
  );
}

const inputClass = "input";

function NavItem({ active, icon, label, onClick }) {
  return (
    <button onClick={onClick} className={`sidebar-item ${active ? "active" : ""}`}>
      {icon && <span className="nav-icon">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

function FilterButton({ active, children, onClick }) {
  return <button onClick={onClick} className={`filter-button ${active ? "active" : ""}`}>{children}</button>;
}

function StatCard({ label, value, detail }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-description">{detail}</div>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return <label className={`field ${className}`}><span className="field-label">{label}</span>{children}</label>;
}

function Toggle({ checked, label, onChange }) {
  return (
    <label className="toggle-card">
      <span className="toggle-label">{label}</span>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="native-checkbox" />
    </label>
  );
}

function DefenseRow({ id, defense, selected, onUpdate, onDelete, onToggle, onAddModule, onUpdateModule, onDeleteModule }) {
  const imageUrl = getCraftedImageUrl(id, 1);
  const modules = Object.entries(defense.modules || {});

  return (
    <article className={`defense-card ${selected ? "selected" : ""}`}>
      <div className="defense-header">
        <div className="defense-identity">
          <div className="entity-icon-wrap">
            <img src={imageUrl} alt="" className="entity-icon" onError={(e) => { e.currentTarget.style.opacity = "0.15"; }} />
          </div>
          <div className="entity-info">
            <div className="entity-id-row">
              <span className={`status-dot ${selected ? "active" : ""}`} />
              <span className="entity-id">{id}</span>
            </div>
            <input value={defense.name || ""} onChange={(e) => onUpdate(id, { name: e.target.value })} className="entity-name-input" />
            <div className="url url-subtle">{imageUrl}</div>
          </div>
        </div>

        <div className="defense-info-grid">
          <InfoCell label="Modules" value={modules.length} />
          <InfoCell label="Event" value={selected ? "Included" : "Excluded"} />
          <InfoCell label="Asset" value="Level 1" />
          <InfoCell label="Resources" value={[...new Set(modules.map(([, m]) => getResourceLabel(m.resource)))].join(", ") || "—"} wide />
          <label className={`event-toggle ${selected ? "active" : ""}`}>
            <input type="checkbox" checked={!!selected} onChange={(e) => onToggle(id, e.target.checked)} className="native-checkbox" />
            Event
          </label>
        </div>

        <div className="defense-actions">
          <button onClick={() => onAddModule(id)} className="btn btn-secondary refresh-button">+ Module</button>
          <button onClick={() => onDelete(id)} className="btn btn-danger btn-sm">Delete</button>
        </div>
      </div>

      <div className="modules-panel">
        <div className="modules-header">
          <div className="modules-title">Modules</div>
          <div className="modules-note">Resource enum values 0–8</div>
        </div>
        {modules.length === 0 ? (
          <div className="module-empty">No modules configured.</div>
        ) : (
          <div className="module-list">
            {modules.map(([moduleId, module]) => (
              <div key={moduleId} className="module-row">
                <Field label="Module ID"><div className="module-id">{moduleId}</div></Field>
                <Field label="Name"><input value={module.name || ""} onChange={(e) => onUpdateModule(id, moduleId, { name: e.target.value })} placeholder="Hitpoints" className={inputClass} /></Field>
                <Field label="Stat"><input value={module.stat || ""} onChange={(e) => onUpdateModule(id, moduleId, { stat: e.target.value })} placeholder="hitpoints" className={inputClass} /></Field>
                <Field label={`Resource Type · ${getResourceLabel(module.resource)}`}>
                  <select value={Number(module.resource ?? ResourceType.GOLD)} onChange={(e) => onUpdateModule(id, moduleId, { resource: Number(e.target.value) })} className={inputClass}>
                    {RESOURCE_TYPES.map((resource) => <option key={resource.value} value={resource.value}>{resource.value} — {resource.label}</option>)}
                  </select>
                </Field>
                <button onClick={() => onDeleteModule(id, moduleId)} className="btn btn-danger btn-sm">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function InfoCell({ label, value, wide }) {
  return <div className={`info-cell ${wide ? "wide" : ""}`}><div className="info-label">{label}</div><div className="info-value">{value}</div></div>;
}

function GoblinDashboard({ goblin, setGoblin, saveGoblin, eventTimezone, setEventTimezone }) {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Events</span><span>/</span><span>Goblin</span></div>
          <h1 className="page-header-title">Goblin Work For Hire</h1>
          <p className="page-header-description">Configure Goblin Builder and Goblin Lab availability.</p>
        </div>
        <div className="page-header-actions">
          <Field label="Timezone">
            <select
              value={eventTimezone}
              onChange={(e) => {
                const value = e.target.value;
                setEventTimezone(value);
                localStorage.setItem("admin-timezone", value);
              }}
              className={inputClass}
            >
              {TIMEZONES.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label} · {zone.offsetLabel}
                </option>
              ))}
            </select>
          </Field>
          <button onClick={saveGoblin} className="btn btn-primary">Save configuration</button>
        </div>
      </div>

      <div className="goblin-toggles">
        <Toggle checked={goblin.goblinBuilderEnabled} label="Goblin Builder enabled" onChange={(checked) => setGoblin({ ...goblin, goblinBuilderEnabled: checked })} />
        <Toggle checked={goblin.goblinLabEnabled} label="Goblin Lab enabled" onChange={(checked) => setGoblin({ ...goblin, goblinLabEnabled: checked })} />
      </div>

      <section className="card goblin-events-card">
        <div className="section-header">
          <div>
            <div className="section-title">Availability windows</div>
            <div className="section-description">Each event replaces its stored date range.</div>
          </div>
          <button onClick={() => setGoblin({ ...goblin, workForHireEvents: [...(goblin.workForHireEvents || []), { startsAt: Date.now(), endsAt: Date.now() + 86400000 }] })} className="btn btn-secondary">+ Add window</button>
        </div>
        <div className="availability-list">
          {(!goblin.workForHireEvents || goblin.workForHireEvents.length === 0) && <div className="empty-state compact">No availability windows configured.</div>}
          {goblin.workForHireEvents?.map((item, index) => (
            <div key={index} className="availability-row">
              <Field label={`Starts at · ${eventTimezone}`}><input type="datetime-local" value={toDateInput(item.startsAt, eventTimezone)} onChange={(e) => updateGoblinEvent(setGoblin, goblin, index, "startsAt", e.target.value, eventTimezone)} className={inputClass} /></Field>
              <Field label={`Ends at · ${eventTimezone}`}><input type="datetime-local" value={toDateInput(item.endsAt, eventTimezone)} onChange={(e) => updateGoblinEvent(setGoblin, goblin, index, "endsAt", e.target.value, eventTimezone)} className={inputClass} /></Field>
              <button onClick={() => setGoblin({ ...goblin, workForHireEvents: goblin.workForHireEvents.filter((_, i) => i !== index) })} className="btn btn-danger btn-sm">Remove</button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function toDateInput(timestamp, timezone = "IST") {
  if (!timestamp) return "";

  const zone = TIMEZONES.find((item) => item.value === timezone) || TIMEZONES[1];
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone.iana,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function parseDateInput(value, timezone = "IST") {
  if (!value) return Date.now();

  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  // The admin only exposes UTC and IST, so keep conversion explicit and
  // independent of the browser's own local timezone.
  const offsetMinutes = timezone === "IST" ? 330 : 0;
  return Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60 * 1000;
}

function updateGoblinEvent(setGoblin, goblin, index, field, value, timezone = "IST") {
  const updated = [...goblin.workForHireEvents];
  updated[index] = { ...updated[index], [field]: parseDateInput(value, timezone) };
  setGoblin({ ...goblin, workForHireEvents: updated });
}
