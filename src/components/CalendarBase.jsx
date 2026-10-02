import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { Card, Text, Flex, Button } from "@radix-ui/themes";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

export default function CalendarBase() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [holidays, setHolidays] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formType, setFormType] = useState("vacation");
  const [formTitle, setFormTitle] = useState("");

  // Load holidays
  useEffect(() => {
    const q = query(collection(db, "holidays"));
    const unsub = onSnapshot(q, (snap) => {
      setHolidays(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error(err));
    return () => unsub();
  }, []);

  // Load vacations
  useEffect(() => {
    const q = query(collection(db, "vacations"));
    const unsub = onSnapshot(q, (snap) => {
      setVacations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error(err));
    return () => unsub();
  }, []);

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDate = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const isDateSpecial = (day) => {
    const dateStr = formatDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    const isHoliday = holidays.some((h) => {
      const hDate = h.date?.split("T")[0] || h.date;
      return hDate === dateStr;
    });
    const isVacation = vacations.some((v) => v.date === dateStr);
    return { isHoliday, isVacation };
  };

  const handleAddEntry = async () => {
    if (!selectedDate || !formTitle.trim()) {
      alert("Preencha todos os campos");
      return;
    }

    const dateStr = formatDate(selectedDate);
    const data = { date: dateStr, title: formTitle, type: formType };

    try {
      if (formType === "vacation") {
        await addDoc(collection(db, "vacations"), data);
      } else {
        await addDoc(collection(db, "holidays"), data);
      }
      setFormTitle("");
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar");
    }
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthYear = currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toUpperCase();

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  return (
    <Card style={{ padding: "16px", minWidth: "300px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <button
          onClick={prevMonth}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            color: "var(--gray-10)",
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <Text weight="bold" style={{ flex: 1, textAlign: "center", fontSize: "13px", letterSpacing: "0.04em" }}>
          {monthYear}
        </Text>
        <button
          onClick={nextMonth}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            color: "var(--gray-10)",
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Weekdays */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "8px" }}>
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => (
          <div
            key={day}
            style={{
              textAlign: "center",
              fontSize: "10px",
              fontWeight: "700",
              color: "var(--gray-9)",
              padding: "4px 2px",
              letterSpacing: "0.04em",
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "16px" }}>
        {calendarDays.map((day, idx) => {
          if (day === null) {
            return (
              <div
                key={`empty-${idx}`}
                style={{
                  aspectRatio: "1",
                  background: "transparent",
                }}
              />
            );
          }

          const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
          const special = isDateSpecial(day);
          const isSelected = selectedDate?.getDate() === day && selectedDate?.getMonth() === currentDate.getMonth();

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(date)}
              style={{
                aspectRatio: "1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                fontWeight: "600",
                border: isSelected ? "2px solid var(--indigo-11)" : "1px solid var(--gray-5)",
                borderRadius: "6px",
                background: special.isHoliday
                  ? "var(--red-3)"
                  : special.isVacation
                  ? "var(--yellow-3)"
                  : isSelected
                  ? "var(--indigo-3)"
                  : "transparent",
                color: special.isHoliday
                  ? "var(--red-11)"
                  : special.isVacation
                  ? "var(--yellow-11)"
                  : isSelected
                  ? "var(--indigo-11)"
                  : "var(--gray-11)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.borderColor = "var(--gray-7)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = special.isHoliday
                    ? "var(--red-3)"
                    : special.isVacation
                    ? "var(--yellow-3)"
                    : "transparent";
                  e.currentTarget.style.borderColor = "var(--gray-5)";
                }
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Selected date info */}
      {selectedDate && (
        <Card style={{ padding: "12px", background: "var(--indigo-2)", border: "1px solid var(--indigo-6)", marginBottom: "12px" }}>
          <Text size="1" weight="bold" style={{ color: "var(--indigo-11)", marginBottom: "8px" }}>
            {selectedDate.toLocaleDateString("pt-BR", { weekday: "short", year: "numeric", month: "long", day: "numeric" }).toUpperCase()}
          </Text>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                fontSize: "11px",
                fontWeight: "700",
                background: "var(--indigo-11)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                letterSpacing: "0.04em",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--indigo-10)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--indigo-11)")}
            >
              <Plus size={12} /> ADICIONAR
            </button>
          )}
          {showAddForm && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                style={{
                  padding: "6px 8px",
                  fontSize: "11px",
                  borderRadius: "4px",
                  border: "1px solid var(--indigo-7)",
                  background: "var(--indigo-1)",
                  color: "var(--indigo-11)",
                  fontWeight: "700",
                }}
              >
                <option value="vacation">FÉRIAS</option>
                <option value="holiday">FERIADO</option>
              </select>
              <input
                type="text"
                placeholder="Descrição..."
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                style={{
                  padding: "6px 8px",
                  fontSize: "11px",
                  borderRadius: "4px",
                  border: "1px solid var(--indigo-7)",
                  background: "var(--indigo-1)",
                  color: "var(--indigo-11)",
                }}
              />
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={handleAddEntry}
                  style={{
                    flex: 1,
                    padding: "6px 12px",
                    fontSize: "11px",
                    fontWeight: "700",
                    background: "var(--green-11)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  SALVAR
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setFormTitle("");
                  }}
                  style={{
                    flex: 1,
                    padding: "6px 12px",
                    fontSize: "11px",
                    fontWeight: "700",
                    background: "var(--gray-6)",
                    color: "var(--gray-11)",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  CANCELAR
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "10px" }}>
        <Flex align="center" gap="2">
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "3px",
              background: "var(--yellow-3)",
              border: "1px solid var(--yellow-7)",
            }}
          />
          <span style={{ color: "var(--gray-10)" }}>FÉRIAS</span>
        </Flex>
        <Flex align="center" gap="2">
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "3px",
              background: "var(--red-3)",
              border: "1px solid var(--red-7)",
            }}
          />
          <span style={{ color: "var(--gray-10)" }}>FERIADO</span>
        </Flex>
      </div>
    </Card>
  );
}
