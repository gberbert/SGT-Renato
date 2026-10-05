import React, { useState, useEffect, useMemo } from "react";
import { collection, query, onSnapshot, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Card, Text } from "@radix-ui/themes";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS_OF_WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function isWeekend(year, month, day) {
  return [0, 6].includes(new Date(year, month, day).getDay());
}
function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
function getFirstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
}
function dateToNum(d) {
  if (!d) return null;
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export default function CalendarBase({ rangeMode = false, onRangeChange, onWorkingDaysChange }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [rangeA, setRangeA] = useState(null);
  const [rangeB, setRangeB] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formType, setFormType] = useState("vacation");
  const [formTitle, setFormTitle] = useState("");
  const [nationalHolidays, setNationalHolidays] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "holydays")),
      (snap) => {
        setNationalHolidays(snap.docs.map((d) => { const x = d.data(); return { id: d.id, data: x.data, nome: x.nome, tipo: x.tipo }; }));
        setLoadingHolidays(false);
      },
      () => setLoadingHolidays(false)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "vacations")),
      (snap) => setVacations(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return () => unsub();
  }, []);

  const holidaysByDate = useMemo(() => {
    const map = {};
    for (const h of nationalHolidays) {
      if (!h.data) continue;
      (map[h.data] = map[h.data] || []).push(h);
    }
    return map;
  }, [nationalHolidays]);

  const vacationsByDate = useMemo(() => {
    const map = {};
    for (const v of vacations) {
      if (!v.date) continue;
      (map[v.date] = map[v.date] || []).push(v);
    }
    return map;
  }, [vacations]);

  const isHoliday = (ds) => !!(holidaysByDate[ds]?.length);

  const countWorkingDays = (start, end) => {
    if (!start || !end) return 0;
    const s = start <= end ? new Date(start) : new Date(end);
    const e = start <= end ? new Date(end) : new Date(start);
    s.setHours(0, 0, 0, 0); e.setHours(0, 0, 0, 0);
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const ds = formatDateStr(cur.getFullYear(), cur.getMonth(), cur.getDate());
      if (!isWeekend(cur.getFullYear(), cur.getMonth(), cur.getDate()) && !isHoliday(ds)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const handleDayClick = (day) => {
    const clicked = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    if (!rangeMode) { setSelectedDate(clicked); setShowAddForm(false); return; }
    if (!rangeA || (rangeA && rangeB)) { setRangeA(clicked); setRangeB(null); }
    else {
      const start = rangeA <= clicked ? rangeA : clicked;
      const end = rangeA <= clicked ? clicked : rangeA;
      setRangeA(start); setRangeB(end);
      if (onRangeChange) {
        const wd = countWorkingDays(start, end);
        onRangeChange({ start, end, workingDays: wd, capacityBruto: wd * 8 });
      }
    }
  };

  const handleAddEntry = async () => {
    if (!selectedDate || !formTitle.trim()) { alert("Preencha todos os campos"); return; }
    const ds = formatDateStr(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    try {
      await addDoc(collection(db, "holydays"), { data: ds, nome: formTitle, tipo: formType, pais: "BR", criadoManualmente: true });
      setFormTitle(""); setShowAddForm(false);
    } catch (err) { alert("Erro: " + (err.message || err.code)); }
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const y = currentDate.getFullYear();
  const mo = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthYear = currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toUpperCase();

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const workingDaysCount = useMemo(() => {
    let c = 0;
    for (let d = 1; d <= getDaysInMonth(currentDate); d++) {
      const ds = formatDateStr(y, mo, d);
      if (!isWeekend(y, mo, d) && !isHoliday(ds)) c++;
    }
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, holidaysByDate]);

  useEffect(() => {
    if (onWorkingDaysChange) {
      const start = `${y}-${String(mo + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(y, mo + 1, 0).getDate();
      const end = `${y}-${String(mo + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      onWorkingDaysChange({ workingDays: workingDaysCount, periodStart: start, periodEnd: end });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingDaysCount, y, mo]);

  const rangeWorkingDays = useMemo(() => {
    if (!rangeA || !rangeB) return null;
    return countWorkingDays(rangeA, rangeB);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeA, rangeB, holidaysByDate]);

  const fmtDate = (d) => d ? d.toLocaleDateString("pt-BR") : "—";

  const getTipoColor = (tipo) => {
    const t = (tipo || "").toLowerCase();
    if (t === "nacional") return ["var(--red-3)", "var(--red-6)", "var(--red-11)"];
    if (t === "estadual" || t === "municipal") return ["var(--orange-3)", "var(--orange-6)", "var(--orange-11)"];
    return ["var(--blue-3)", "var(--blue-6)", "var(--blue-11)"];
  };

  const selectedInfo = selectedDate
    ? { ds: formatDateStr(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()) }
    : null;

  return (
    <Card style={{ padding: 16, minWidth: 300 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--gray-10)" }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <Text weight="bold" style={{ fontSize: 13, letterSpacing: "0.04em" }}>{monthYear}</Text>
          <div style={{ marginTop: 3 }}>
            {loadingHolidays
              ? <span style={{ fontSize: 9, color: "var(--gray-8)" }}>carregando…</span>
              : <span style={{ fontSize: 10, color: "var(--violet-11)", background: "var(--violet-3)", border: "1px solid var(--violet-8)", borderRadius: 10, padding: "1px 8px", fontWeight: 700, letterSpacing: "0.04em" }}>
                  {workingDaysCount} dias úteis · {workingDaysCount * 8}h
                </span>
            }
          </div>
        </div>
        <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--gray-10)" }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Range hint */}
      {rangeMode && (
        <div style={{ marginBottom: 8, padding: "5px 10px", borderRadius: 6, background: "var(--indigo-2)", border: "1px solid var(--indigo-5)", fontSize: 11, color: "var(--indigo-11)", textAlign: "center" }}>
          {!rangeA ? "Clique no dia inicial do período"
            : !rangeB ? `Início: ${fmtDate(rangeA)} — clique no dia final`
            : `📅 ${fmtDate(rangeA)} → ${fmtDate(rangeB)} · ${rangeWorkingDays} dias úteis · ${(rangeWorkingDays || 0) * 8}h`}
        </div>
      )}

      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 8 }}>
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--gray-8)", padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {calendarDays.map((day, idx) => {
          if (!day) return <div key={"e" + idx} />;
          const ds = formatDateStr(y, mo, day);
          const holidays = holidaysByDate[ds] || [];
          const vacList = vacationsByDate[ds] || [];
          const weekend = isWeekend(y, mo, day);
          const inRange = rangeMode && (() => {
            if (!rangeA || !rangeB) return false;
            const n = dateToNum(new Date(y, mo, day));
            const a = dateToNum(rangeA), b = dateToNum(rangeB);
            return n >= Math.min(a, b) && n <= Math.max(a, b);
          })();
          const edge = rangeMode && (() => {
            const n = dateToNum(new Date(y, mo, day));
            return n === dateToNum(rangeA) || (rangeB && n === dateToNum(rangeB));
          })();
          const isSelected = !rangeMode && selectedDate
            && selectedDate.getFullYear() === y && selectedDate.getMonth() === mo && selectedDate.getDate() === day;

          // Pick colors
          const nacional = holidays.find((h) => h.tipo?.toLowerCase() === "nacional");
          const est = holidays.find((h) => ["estadual", "municipal"].includes(h.tipo?.toLowerCase()));
          const topHol = nacional || est || holidays[0];
          const [holBg, holBorder] = topHol ? getTipoColor(topHol.tipo) : ["", ""];

          let cellBg = topHol ? holBg : "transparent";
          let cellBorder = topHol ? `1px solid ${holBorder}` : "1px solid transparent";
          let cellColor = weekend ? "var(--gray-6)" : "var(--gray-11)";
          if (inRange) { cellBg = "var(--indigo-3)"; cellBorder = "1px solid var(--indigo-5)"; cellColor = "var(--indigo-12)"; }
          if (edge) { cellBg = "var(--indigo-9)"; cellBorder = "1px solid var(--indigo-10)"; cellColor = "white"; }
          if (isSelected) { cellBg = "var(--violet-9)"; cellBorder = "1px solid var(--violet-10)"; cellColor = "white"; }

          const hasVac = vacList.length > 0;

          return (
            <div
              key={ds}
              onClick={() => handleDayClick(day)}
              title={holidays.map((h) => h.nome).concat(vacList.map((v) => v.title || "Férias")).join(", ") || undefined}
              style={{
                position: "relative", textAlign: "center", padding: "6px 2px",
                borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: edge || isSelected ? 700 : 500,
                background: cellBg, border: cellBorder, color: cellColor,
                transition: "all 0.1s",
              }}
            >
              {day}
              {hasVac && (
                <span style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "var(--teal-9)" }} />
              )}
              {holidays.length > 0 && !edge && !isSelected && (
                <span style={{ position: "absolute", top: 2, right: 2, width: 4, height: 4, borderRadius: "50%", background: holBorder }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Selected day info (single mode) */}
      {!rangeMode && selectedDate && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "var(--gray-2)", border: "1px solid var(--gray-4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-11)" }}>
              {selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </span>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--indigo-7)", background: "var(--indigo-3)", color: "var(--indigo-11)", cursor: "pointer", fontWeight: 600 }}
            >
              {showAddForm ? "Cancelar" : "+ Feriado"}
            </button>
          </div>
          {selectedInfo && (holidaysByDate[selectedInfo.ds] || []).length > 0 && (
            <div style={{ marginTop: 6 }}>
              {(holidaysByDate[selectedInfo.ds] || []).map((h, i) => {
                const [bg, border, col] = getTipoColor(h.tipo);
                return (
                  <span key={i} style={{ display: "inline-block", marginRight: 4, padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: bg, border: `1px solid ${border}`, color: col }}>
                    {h.nome}
                  </span>
                );
              })}
            </div>
          )}
          {showAddForm && (
            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <select value={formType} onChange={(e) => setFormType(e.target.value)}
                style={{ fontSize: 11, padding: "3px 6px", borderRadius: 4, border: "1px solid var(--gray-5)", background: "var(--gray-1)", color: "var(--gray-12)", flex: "0 0 auto" }}>
                <option value="nacional">Nacional</option>
                <option value="estadual">Estadual</option>
                <option value="municipal">Municipal</option>
                <option value="corporativo">Corporativo</option>
              </select>
              <input
                value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Nome do feriado"
                style={{ flex: 1, fontSize: 11, padding: "3px 8px", borderRadius: 4, border: "1px solid var(--gray-5)", background: "var(--gray-1)", color: "var(--gray-12)", minWidth: 120 }}
              />
              <button onClick={handleAddEntry}
                style={{ fontSize: 11, padding: "3px 10px", borderRadius: 4, border: "1px solid var(--green-7)", background: "var(--green-9)", color: "white", cursor: "pointer", fontWeight: 600 }}>
                Salvar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          { label: "Nacional", bg: "var(--red-3)", border: "var(--red-6)", color: "var(--red-11)" },
          { label: "Estadual/Municipal", bg: "var(--orange-3)", border: "var(--orange-6)", color: "var(--orange-11)" },
          { label: "Corporativo", bg: "var(--blue-3)", border: "var(--blue-6)", color: "var(--blue-11)" },
          { label: "Férias", bg: "var(--teal-3)", border: "var(--teal-6)", color: "var(--teal-11)" },
        ].map((item) => (
          <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: item.color }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: item.bg, border: `1px solid ${item.border}` }} />
            {item.label}
          </span>
        ))}
      </div>
    </Card>
  );
}
