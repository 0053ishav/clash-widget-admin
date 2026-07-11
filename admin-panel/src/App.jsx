import { useEffect, useState } from "react";

const BASE_URL = "https://clashwidget.online";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [token, setToken] = useState(localStorage.getItem("admin-token") || "");
  const [route, setRoute] = useState("crafted");
  const [goblin, setGoblin] = useState(null);
  const [event, setEvent] = useState({
    version: "",
    name: "",
    availableFromTH: 18,
    availableForTH: 18,
    duration: {
      start: Date.now(),
      end: Date.now(),
    },
    defenses: [],
  });

  const [craftedMetadata, setCraftedMetadata] = useState({});

  const loadCrafted = async () => {
    setFetching(true);

    try {
      const [metadataRes, eventRes] = await Promise.all([
        fetch(`${BASE_URL}/v2/metadata/crafted-defense`),
        fetch(`${BASE_URL}/v2/events/crafted-defense-event`),
      ]);

      if (!metadataRes.ok || !eventRes.ok) {
        throw new Error();
      }

      const metadata = await metadataRes.json();
      const event = await eventRes.json();

      setCraftedMetadata(metadata);
      setEvent(event);
    } finally {
      setFetching(false);
    }
  };

  const loadGoblin = async () => {
    const res = await fetch(`${BASE_URL}/v2/events/goblin-config`, {
      headers: {
        "x-admin-token": token,
      },
    });

    const data = await res.json();
    setGoblin(data);
  };

  useEffect(() => {
    if (token && route === "crafted") {
      loadCrafted();
    }
  }, [token, route]);

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

  const saveCraftedEvent = async () => {
    setLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/v2/admin/events/crafted-defense-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify(event),
      });

      if (!res.ok) throw new Error();

      alert("Crafted Event Saved ✅");
    } catch {
      alert("Save Failed ❌");
    } finally {
      setLoading(false);
    }
  };

  const saveGoblin = async () => {
    await fetch(`${BASE_URL}/v2/admin/events/goblin`, {
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
                    value={event.version}
                    onChange={(e) =>
                      setEvent((prev) => ({ ...prev, version: e.target.value }))
                    }
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Event Name
                  </label>
                  <input
                    value={event.name}
                    onChange={(e) =>
                      setEvent((prev) => ({ ...prev, name: e.target.value }))
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
                    value={new Date(event.duration.start)
                      .toISOString()
                      .slice(0, 16)}
                    onChange={(e) =>
                      setEvent((prev) => ({
                        ...prev,
                        duration: {
                          ...prev.duration,
                          start: new Date(e.target.value).getTime(),
                        },
                      }))
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
                    value={new Date(event.duration.end)
                      .toISOString()
                      .slice(0, 16)}
                    onChange={(e) =>
                      setEvent((prev) => ({
                        ...prev,
                        duration: {
                          ...prev.duration,
                          end: new Date(e.target.value).getTime(),
                        },
                      }))
                    }
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Available For Town Hall
                  </label>
                  <input
                    type="number"
                    value={event.availableForTH || ""}
                    onChange={(e) =>
                      setEvent((prev) => ({
                        ...prev,
                        availableForTH: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Defenses */}
            <div className="space-y-4 mb-6">
              {Object.entries(craftedMetadata).length === 0 ? (
                <div className="bg-slate-800/30 border-2 border-dashed border-slate-700 rounded-xl p-12 text-center">
                  <div className="text-5xl mb-4">🎯</div>
                  {fetching ? (
                    <p classname="text-slate-400">Loading...</p>
                  ) : (
                    <p className="text-slate-400 mb-4">
                      No crafted defenses found
                    </p>
                  )}
                  <p className="text-slate-400 mb-4">
                    Click "Add Defense" to get started
                  </p>
                </div>
              ) : (
                Object.entries(craftedMetadata).map(([id, defense]) => {
                  const selected = event.defenses.includes(Number(id));

                  return (
                    <label key={id} className="flex gap-3 items-center">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEvent((prev) => ({
                              ...prev,
                              defenses: [...prev.defenses, Number(id)],
                            }));
                          } else {
                            setEvent((prev) => ({
                              ...prev,
                              defenses: prev.defenses.filter(
                                (x) => x !== Number(id),
                              ),
                            }));
                          }
                        }}
                      />

                      {defense.name}
                    </label>
                  );
                })
              )}
            </div>

            {/* Save Button */}
            <div className="sticky bottom-4">
              <button
                onClick={saveCraftedEvent}
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
