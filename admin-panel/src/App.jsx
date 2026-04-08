import { useEffect, useState } from "react";

const BASE_URL = "https://clashwidget.online";

const DEFAULT_JSON = {
  version: "2026-04-v1",
  event: "April Crafted Event",
  updatedAt: Date.now(),
  duration: {
    start: Date.now(),
    end: Date.now() + 7 * 24 * 60 * 60 * 1000, // +7 days
  },
  defenses: {},
};

export default function App() {
  const [data, setData] = useState(DEFAULT_JSON);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [token, setToken] = useState(localStorage.getItem("admin-token") || "");
  const [showJson, setShowJson] = useState(false);
  const [route, setRoute] = useState("crafted");
  const [goblin, setGoblin] = useState(null);

  // Load mapping
  const loadMapping = async () => {
    try {
      setFetching(true);
      const res = await fetch(
        `${BASE_URL}/v1/admin/mappings/crafted-defenses`,
        { headers: { "x-admin-token": token } },
      );

      if (res.status === 401) {
        alert("Session expired 🔐");
        logout();
        return;
      }

      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      alert("Using fallback JSON ⚠️");
      setData(DEFAULT_JSON);
    } finally {
      setFetching(false);
    }
  };

  const loadGoblin = async () => {
    const res = await fetch(`${BASE_URL}/v1/admin/events/goblin`, {
      headers: {
        "x-admin-token": token,
      },
    });

    const data = await res.json();
    setGoblin(data);
  };

  useEffect(() => {
    if (token) loadMapping();
  }, [token]);

  useEffect(() => {
    if (token && route === "goblin") {
      loadGoblin();
    }
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

  const addDefense = () => {
    const id = prompt("Defense ID");
    const name = prompt("Defense Name");

    if (!id || !name) {
      alert("ID and Name required");
      return;
    }

    if (data.defenses[id]) {
      alert("Defense already exists");
      return;
    }

    const slug = name.toLowerCase().replace(/\s+/g, "-");
    const icon = `https://cdn.clashwidget.online/crafted/${slug}.png`;

    setData((prev) => ({
      ...prev,
      defenses: {
        ...prev.defenses,
        [id]: {
          name,
          icon,
          modules: {},
        },
      },
    }));
  };

  const deleteDefense = (id) => {
    if (!confirm(`Delete defense "${data.defenses[id].name}"?`)) return;
    const updated = { ...data.defenses };
    delete updated[id];
    setData({ ...data, defenses: updated });
  };

  const addModule = (defenseId) => {
    const id = prompt("Module ID");
    const name = prompt("Module Name");
    const stat = prompt("Stat key");
    if (!id || !name || !stat) return;

    if (data.defenses[defenseId].modules[id]) {
      alert("Module already exists");
      return;
    }
    setData((prev) => ({
      ...prev,
      defenses: {
        ...prev.defenses,
        [defenseId]: {
          ...prev.defenses[defenseId],
          modules: {
            ...prev.defenses[defenseId].modules,
            [id]: { name, stat },
          },
        },
      },
    }));
  };

  const deleteModule = (defenseId, moduleId) => {
    if (
      !confirm(
        `Delete module "${data.defenses[defenseId].modules[moduleId].name}"?`,
      )
    )
      return;
    const updatedModules = { ...data.defenses[defenseId].modules };
    delete updatedModules[moduleId];

    setData({
      ...data,
      defenses: {
        ...data.defenses,
        [defenseId]: {
          ...data.defenses[defenseId],
          modules: updatedModules,
        },
      },
    });
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const payload = { ...data, updatedAt: Date.now() };

      for (const [id, def] of Object.entries(data.defenses)) {
        if (!def.name || !def.icon) {
          alert(`Invalid defense: ${id}`);
          return;
        }

        if (!def.icon.startsWith("http")) {
          alert(`Invalid icon URL for ${def.name}`);
          return;
        }
      }

      const res = await fetch(
        `${BASE_URL}/v1/admin/mappings/crafted-defenses`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-token": token,
          },
          body: JSON.stringify(payload),
        },
      );

      if (res.status === 401) {
        alert("Session expired 🔐");
        logout();
        return;
      }

      if (!res.ok) throw new Error();
      alert("Saved ✅");
    } catch {
      alert("Save failed ❌");
    } finally {
      setLoading(false);
    }
  };

  const saveGoblin = async () => {
    await fetch(`${BASE_URL}/v1/admin/events/goblin`, {
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

    alert("Saved Goblin Config ✅");
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔐</div>
            <h2 className="text-2xl font-bold text-white mb-2">Admin Login</h2>
            <p className="text-slate-400">Enter your credentials to continue</p>
          </div>
          <button
            onClick={login}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-lg hover:shadow-blue-500/50"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">⚙️</div>
              <div>
                <h1 className="text-2xl font-bold">Admin Panel</h1>
              </div>
            </div>
            <div className="flex gap-4 mt-2">
              <button
                className="cursor-pointer"
                onClick={() => setRoute("crafted")}
              >
                Crafted
              </button>
              <button
                className="cursor-pointer"
                onClick={() => setRoute("goblin")}
              >
                Goblin
              </button>
            </div>
            <button
              onClick={logout}
              className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 px-4 py-2 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {route === "crafted" && (
        <>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Meta Info */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>📋</span> Event Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Version
                  </label>
                  <input
                    value={data.version}
                    onChange={(e) =>
                      setData({ ...data, version: e.target.value })
                    }
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Event Name
                  </label>
                  <input
                    value={data.event}
                    onChange={(e) =>
                      setData({ ...data, event: e.target.value })
                    }
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={new Date(data.duration.start)
                      .toISOString()
                      .slice(0, 16)}
                    onChange={(e) =>
                      setData({
                        ...data,
                        duration: {
                          ...data.duration,
                          start: new Date(e.target.value).getTime(),
                        },
                      })
                    }
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={new Date(data.duration.end)
                      .toISOString()
                      .slice(0, 16)}
                    onChange={(e) =>
                      setData({
                        ...data,
                        duration: {
                          ...data.duration,
                          end: new Date(e.target.value).getTime(),
                        },
                      })
                    }
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={loadMapping}
                  disabled={fetching}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  {fetching ? "⏳" : "🔄"} Reload
                </button>
                <button
                  onClick={addDefense}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  ➕ Add Defense
                </button>
                <button
                  onClick={() => setShowJson(!showJson)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  📦 {showJson ? "Hide" : "Show"} JSON
                </button>
              </div>
            </div>

            {/* JSON Preview */}
            {showJson && (
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">📦 JSON Preview</h3>
                <pre className="bg-slate-950 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            )}

            {/* Defenses */}
            <div className="space-y-4 mb-6">
              {Object.entries(data.defenses).length === 0 ? (
                <div className="bg-slate-800/30 border-2 border-dashed border-slate-700 rounded-xl p-12 text-center">
                  <div className="text-5xl mb-4">🎯</div>
                  <h3 className="text-xl font-semibold mb-2">
                    No Defenses Yet
                  </h3>
                  <p className="text-slate-400 mb-4">
                    Click "Add Defense" to get started
                  </p>
                </div>
              ) : (
                Object.entries(data.defenses).map(([id, def]) => (
                  <div
                    key={id}
                    className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={def.icon}
                          alt={def.name}
                          className="w-10 h-10 rounded bg-slate-900 border"
                          onError={(e) => {
                            e.currentTarget.src =
                              "https://cdn.clashwidget.online/crafted/default.png";
                          }}
                        />
                        <button
                          onClick={() => {
                            const newIcon = prompt("Update Icon URL", def.icon);

                            if (!newIcon || !newIcon.startsWith("http")) {
                              alert("Invalid icon URL");
                              return;
                            }

                            setData((prev) => ({
                              ...prev,
                              defenses: {
                                ...prev.defenses,
                                [id]: {
                                  ...prev.defenses[id],
                                  icon: newIcon,
                                },
                              },
                            }));
                          }}
                          className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-600/30 px-3 py-1.5 rounded-lg text-sm"
                        >
                          🖼 Icon
                        </button>
                        <div>
                          <h3 className="text-xl font-bold text-blue-400">
                            {def.name}
                          </h3>
                          <p className="text-sm text-slate-500 font-mono">
                            {id}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => addModule(id)}
                          className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 px-3 py-1.5 rounded-lg transition-colors text-sm"
                        >
                          ➕ Module
                        </button>
                        <button
                          onClick={() => deleteDefense(id)}
                          className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 px-3 py-1.5 rounded-lg transition-colors text-sm"
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>

                    {/* Modules */}
                    {Object.entries(def.modules).length === 0 ? (
                      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 text-center text-slate-500 text-sm">
                        No modules yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(def.modules).map(([mid, mod]) => (
                          <div
                            key={mid}
                            className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 flex items-center justify-between hover:bg-slate-900/70 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="font-semibold text-white">
                                {mod.name}
                              </div>
                              <div className="text-sm text-slate-400">
                                <span className="font-mono text-purple-400">
                                  {mid}
                                </span>
                                {" • "}
                                <span className="text-orange-400">
                                  {mod.stat}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => deleteModule(id, mid)}
                              className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 px-3 py-1.5 rounded-lg transition-colors text-sm"
                            >
                              ❌
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Save Button */}
            <div className="sticky bottom-4">
              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-blue-600/50 disabled:to-purple-600/50 text-white font-bold py-4 rounded-xl transition-all shadow-2xl hover:shadow-blue-500/50 text-lg"
              >
                {loading ? "⏳ Saving..." : "💾 Save Changes"}
              </button>
            </div>
          </div>
        </>
      )}

      {route === "goblin" && goblin && (
        <div className="max-w-4xl mx-auto p-6">
          <h2 className="text-2xl font-bold mb-6">🧝 Goblin Work For Hire</h2>

          {/* Toggles */}
          <div className="mb-6 space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={goblin.goblinBuilderEnabled}
                onChange={(e) =>
                  setGoblin({
                    ...goblin,
                    goblinBuilderEnabled: e.target.checked,
                  })
                }
              />
              Goblin Builder Enabled
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={goblin.goblinLabEnabled}
                onChange={(e) =>
                  setGoblin({
                    ...goblin,
                    goblinLabEnabled: e.target.checked,
                  })
                }
              />
              Goblin Lab Enabled
            </label>
          </div>

          {/* Events */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Work For Hire Events</h3>

            {(!goblin.workForHireEvents ||
              goblin.workForHireEvents.length === 0) && (
              <p className="text-slate-400 mb-4">No events configured</p>
            )}
            {goblin.workForHireEvents?.map((event, index) => (
              <div key={index} className="mb-4 p-4 border rounded-lg">
                <div className="flex gap-4">
                  <input
                    type="datetime-local"
                    value={
                      event.startsAt
                        ? new Date(event.startsAt).toISOString().slice(0, 16)
                        : ""
                    }
                    onChange={(e) => {
                      const updated = [...goblin.workForHireEvents];
                      updated[index].startsAt = new Date(
                        e.target.value,
                      ).getTime();
                      setGoblin({ ...goblin, workForHireEvents: updated });
                    }}
                  />

                  <input
                    type="datetime-local"
                    value={
                      event.endsAt
                        ? new Date(event.endsAt).toISOString().slice(0, 16)
                        : ""
                    }
                    onChange={(e) => {
                      const updated = [...goblin.workForHireEvents];
                      updated[index].endsAt = new Date(
                        e.target.value,
                      ).getTime();
                      setGoblin({ ...goblin, workForHireEvents: updated });
                    }}
                  />

                  <button
                    onClick={() => {
                      const updated = goblin.workForHireEvents.filter(
                        (_, i) => i !== index,
                      );
                      setGoblin({ ...goblin, workForHireEvents: updated });
                    }}
                  >
                    ❌
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() =>
                setGoblin({
                  ...goblin,
                  workForHireEvents: [
                    ...goblin.workForHireEvents,
                    {
                      startsAt: Date.now(),
                      endsAt: Date.now() + 86400000,
                    },
                  ],
                })
              }
            >
              ➕ Add Event
            </button>
          </div>

          {/* Save */}
          <button
            onClick={saveGoblin}
            className="bg-green-600 px-4 py-2 rounded"
          >
            💾 Save Goblin Config
          </button>
        </div>
      )}
    </div>
  );
}
