import React, { useEffect, useMemo, useState } from "react";
import "./Team.css";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { subscribeToUsers } from "../services/settingsService";
import { Card, Flex, Text, TextField } from "@radix-ui/themes";
import { Edit2, Eye, Filter, BarChart3 } from "lucide-react";
import UserDetailsModal from "./UserDetailsModal";
import TeamCapacityModal from "./TeamCapacityModal";
import CalendarBase from "./CalendarBase";
import { STATUS_OPTIONS, CONTRATO_OPTIONS, FOUNDATION_OPTIONS } from "../utils/userFieldOptions";

function safe(v) {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function getUserLabel(u) {
  return u?.displayName || u?.shortName || u?.name || u?.email || u?.id || "Sem nome";
}
function squadBadge(squad) {
  return safe(squad?.name) || safe(squad?.key) || safe(squad?.sigla) || "SQUAD";
}
function userIdFromMaybe(maybeId) {
  if (!maybeId) return "";
  if (typeof maybeId === "string") return maybeId;
  return maybeId?.id || "";
}

function tagStyle(active, color) {
  const c = color || "accent";
  return {
    padding: "2px 10px", borderRadius: 999,
    border: active ? `1px solid var(--${c}-9)` : "1px solid var(--gray-6)",
    background: active ? `var(--${c}-3)` : "transparent",
    color: active ? `var(--${c}-11)` : "var(--gray-11)",
    fontSize: 12, fontWeight: active ? 700 : 400,
    cursor: "pointer", transition: "all 0.15s", letterSpacing: "0.04em",
  };
}

const clearStyle = {
  padding: "2px 8px", borderRadius: 999,
  border: "1px solid var(--red-6)", background: "transparent",
  color: "var(--red-10)", fontSize: 11, cursor: "pointer",
};

function StatCard({ count, label, badgeText, color }) {
  const col = color || "indigo";
  return (
    <div style={{
      minWidth: 120,
      background: `var(--${col}-2)`, border: `1px solid var(--${col}-6)`,
      borderRadius: 10, padding: "10px 14px 8px",
      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
    }}>
      <span style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, color: "var(--gray-12)" }}>{count}</span>
      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--gray-10)", lineHeight: 1.3, marginBottom: 4 }}>
        {label}
      </span>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
        background: `var(--${col}-3)`, border: `1px solid var(--${col}-7)`,
        color: `var(--${col}-11)`, letterSpacing: "0.04em", whiteSpace: "nowrap",
      }}>
        {badgeText}
      </span>
    </div>
  );
}

function Badge({ label, color }) {
  const col = color || "gray";
  if (!label || label === "—") return <span style={{ color: "var(--gray-7)" }}>—</span>;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11,
      fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap",
      background: `var(--${col}-3)`, border: `1px solid var(--${col}-7)`, color: `var(--${col}-11)`,
    }}>{label}</span>
  );
}

const TH = { padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--gray-9)", borderBottom: "1px solid var(--gray-4)", whiteSpace: "nowrap" };
const TD = { padding: "9px 12px", fontSize: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" };

function contractColor(c) {
  if (!c || c === "—") return "gray";
  const lc = c.toLowerCase();
  if (lc.includes("consultoria")) return "indigo";
  if (lc.includes("gdne")) return "green";
  if (lc.includes("sub")) return "orange";
  return "gray";
}

function statusColor(s) {
  if (!s || s === "—") return "gray";
  if (s.toLowerCase() === "inativo") return "gray";
  return "green";
}

function formatDate(v) {
  if (!v) return "—";
  try {
    const d = v?.toDate ? v.toDate() : (v instanceof Date ? v : new Date(v));
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return "—"; }
}

export default function Team({ currentUser }) {
  const [activeTab, setActiveTab] = useState("team");
  const [loadingSquads, setLoadingSquads] = useState(true);
  const [squads, setSquads] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [selectedSquads, setSelectedSquads] = useState(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState(new Set());
  const [selectedContracts, setSelectedContracts] = useState(new Set());
  const [selectedFoundations, setSelectedFoundations] = useState(new Set());
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [capacityModalOpen, setCapacityModalOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "squads"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setSquads(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingSquads(false);
    }, (err) => { console.error(err); setLoadingSquads(false); });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToUsers((data) => { setUsers(data || []); setLoadingUsers(false); });
    return () => unsub();
  }, []);

  const membership = useMemo(() => {
    const map = new Map();
    for (const squad of squads || []) {
      if (!squad?.id) continue;
      for (const member of (Array.isArray(squad.users) ? squad.users : [])) {
        const uid = userIdFromMaybe(member);
        if (!uid) continue;
        if (!map.has(uid)) map.set(uid, new Set());
        map.get(uid).add(squad.id);
      }
    }
    return map;
  }, [squads]);

  const squadById = useMemo(() => {
    const m = {};
    for (const s of squads) m[s.id] = s;
    return m;
  }, [squads]);

  const squadsSorted = useMemo(() =>
    [...(squads || [])].sort((a, b) =>
      (a?.name || a?.key || "").toString().toUpperCase()
        .localeCompare((b?.name || b?.key || "").toString().toUpperCase(), "pt-BR")
    ), [squads]);

  const usersSorted = useMemo(() =>
    [...(users || [])].sort((a, b) =>
      getUserLabel(a).toUpperCase().localeCompare(getUserLabel(b).toUpperCase(), "pt-BR")
    ), [users]);

  const toggleSquad = (id) => setSelectedSquads((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const makeToggle = (setter) => (val) => setter((prev) => {
    const n = new Set(prev); n.has(val) ? n.delete(val) : n.add(val); return n;
  });

  const usersFiltered = useMemo(() => usersSorted.filter((u) => {
    const term = userSearchTerm.trim().toLowerCase();
    if (term) {
      const label = getUserLabel(u).toLowerCase();
      const id = (u?.id || "").toLowerCase();
      if (!label.includes(term) && !id.includes(term)) return false;
    }
    if (selectedSquads.size > 0) {
      const sq = membership.get(u.id) || new Set();
      if (![...selectedSquads].some((sid) => sq.has(sid))) return false;
    }
    if (selectedStatuses.size > 0 && !selectedStatuses.has(u?.status || "")) return false;
    if (selectedContracts.size > 0 && !selectedContracts.has(u?.contract || "")) return false;
    if (selectedFoundations.size > 0 && !selectedFoundations.has(u?.foundation || "")) return false;
    return true;
  }), [userSearchTerm, usersSorted, selectedSquads, membership, selectedStatuses, selectedContracts, selectedFoundations]);

  const contratoBreakdown = useMemo(() => {
    const map = {};
    for (const u of usersFiltered) {
      const c = u?.contract || "—";
      map[c] = (map[c] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [usersFiltered]);

  const totalMembros = usersFiltered.length;

  if (loadingSquads || loadingUsers) {
    return (
      <div className="team-page">
        <div className="loader-container"><div className="spinner"></div></div>
      </div>
    );
  }

  return (
    <>
      <UserDetailsModal
        open={userModalOpen}
        onOpenChange={setUserModalOpen}
        user={selectedUser}
        currentUser={currentUser}
      />

      <TeamCapacityModal
        open={capacityModalOpen}
        onOpenChange={setCapacityModalOpen}
        users={usersFiltered}
      />

      <div className="view-content" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* ── STICKY HEADER: stat cards + search + filters ── */}
        <div className="team-sticky-header">
          {/* Stat cards */}
          <div className="welcome-banner" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, marginRight: 8 }}>
                <Text as="h1" size="6" weight="bold">Gestão de Time</Text>
                <Text size="1" style={{ color: "var(--gray-9)", marginTop: 4, display: "block" }}>
                  {totalMembros} membro{totalMembros !== 1 ? "s" : ""} exibido{totalMembros !== 1 ? "s" : ""}
                </Text>
              </div>
              <StatCard count={totalMembros} label="Total de Membros" badgeText="TODOS" color="indigo" />
              {contratoBreakdown.map(([contract, count]) => (
                <StatCard
                  key={contract}
                  count={count}
                  label={contract === "—" ? "Sem contrato" : contract}
                  badgeText={contract === "—" ? "N/A" : contract.toUpperCase().slice(0, 14)}
                  color={contractColor(contract)}
                />
              ))}
            </div>
          </div>

          {/* Search + filters + TEAM CAPACITY button */}
          <Card size="2" style={{ borderBottom: "none", boxShadow: "none" }}>
            <Flex mb="3" align="center" gap="3" wrap="wrap">
              <TextField.Root
                placeholder="Pesquisar por nome ou id..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                style={{ flexGrow: 1, minWidth: 260 }}
              />
              {(userSearchTerm || selectedStatuses.size > 0 || selectedSquads.size > 0 || selectedContracts.size > 0 || selectedFoundations.size > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setUserSearchTerm("");
                    setSelectedStatuses(new Set());
                    setSelectedSquads(new Set());
                    setSelectedContracts(new Set());
                    setSelectedFoundations(new Set());
                  }}
                  style={{
                    padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                    border: "1px solid var(--red-7)", background: "var(--red-3)",
                    color: "var(--red-11)", cursor: "pointer", whiteSpace: "nowrap",
                    letterSpacing: "0.04em",
                  }}
                >
                  ✕ Limpar filtros
                </button>
              )}
            </Flex>

            {/* Row 1: STATUS | SQUAD */}
            <Flex mb="2" align="center" gap="3" wrap="wrap">
              <Flex align="center" gap="2" wrap="wrap">
                <Text size="1" weight="bold" style={{ textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--gray-10)" }}>STATUS</Text>
                {(STATUS_OPTIONS || []).map((opt) => (
                  <button key={opt} type="button" onClick={() => makeToggle(setSelectedStatuses)(opt)}
                    style={tagStyle(selectedStatuses.has(opt), "green")}>
                    {opt.toUpperCase()}
                  </button>
                ))}
                {selectedStatuses.size > 0 && (
                  <button type="button" onClick={() => setSelectedStatuses(new Set())} style={clearStyle}>✕</button>
                )}
              </Flex>
              <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />
              <Flex align="center" gap="1" style={{ color: "var(--gray-10)" }}>
                <Filter size={13} />
                <Text size="1" weight="bold" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>SQUAD</Text>
              </Flex>
              {squadsSorted.map((squad) => (
                <button key={squad.id} type="button" onClick={() => toggleSquad(squad.id)}
                  style={tagStyle(selectedSquads.has(squad.id), "cyan")}>
                  {squadBadge(squad).toUpperCase()}
                </button>
              ))}
              {selectedSquads.size > 0 && (
                <button type="button" onClick={() => setSelectedSquads(new Set())} style={clearStyle}>✕</button>
              )}
            </Flex>

            {/* Row 2: CONTRATO | FOUNDATION */}
            <Flex mb="1" align="center" gap="3" wrap="wrap">
              <Flex align="center" gap="2" wrap="wrap">
                <Text size="1" weight="bold" style={{ textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--gray-10)" }}>CONTRATO</Text>
                {(CONTRATO_OPTIONS || []).map((opt) => (
                  <button key={opt} type="button" onClick={() => makeToggle(setSelectedContracts)(opt)}
                    style={tagStyle(selectedContracts.has(opt), "iris")}>
                    {opt.toUpperCase()}
                  </button>
                ))}
                {selectedContracts.size > 0 && (
                  <button type="button" onClick={() => setSelectedContracts(new Set())} style={clearStyle}>✕</button>
                )}
              </Flex>
              <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />
              <Flex align="center" gap="1" style={{ color: "var(--gray-10)" }}>
                <Filter size={13} />
                <Text size="1" weight="bold" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>FOUNDATION</Text>
              </Flex>
              {(FOUNDATION_OPTIONS || []).map((opt) => (
                <button key={opt} type="button" onClick={() => makeToggle(setSelectedFoundations)(opt)}
                  style={tagStyle(selectedFoundations.has(opt), "violet")}>
                  {opt.toUpperCase()}
                </button>
              ))}
              {selectedFoundations.size > 0 && (
                <button type="button" onClick={() => setSelectedFoundations(new Set())} style={clearStyle}>✕</button>
              )}
            </Flex>
          </Card>
        </div>

        {/* TABS NAVIGATION */}
        <div style={{ display: "flex", gap: "8px", padding: "12px 0 0 0", borderBottom: "1px solid var(--gray-5)", background: "transparent" }}>
          <button
            onClick={() => setActiveTab("team")}
            style={{
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: "700",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: "transparent",
              color: activeTab === "team" ? "var(--indigo-11)" : "var(--gray-10)",
              border: "none",
              borderBottom: activeTab === "team" ? "2px solid var(--indigo-11)" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "team") e.currentTarget.style.color = "var(--gray-11)";
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "team") e.currentTarget.style.color = "var(--gray-10)";
            }}
          >
            TEAM
          </button>
          <button
            onClick={() => setActiveTab("capacity")}
            style={{
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: "700",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: "transparent",
              color: activeTab === "capacity" ? "var(--indigo-11)" : "var(--gray-10)",
              border: "none",
              borderBottom: activeTab === "capacity" ? "2px solid var(--indigo-11)" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "capacity") e.currentTarget.style.color = "var(--gray-11)";
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "capacity") e.currentTarget.style.color = "var(--gray-10)";
            }}
          >
            TEAM CAPACITY
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            style={{
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: "700",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: "transparent",
              color: activeTab === "calendar" ? "var(--indigo-11)" : "var(--gray-10)",
              border: "none",
              borderBottom: activeTab === "calendar" ? "2px solid var(--indigo-11)" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "calendar") e.currentTarget.style.color = "var(--gray-11)";
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "calendar") e.currentTarget.style.color = "var(--gray-10)";
            }}
          >
            CALENDARIO BASE
          </button>
        </div>

        {/* ── TABLE (scrollable) ── */}
        {activeTab === "team" && (
        <Card size="4" style={{ marginTop: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={TH}>Nome</th>
                  <th style={TH}>Email</th>
                  <th style={TH}>Cidade</th>
                  <th style={{ ...TH, width: 48 }}>UF</th>
                  <th style={TH}>Nascimento</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Contrato</th>
                  <th style={TH}>Foundation</th>
                  <th style={TH}>Squads</th>
                  <th style={{ ...TH, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usersFiltered.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ ...TD, textAlign: "center", color: "var(--gray-8)", padding: "32px" }}>
                      Nenhum membro encontrado.
                    </td>
                  </tr>
                )}
                {usersFiltered.map((u) => {
                  const userSquads = [...(membership.get(u.id) || [])].map((sid) => squadById[sid]).filter(Boolean);
                  return (
                    <tr key={u.id} style={{ cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      {/* Nome */}
                      <td style={TD}>
                        <div style={{ fontWeight: 600, color: "var(--gray-12)" }}>{getUserLabel(u)}</div>
                      </td>
                      {/* Email */}
                      <td style={TD}>
                        <span style={{ fontSize: 12, color: "var(--gray-10)" }}>{u?.email || "—"}</span>
                      </td>
                      {/* Cidade */}
                      <td style={TD}>
                        <span style={{ fontSize: 12, color: "var(--gray-11)" }}>{u?.cidade || "—"}</span>
                      </td>
                      {/* UF */}
                      <td style={{ ...TD, textAlign: "center" }}>
                        {u?.uf
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-11)" }}>{u.uf}</span>
                          : <span style={{ color: "var(--gray-7)" }}>—</span>}
                      </td>
                      {/* Nascimento */}
                      <td style={TD}>
                        <span style={{ fontSize: 12, color: "var(--gray-10)" }}>{formatDate(u?.dataNascimento)}</span>
                      </td>
                      {/* Status */}
                      <td style={TD}>
                        <Badge label={u?.status || "—"} color={statusColor(u?.status)} />
                      </td>
                      {/* Contrato */}
                      <td style={TD}>
                        <Badge label={u?.contract || "—"} color={contractColor(u?.contract)} />
                      </td>
                      {/* Foundation */}
                      <td style={TD}>
                        <Badge label={u?.foundation || "—"} color="violet" />
                      </td>
                      {/* Squads */}
                      <td style={TD}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {userSquads.length === 0
                            ? <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>
                            : userSquads.map((sq) => (
                              <Badge key={sq.id} label={squadBadge(sq)} color="cyan" />
                            ))}
                        </div>
                      </td>
                      {/* Ações */}
                      <td style={{ ...TD, textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button type="button" title="Visualizar"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-9)", padding: 4 }}
                            onClick={() => { setSelectedUser(u); setUserModalOpen(true); }}>
                            <Eye size={15} />
                          </button>
                          <button type="button" title="Editar"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-9)", padding: 4 }}
                            onClick={() => { setSelectedUser(u); setUserModalOpen(true); }}>
                            <Edit2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        )}

        {/* TEAM CAPACITY TAB */}
        {activeTab === "capacity" && (
          <Card size="4" style={{ marginTop: 0 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={TH}>Nome</th>
                    <th style={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usersFiltered.length === 0 && (
                    <tr>
                      <td colSpan={2} style={{ ...TD, textAlign: "center", color: "var(--gray-8)", padding: "32px" }}>
                        Nenhum membro encontrado.
                      </td>
                    </tr>
                  )}
                  {usersFiltered.map((u) => (
                    <tr key={u.id} style={{ cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      {/* Nome */}
                      <td style={TD}>
                        <div style={{ fontWeight: 600, color: "var(--gray-12)" }}>{getUserLabel(u)}</div>
                      </td>
                      {/* Status */}
                      <td style={TD}>
                        <Badge label={u?.status || "—"} color={statusColor(u?.status)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* CALENDAR TAB */}
        {activeTab === "calendar" && (
          <div style={{ marginTop: 0 }}>
            <div style={{ display: "flex", gap: "24px" }}>
              <div style={{ maxWidth: "320px" }}>
                <CalendarBase />
              </div>
              <div style={{ flex: 1, minHeight: "400px", padding: "20px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--gray-6)" }}>
                <p style={{ color: "var(--gray-9)" }}>Selecione um dia no calendário para visualizar detalhes...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
