import React from "react";
import { Card, Badge as RadixBadge } from "@radix-ui/themes";

function statusColor(s) {
  if (!s || s === "—") return "gray";
  if (s.toLowerCase() === "inativo") return "gray";
  return "green";
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

function getUserLabel(u) {
  return u?.displayName || u?.shortName || u?.name || u?.email || u?.id || "Sem nome";
}

function squadBadge(squad) {
  if (!squad) return "—";
  return squad?.name || squad?.key || squad?.sigla || "SQUAD";
}

const TH = { 
  padding: "8px 12px", 
  textAlign: "left", 
  fontSize: 11, 
  fontWeight: 700, 
  letterSpacing: "0.06em", 
  color: "var(--gray-9)", 
  borderBottom: "1px solid var(--gray-4)", 
  whiteSpace: "nowrap" 
};

const TD = { 
  padding: "9px 12px", 
  fontSize: 12, 
  borderBottom: "1px solid rgba(255,255,255,0.04)" 
};

export default function TeamCapacityGrid({ usersFiltered, squadById, membership }) {
  return (
    <Card size="4" style={{ marginTop: 0 }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH}>Nome</th>
              <th style={TH}>Status</th>
              <th style={TH}>Squad</th>
              <th style={TH}>Papel na Squad</th>
            </tr>
          </thead>
          <tbody>
            {usersFiltered.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...TD, textAlign: "center", color: "var(--gray-8)", padding: "32px" }}>
                  Nenhum membro encontrado.
                </td>
              </tr>
            )}
            {usersFiltered.map((u) => {
              // Usar squadRoles enriquecidos do usuário
              const userSquadRoles = u?.squadRoles || [];
              
              return (
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
                  {/* Squad */}
                  <td style={TD}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {userSquadRoles.length === 0
                        ? <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>
                        : userSquadRoles.map((role, i) => (
                          <Badge key={role.squadRoleId || i} label={role.squad || "SQUAD"} color="cyan" />
                        ))}
                    </div>
                  </td>
                  {/* Papel na Squad */}
                  <td style={TD}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {userSquadRoles.length === 0
                        ? <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>
                        : userSquadRoles.map((role, i) => (
                          <span key={role.squadRoleId || i} style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "2px 8px", borderRadius: 999, fontSize: 11,
                            fontWeight: 600, whiteSpace: "nowrap",
                            background: "var(--indigo-3)", border: "1px solid var(--indigo-7)", color: "var(--indigo-11)",
                          }}>
                            {(role.squadRole && role.squadRole !== "—")
                              ? <span style={{ color: "var(--indigo-11)" }}>{role.squadRole}</span>
                              : <span style={{ color: "var(--gray-8)" }}>—</span>}
                          </span>
                        ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
