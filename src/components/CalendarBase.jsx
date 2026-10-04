import React, { useState, useEffect, useMemo } from "react";
import { collection, query, onSnapshot, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Card, Text } from "@radix-ui/themes";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function CalendarBase() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [vacations, setVacations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formType, setFormType] = useState("vacation");
  const [formTitle, setFormTitle] = useState("");
  const [nationalHolidays, setNationalHolidays] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(true);

  // Load feriados from 'holydays' collection
  useEffect(() => {
    const q = query(collection(db, "holydays"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            data: data.data,  // "YYYY-MM-DD"
            nome: data.nome,
            tipo: data.tipo,  // "Nacional" | "Estadual" | "Municipal"
          };
        });
        console.log("holydays carregados:", docs.length);
        setNationalHolidays(docs);
        setLoadingHolidays(false);
      },
      (err) => {
        console.error("Erro ao carregar holydays:", err);
        setLoadingHolidays(false);
      }
    );
    return () => unsub();
  }, []);

  // Load vacations
  useEffect(() => {
    const q = query(collection(db, "vacations"));
    const unsub = onSnapshot(
      q,
      (snap) => setVacations(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.debug("vacations:", err.code)
    );
    return () => unsub();
  }, []);

  // O(1) lookup maps
  const holidaysByDate = useMemo(() => {
    const map = {};
    for (const h of nationalHolidays) {
      if (!h.data) continue;
      if (!map[h.data]) map[h.data] = [];
      map[h.data].push(h);
    }
    return map;
  }, [nationalHolidays]);

  const vacationsByDate = useMemo(() => {
    const map = {};
    for (const v of vacations) {
      if (!v.date) continue;
      if (!map[v.date]) map[v.date] = [];
      map[v.date].push(v);
    }
    return map;
  }, [vacations]);

  // Helpers
  const getDaysInMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  const getFirstDayOfMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const formatDate = (year, month, day) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const isWeekend = (year, month, day) => {
    const dow = new Date(year, month, day).getDay();
    return dow === 0 || dow === 6;
  };

  const getDayInfo = (day) => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const dateStr = formatDate(y, m, day);
    return {
      dateStr,
      holidays: holidaysByDate[dateStr] || [],
      vacations: vacationsByDate[dateStr] || [],
      weekend: isWeekend(y, m, day),
    };
  };

  const handleAddEntry = async () => {
    if (!selectedDate || !formTitle.trim()) {
      alert("Preencha todos os campos");
      return;
    }
    const dateStr = formatDate(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate()
    );
    try {
      await addDoc(collection(db, "holydays"), {
        data: dateStr,       // campo padrão da coleção
        nome: formTitle,
        tipo: formType,      // "Nacional" | "Estadual" | "Municipal" | "Evento"
        pais: "BR",
        criadoManualmente: true,
      });
      setFormTitle("");
      setShowAddForm(false);
    } catch (err) {
      console.error("Erro ao salvar em holydays:", err);
      alert("Erro ao salvar: " + (err.message || err.code));
    }
  };

  const prevMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthYear = currentDate
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .toUpperCase();

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  // Count working days (not weekend, not holiday) for the current month
  const workingDaysCount = useMemo(() => {
    let count = 0;
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const total = getDaysInMonth(currentDate);
    for (let d = 1; d <= total; d++) {
      const dateStr = formatDate(y, m, d);
      const weekend = isWeekend(y, m, d);
      const holiday = !!(holidaysByDate[dateStr]?.length);
      if (!weekend && !holiday) count++;
    }
    return count;
  }, [currentDate, holidaysByDate]);

  const totalHours = workingDaysCount * 8;

  const selectedInfo = selectedDate ? getDayInfo(selectedDate.getDate()) : null;

  return (
    <Card style={{ padding: "16px", minWidth: "300px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "var(--gray-10)" }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <Text weight="bold" style={{ fontSize: "13px", letterSpacing: "0.04em" }}>
            {monthYear}
          </Text>
          {loadingHolidays ? (
            <Text size="1" style={{ display: "block", color: "var(--gray-8)", fontSize: "9px" }}>
              carregando feriados…
            </Text>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
              <span style={{
                fontSize: "10px",
                color: "var(--violet-11)",
                background: "var(--violet-3)",
                border: "1px solid var(--violet-8)",
                borderRadius: "10px",
                padding: "1px 8px",
                fontWeight: "700",
                letterSpacing: "0.04em",
                boxShadow: "0 0 8px var(--violet-9), 0 0 2px var(--violet-10)",
                textShadow: "0 0 6px var(--violet-10)",
              }}>
                {workingDaysCount} dias úteis · {totalHours}h
              </span>
            </div>
          )}
        </div>
        <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "var(--gray-10)" }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "8px" }}>
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "10px", fontWeight: "700", color: "var(--gray-9)", padding: "4px 2px", letterSpacing: "0.04em" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "16px" }}>
        {calendarDays.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} style={{ aspectRatio: "1" }} />;

          const info = getDayInfo(day);
          const isSelected =
            selectedDate?.getDate() === day &&
            selectedDate?.getMonth() === currentDate.getMonth() &&
            selectedDate?.getFullYear() === currentDate.getFullYear();

          const isHoliday = info.holidays.length > 0;
          const hasNacional = info.holidays.some((h) => h.tipo?.toLowerCase() === "nacional");
          const isVacation = info.vacations.length > 0;

          // Background & color logic
          let bg = "transparent";
          let textColor = info.weekend ? "var(--gray-8)" : "var(--gray-11)";
          let border = "1px solid transparent";
          let fontWeight = "normal";

          if (isSelected) {
            border = "2px solid var(--indigo-9)";
          }

          if (isHoliday) {
            bg = hasNacional ? "var(--red-3)" : "var(--orange-3)";
            textColor = hasNacional ? "var(--red-11)" : "var(--orange-11)";
            border = `1px solid ${hasNacional ? "var(--red-6)" : "var(--orange-6)"}`;
            fontWeight = "700";
            if (isSelected) border = `2px solid ${hasNacional ? "var(--red-9)" : "var(--orange-9)"}`;
          } else if (isVacation) {
            bg = "var(--blue-3)";
            textColor = "var(--blue-11)";
            border = "1px solid var(--blue-6)";
            if (isSelected) border = "2px solid var(--blue-9)";
          }

          // Tooltip: show holiday names
          const tooltipLines = info.holidays.map((h) => `${h.nome}${h.tipo ? ` (${h.tipo})` : ""}`);
          if (isVacation) info.vacations.forEach((v) => tooltipLines.push(v.title));
          const tooltip = tooltipLines.join("\n");

          return (
            <div
              key={day}
              title={tooltip}
              onClick={() => {
                setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
                setShowAddForm(false);
              }}
              style={{
                aspectRatio: "1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "6px",
                background: bg,
                color: textColor,
                border,
                fontWeight,
                fontSize: "12px",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.1s ease",
                userSelect: "none",
              }}
            >
              {day}
              {/* 8h label on working days */}
              {!info.weekend && !isHoliday && (
                <span style={{
                  fontSize: "8px",
                  lineHeight: "1",
                  color: "var(--gray-7)",
                  fontWeight: "500",
                  marginTop: "1px",
                  letterSpacing: "0.02em",
                }}>
                  8h
                </span>
              )}
              {/* Dot indicator */}
              {(isHoliday || isVacation) && (
                <span
                  style={{
                    position: "absolute",
                    bottom: "2px",
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    background: isHoliday
                      ? hasNacional ? "var(--red-9)" : "var(--orange-9)"
                      : "var(--blue-9)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--gray-10)" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "var(--red-3)", border: "1px solid var(--red-6)", display: "inline-block" }} />
          Feriado Nacional
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--gray-10)" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "var(--orange-3)", border: "1px solid var(--orange-6)", display: "inline-block" }} />
          Feriado Estadual/Municipal
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--gray-10)" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "var(--blue-3)", border: "1px solid var(--blue-6)", display: "inline-block" }} />
          Férias/Evento
        </div>
      </div>

      {/* Selected date detail */}
      {selectedDate && selectedInfo && (
        <div style={{ borderTop: "1px solid var(--gray-5)", paddingTop: "12px" }}>
          <Text weight="bold" size="2" style={{ display: "block", marginBottom: "8px" }}>
            {selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </Text>

          {selectedInfo.holidays.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              {selectedInfo.holidays.map((h) => (
                <div
                  key={h.id}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    marginBottom: "4px",
                    background: h.tipo?.toLowerCase() === "nacional" ? "var(--red-3)" : "var(--orange-3)",
                    border: `1px solid ${h.tipo?.toLowerCase() === "nacional" ? "var(--red-6)" : "var(--orange-6)"}`,
                    fontSize: "12px",
                    color: h.tipo?.toLowerCase() === "nacional" ? "var(--red-11)" : "var(--orange-11)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>🎉 {h.nome}</span>
                  {h.tipo && (
                    <span style={{ fontSize: "10px", opacity: 0.8, marginLeft: "8px" }}>
                      {h.tipo}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedInfo.vacations.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              {selectedInfo.vacations.map((v) => (
                <div
                  key={v.id}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    marginBottom: "4px",
                    background: "var(--blue-3)",
                    border: "1px solid var(--blue-6)",
                    fontSize: "12px",
                    color: "var(--blue-11)",
                  }}
                >
                  ✈️ {v.title}
                </div>
              ))}
            </div>
          )}

          {selectedInfo.holidays.length === 0 && selectedInfo.vacations.length === 0 && (
            <Text size="2" style={{ color: "var(--gray-9)", fontStyle: "italic" }}>
              Nenhum evento neste dia.
            </Text>
          )}

          {/* Add event button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                marginTop: "8px",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--gray-6)",
                background: "var(--gray-3)",
                color: "var(--gray-11)",
                cursor: "pointer",
                fontSize: "12px",
                width: "100%",
              }}
            >
              + Adicionar Evento
            </button>
          )}

          {showAddForm && (
            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--gray-6)", background: "var(--gray-2)", color: "var(--gray-11)", fontSize: "12px" }}
              >
                <option value="Nacional">Feriado Nacional</option>
                <option value="Estadual">Feriado Estadual</option>
                <option value="Municipal">Feriado Municipal</option>
                <option value="Evento">Evento</option>
                <option value="Recesso">Recesso</option>
              </select>
              <input
                type="text"
                placeholder="Descrição"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--gray-6)", background: "var(--gray-2)", color: "var(--gray-11)", fontSize: "12px" }}
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handleAddEntry}
                  style={{ flex: 1, padding: "6px", borderRadius: "6px", border: "none", background: "var(--indigo-9)", color: "white", cursor: "pointer", fontSize: "12px" }}
                >
                  Salvar
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  style={{ flex: 1, padding: "6px", borderRadius: "6px", border: "1px solid var(--gray-6)", background: "var(--gray-3)", color: "var(--gray-11)", cursor: "pointer", fontSize: "12px" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
