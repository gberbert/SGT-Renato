import React, { useEffect, useMemo, useState } from "react";
import "./Team.css";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { subscribeToUsers } from "../services/settingsService";
import { Card, Flex, Text, TextField } from "@radix-ui/themes";
import { Edit2, Eye, Filter, BarChart3, ChevronDown, CalendarDays, Settings2 } from "lucide-react";
import UserDetailsModal from "./UserDetailsModal";
import CalendarBase from "./CalendarBase";
import TeamCapacityGrid from "./TeamCapacityGrid";
import JourneyControlGrid from "./JourneyControlGrid";
import { STATUS_OPTIONS, CONTRATO_OPTIONS, FOUNDATION_OPTIONS } from "../utils/userFieldOptions";
import { saveCapacityConfig, DEFAULT_BASE_PARAMS } from "../services/teamCapacityService";

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

function StatCard({ count, label, badgeText, color, onClick, active }) {
  const col = color || "indigo";
  return (
    <div
      onClick={onClick}
      style={{
        minWidth: 120,
        background: active ? `var(--${col}-4)` : `var(--${col}-2)`,
        border: active ? `2px solid var(--${col}-9)` : `1px solid var(--${col}-6)`,
        borderRadius: 10, padding: active ? "9px 13px 7px" : "10px 14px 8px",
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s",
        boxShadow: active ? `0 0 0 3px var(--${col}-4)` : "none",
      }}
    >
      <span style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, color: active ? `var(--${col}-11)` : "var(--gray-12)" }}>{count}</span>
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
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [calendarCollapsed, setCalendarCollapsed] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configPeriodStart, setConfigPeriodStart] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [configPeriodEnd, setConfigPeriodEnd] = useState(() => {
    const t = new Date();
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  });
  const [configWorkingDays, setConfigWorkingDays] = useState(22);
  const [configBaseParams, setConfigBaseParams] = useState({ ...DEFAULT_BASE_PARAMS });
  const [calendarRangeSelected, setCalendarRangeSelected] = useState(false);
  const [holydays, setHolydays] = useState([]);

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

  // Subscribe to holidays (same source as CalendarBase) for working-days recalc
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "holydays")),
      (snap) => {
        setHolydays(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {}
    );
    return () => unsub();
  }, []);

  /** Count working days between two "YYYY-MM-DD" strings using loaded holiday data. */
  const recalcWorkingDays = () => {
    if (!configPeriodStart || !configPeriodEnd) return;
    const holidaySet = new Set(holydays.map((h) => h.data).filter(Boolean));
    const start = new Date(configPeriodStart + "T00:00:00");
    const end   = new Date(configPeriodEnd   + "T00:00:00");
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return;
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay();
      const ds  = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      if (dow !== 0 && dow !== 6 && !holidaySet.has(ds)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    setCalendarRangeSelected(true);
    setConfigWorkingDays(count);
  };

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

  // userId → [{ squadId, squadName, role }]
  const membershipRoles = useMemo(() => {
    const map = new Map();
    for (const squad of squads || []) {
      if (!squad?.id) continue;
      for (const member of (Array.isArray(squad.users) ? squad.users : [])) {
        const uid = typeof member === 'string' ? member : member?.id;
        const role = typeof member === 'string' ? '' : (member?.role || '');
        if (!uid) continue;
        if (!map.has(uid)) map.set(uid, []);
        map.get(uid).push({ squadId: squad.id, squadName: squad.name || squad.key || squad.sigla || squad.id, role });
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

  // Breakdown for stat cards: use all filters EXCEPT contract so cards always stay visible
  const usersFilteredNoContract = useMemo(() => usersSorted.filter((u) => {
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
    if (selectedFoundations.size > 0 && !selectedFoundations.has(u?.foundation || "")) return false;
    return true;
  }), [userSearchTerm, usersSorted, selectedSquads, membership, selectedStatuses, selectedFoundations]);

  const contratoBreakdown = useMemo(() => {
    const map = {};
    for (const u of usersFilteredNoContract) {
      const c = u?.contract || "—";
      map[c] = (map[c] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [usersFilteredNoContract]);

  const totalMembros = usersFiltered.length;
  const totalMembrosNoContract = usersFilteredNoContract.length;

  const handleSaveCapacityConfig = async () => {
    setConfigSaving(true);
    try {
      await saveCapacityConfig({
        periodStart: configPeriodStart,
        periodEnd: configPeriodEnd,
        workingDays: Number(configWorkingDays),
        capacityBruto: Number(configWorkingDays) * 8,
        baseParams: {
          alocacao: Number(configBaseParams.alocacao),
        },
        updatedBy: currentUser?.uid || "",
      });
    } catch (err) {
      console.error("Erro ao salvar configuração de capacity:", err);
    } finally {
      setConfigSaving(false);
    }
  };

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
              <StatCard
                count={selectedContracts.size === 0 ? totalMembrosNoContract : totalMembros}
                label="Total de Membros"
                badgeText="TODOS"
                color="indigo"
                active={selectedContracts.size === 0}
                onClick={() => setSelectedContracts(new Set())}
              />
              {contratoBreakdown.map(([contract, count]) => (
                <StatCard
                  key={contract}
                  count={count}
                  label={contract === "—" ? "Sem contrato" : contract}
                  badgeText={contract === "—" ? "N/A" : contract.toUpperCase().slice(0, 14)}
                  color={contractColor(contract)}
                  active={selectedContracts.has(contract)}
                  onClick={() => makeToggle(setSelectedContracts)(contract)}
                />
              ))}
            </div>
          </div>

          {/* Search + filters */}
          <Card size="2" style={{ borderBottom: "none", boxShadow: "none" }}>
            <Flex mb="3" align="center" gap="3" wrap="wrap">
              <TextField.Root
                placeholder="Pesquisar por nome ou id..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                style={{ flexGrow: 1, minWidth: 260 }}
              />

              {/* Collapse/expand toggle */}
              <button
                type="button"
                onClick={() => setFiltersCollapsed((v) => !v)}
                title={filtersCollapsed ? "Expandir filtros" : "Recolher filtros"}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                  border: filtersCollapsed ? "1px solid var(--indigo-7)" : "1px solid var(--gray-6)",
                  background: filtersCollapsed ? "var(--indigo-3)" : "var(--gray-2)",
                  color: filtersCollapsed ? "var(--indigo-11)" : "var(--gray-10)",
                  cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
                }}
              >
                <ChevronDown
                  size={14}
                  style={{
                    transform: filtersCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                />
                {filtersCollapsed ? "Filtros" : "Recolher"}
              </button>

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

            {/* Collapsible filter rows */}
            <div style={{
              overflow: "hidden",
              maxHeight: filtersCollapsed ? "0" : "200px",
              opacity: filtersCollapsed ? 0 : 1,
              transition: "max-height 0.25s ease, opacity 0.2s ease",
              pointerEvents: filtersCollapsed ? "none" : undefined,
            }}>

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

            </div>{/* end collapsible */}
          </Card>
        </div>

        {/* TABS NAVIGATION */}
        <div style={{ display: "flex", gap: "8px", padding: "12px 0 0 0", borderBottom: "1px solid var(--gray-5)", background: "transparent" }}>
          <button
            onClick={() => setActiveTab("team")}
            style={{
              padding: "10px 16px", fontSize: "13px", fontWeight: "700",
              letterSpacing: "0.04em", textTransform: "uppercase",
              background: "transparent",
              color: activeTab === "team" ? "var(--indigo-11)" : "var(--gray-10)",
              border: "none",
              borderBottom: activeTab === "team" ? "2px solid var(--indigo-11)" : "2px solid transparent",
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { if (activeTab !== "team") e.currentTarget.style.color = "var(--gray-11)"; }}
            onMouseLeave={(e) => { if (activeTab !== "team") e.currentTarget.style.color = "var(--gray-10)"; }}
          >
            TEAM
          </button>
          <button
            onClick={() => setActiveTab("capacity")}
            style={{
              padding: "10px 16px", fontSize: "13px", fontWeight: "700",
              letterSpacing: "0.04em", textTransform: "uppercase",
              background: "transparent",
              color: activeTab === "capacity" ? "var(--indigo-11)" : "var(--gray-10)",
              border: "none",
              borderBottom: activeTab === "capacity" ? "2px solid var(--indigo-11)" : "2px solid transparent",
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { if (activeTab !== "capacity") e.currentTarget.style.color = "var(--gray-11)"; }}
            onMouseLeave={(e) => { if (activeTab !== "capacity") e.currentTarget.style.color = "var(--gray-10)"; }}
          >
            TEAM CAPACITY
          </button>
          <button
            onClick={() => setActiveTab("jornada")}
            style={{
              padding: "10px 16px", fontSize: "13px", fontWeight: "700",
              letterSpacing: "0.04em", textTransform: "uppercase",
              background: "transparent",
              color: activeTab === "jornada" ? "var(--teal-11)" : "var(--gray-10)",
              border: "none",
              borderBottom: activeTab === "jornada" ? "2px solid var(--teal-11)" : "2px solid transparent",
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { if (activeTab !== "jornada") e.currentTarget.style.color = "var(--gray-11)"; }}
            onMouseLeave={(e) => { if (activeTab !== "jornada") e.currentTarget.style.color = "var(--gray-10)"; }}
          >
            CONTROLE DE JORNADA
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
                  <th style={TH}>Status</th>
                  <th style={TH}>Squad</th>
                  <th style={TH}>Papel na Squad</th>
                  <th style={TH}>Contrato</th>
                  <th style={TH}>Foundation</th>
                  <th style={TH}>Nascimento</th>
                  <th style={TH}>Email</th>
                  <th style={{ ...TH, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usersFiltered.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ ...TD, textAlign: "center", color: "var(--gray-8)", padding: "32px" }}>
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
                      <td style={TD}>
                        <div style={{ fontWeight: 600, color: "var(--gray-12)" }}>{getUserLabel(u)}</div>
                      </td>
                      <td style={TD}><Badge label={u?.status || "—"} color={statusColor(u?.status)} /></td>
                      <td style={TD}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {userSquads.length === 0
                            ? <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>
                            : userSquads.map((sq) => <Badge key={sq.id} label={squadBadge(sq)} color="cyan" />)}
                        </div>
                      </td>
                      <td style={TD}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {(membershipRoles.get(u.id) || []).length === 0
                            ? <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>
                            : (membershipRoles.get(u.id) || []).map((r, i) => (
                              <span key={i} style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "2px 8px", borderRadius: 999, fontSize: 11,
                                fontWeight: 600, whiteSpace: "nowrap",
                                background: "var(--indigo-3)", border: "1px solid var(--indigo-7)", color: "var(--indigo-11)",
                              }}>
                                <span style={{ fontWeight: 700, color: "var(--cyan-11)" }}>{r.squadName}</span>
                                {r.role ? <span style={{ color: "var(--gray-10)" }}>· {r.role}</span> : null}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td style={TD}><Badge label={u?.contract || "—"} color={contractColor(u?.contract)} /></td>
                      <td style={TD}><Badge label={u?.foundation || "—"} color="violet" /></td>
                      <td style={TD}><span style={{ fontSize: 12, color: "var(--gray-10)" }}>{formatDate(u?.dataNascimento)}</span></td>
                      <td style={TD}><span style={{ fontSize: 12, color: "var(--gray-10)" }}>{u?.email || "—"}</span></td>
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

        {/* CONTROLE DE JORNADA TAB */}
        {activeTab === "jornada" && (
          <div style={{ marginTop: 0 }}>
            <JourneyControlGrid
              usersFiltered={usersFiltered}
              squadById={squadById}
              membership={membership}
            />
          </div>
        )}

        {/* TEAM CAPACITY TAB */}
        {activeTab === "capacity" && (
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>

            {/* Left column: calendar toggle + config toggle */}
            <div style={{
              flexShrink: 0,
              width: (!calendarCollapsed || configPanelOpen) ? 320 : 36,
              minWidth: 36,
              transition: "width 0.3s ease",
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0,
              overflow: "hidden",
            }}>

              {/* Calendar toggle button */}
              <button
                type="button"
                onClick={() => setCalendarCollapsed((v) => !v)}
                title={calendarCollapsed ? "Expandir calendário" : "Recolher calendário"}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, borderRadius: "8px 8px 0 0",
                  border: "1px solid var(--gray-5)",
                  borderBottom: calendarCollapsed ? "1px solid var(--gray-5)" : "1px solid transparent",
                  background: calendarCollapsed ? "var(--gray-2)" : "var(--indigo-3)",
                  color: calendarCollapsed ? "var(--gray-10)" : "var(--indigo-11)",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                <CalendarDays size={15} />
              </button>

              {/* Calendar panel */}
              <div style={{
                overflow: "hidden",
                width: "100%",
                maxHeight: calendarCollapsed ? "0" : "800px",
                opacity: calendarCollapsed ? 0 : 1,
                transition: "max-height 0.3s ease, opacity 0.2s ease",
                pointerEvents: calendarCollapsed ? "none" : undefined,
                border: calendarCollapsed ? "none" : "1px solid var(--gray-5)",
                borderTop: "none",
                borderRadius: "0 8px 8px 8px",
                background: "var(--gray-1)",
              }}>
                <CalendarBase
                  rangeMode={true}
                  onRangeChange={({ start, end, workingDays }) => {
                    const fmt = (d) =>
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    setCalendarRangeSelected(true);
                    setConfigPeriodStart(fmt(start));
                    setConfigPeriodEnd(fmt(end));
                    setConfigWorkingDays(workingDays);
                  }}
                  onWorkingDaysChange={({ workingDays, periodStart, periodEnd }) => {
                    if (!calendarRangeSelected) {
                      setConfigWorkingDays(workingDays);
                      setConfigPeriodStart(periodStart);
                      setConfigPeriodEnd(periodEnd);
                    }
                  }}
                />
              </div>

              {/* Spacer */}
              <div style={{ height: 8 }} />

              {/* Config toggle button */}
              <button
                type="button"
                onClick={() => setConfigPanelOpen((v) => !v)}
                title={configPanelOpen ? "Fechar configurações de capacity" : "Configurações de Team Capacity"}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32,
                  borderRadius: configPanelOpen ? "8px 8px 0 0" : "8px",
                  border: "1px solid var(--gray-5)",
                  borderBottom: configPanelOpen ? "1px solid transparent" : "1px solid var(--gray-5)",
                  background: configPanelOpen ? "var(--amber-3)" : "var(--gray-2)",
                  color: configPanelOpen ? "var(--amber-11)" : "var(--gray-10)",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                <Settings2 size={15} />
              </button>

              {/* Config panel */}
              <div style={{
                overflow: "hidden",
                width: "100%",
                maxHeight: configPanelOpen ? "700px" : "0",
                opacity: configPanelOpen ? 1 : 0,
                transition: "max-height 0.3s ease, opacity 0.2s ease",
                pointerEvents: configPanelOpen ? undefined : "none",
                border: configPanelOpen ? "1px solid var(--gray-5)" : "none",
                borderTop: "none",
                borderRadius: "0 8px 8px 8px",
                background: "var(--gray-1)",
              }}>
                <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--gray-9)", textTransform: "uppercase" }}>
                    Configuração de Team Capacity
                  </div>

                  {/* Period */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--gray-10)", display: "block", marginBottom: 4 }}>Início do Período</label>
                      <input type="date" value={configPeriodStart} onChange={(e) => setConfigPeriodStart(e.target.value)}
                        style={{ width: "100%", padding: "5px 8px", fontSize: 12, borderRadius: 6, border: "1px solid var(--gray-5)", background: "var(--gray-2)", color: "var(--gray-12)", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--gray-10)", display: "block", marginBottom: 4 }}>Fim do Período</label>
                      <input type="date" value={configPeriodEnd} onChange={(e) => setConfigPeriodEnd(e.target.value)}
                        style={{ width: "100%", padding: "5px 8px", fontSize: 12, borderRadius: 6, border: "1px solid var(--gray-5)", background: "var(--gray-2)", color: "var(--gray-12)", boxSizing: "border-box" }} />
                    </div>
                  </div>

                  {/* Working Days */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--gray-10)", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      Dias Úteis no Período
                      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--violet-11)", background: "var(--violet-3)", border: "1px solid var(--violet-7)", borderRadius: 999, padding: "1px 7px", letterSpacing: "0.03em" }}>
                        ↑ calendário
                      </span>
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        type="number" min={1} max={31}
                        value={configWorkingDays}
                        onChange={(e) => setConfigWorkingDays(e.target.value)}
                        style={{ flex: 1, padding: "5px 8px", fontSize: 12, borderRadius: 6, border: "1px solid var(--violet-7)", background: "var(--violet-2)", color: "var(--gray-12)", boxSizing: "border-box", fontWeight: 700 }}
                      />
                      <button
                        type="button"
                        onClick={recalcWorkingDays}
                        title="Recalcular dias úteis com base nas datas e feriados configurados"
                        style={{
                          flexShrink: 0, padding: "5px 10px", borderRadius: 6,
                          border: "1px solid var(--violet-7)", background: "var(--violet-9)",
                          color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer",
                          letterSpacing: "0.04em", whiteSpace: "nowrap",
                        }}
                      >
                        Calcular
                      </button>
                    </div>
                  </div>

                  <div style={{ height: 1, background: "var(--gray-4)", margin: "2px 0" }} />
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "var(--gray-9)", textTransform: "uppercase" }}>
                    Parâmetros Base
                  </div>

                  {/* Alocação */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--gray-10)", display: "block", marginBottom: 4 }}>Alocação padrão (%)</label>
                    <input type="number" min={0} max={100} step={1}
                      value={configBaseParams.alocacao}
                      onChange={(e) => setConfigBaseParams((p) => ({ ...p, alocacao: e.target.value }))}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 12, borderRadius: 6, border: "1px solid var(--gray-5)", background: "var(--gray-2)", color: "var(--gray-12)", boxSizing: "border-box" }} />
                  </div>

                  {/* Save button */}
                  <button
                    type="button"
                    onClick={handleSaveCapacityConfig}
                    disabled={configSaving}
                    style={{
                      marginTop: 4, padding: "8px 0", borderRadius: 8, width: "100%",
                      border: "none", background: "var(--indigo-9)", color: "white",
                      fontSize: 13, fontWeight: 700, cursor: configSaving ? "not-allowed" : "pointer",
                      opacity: configSaving ? 0.7 : 1, letterSpacing: "0.04em",
                    }}
                  >
                    {configSaving ? "Salvando..." : "Salvar Configuração"}
                  </button>
                </div>
              </div>
            </div>

            {/* Right column: TeamCapacityGrid */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <TeamCapacityGrid
                usersFiltered={usersFiltered}
                squadById={squadById}
                membership={membership}
                workingDays={configWorkingDays}
                baseParams={configBaseParams}
                periodStart={configPeriodStart}
                periodEnd={configPeriodEnd}
                currentUser={currentUser}
              />
            </div>
          </div>
        )}

      </div>
    </>
  );
}
