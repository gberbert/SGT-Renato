import React, { useState, useEffect, useMemo } from "react";
import { Dialog, Flex, Text, Button, Card } from "@radix-ui/themes";
import { X } from "lucide-react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

function BaselineCalendarModal({ open, onOpenChange, monthYear, holidays, onSave }) {
  const [hours, setHours] = useState({});
  const [totalHours, setTotalHours] = useState(0);

  if (!monthYear) return null;

  const [year, month] = monthYear;

  const calendarData = useMemo(() => {
    const data = [];
    const date = new Date(year, month, 1);
    const firstDay = date.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      data.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      data.push({ day: d, dateStr, date: new Date(year, month, d) });
    }

    return data;
  }, [year, month]);

  useEffect(() => {
    if (open && monthYear) {
      const initialHours = {};

      for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const dayOfWeek = new Date(year, month, d).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = holidays.some((h) => h.dateStr === dateStr);
        const isStateHoliday = holidays.some((h) => h.dateStr === dateStr && h.type === "estadual");

        if (isWeekend || isStateHoliday || isHoliday) {
          initialHours[dateStr] = 0;
        } else {
          initialHours[dateStr] = 8;
        }
      }

      setHours(initialHours);
      const total = Object.values(initialHours).reduce((acc, val) => acc + (val || 0), 0);
      setTotalHours(total);
    }
  }, [open, year, month, holidays, monthYear]);

  const handleHourChange = (dateStr, value) => {
    const newHours = { ...hours, [dateStr]: parseInt(value) || 0 };
    setHours(newHours);
    const total = Object.values(newHours).reduce((acc, val) => acc + (val || 0), 0);
    setTotalHours(total);
  };

  const handleSave = () => {
    onSave(year, month, hours);
    onOpenChange(false);
  };

  const monthName = new Date(year, month).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 900 }}>
        <Dialog.Title>
          <Flex justify="between" align="center">
            <Text>Configurar Horas Base - {monthName}</Text>
            <Dialog.Close asChild>
              <button
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--gray-9)",
                }}
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </Flex>
        </Dialog.Title>

        <div style={{ display: "flex", gap: "24px", marginTop: "16px" }}>
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 50px)", gap: "4px" }}>
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => (
                <div
                  key={day}
                  style={{
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: 11,
                    color: "var(--gray-9)",
                    padding: "4px",
                  }}
                >
                  {day}
                </div>
              ))}

              {calendarData.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} style={{ width: 50, height: 50 }} />;
                }

                const { day, dateStr, date } = cell;
                const dayOfWeek = date.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const isHoliday = holidays.some((h) => h.dateStr === dateStr);
                const isStateHoliday = holidays.some(
                  (h) => h.dateStr === dateStr && h.type === "estadual"
                );
                const currentHours = hours[dateStr] || 0;

                let bgColor = "var(--gray-2)";
                if (isStateHoliday) {
                  bgColor = "var(--red-2)";
                } else if (isHoliday) {
                  bgColor = "var(--orange-2)";
                } else if (isWeekend) {
                  bgColor = "var(--gray-2)";
                }

                return (
                  <div
                    key={dateStr}
                    style={{
                      width: 50,
                      height: 50,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: bgColor,
                      border: "1px solid var(--gray-4)",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      position: "relative",
                    }}
                    title={dateStr}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: 2,
                        fontSize: 9,
                        color: "var(--gray-9)",
                      }}
                    >
                      {day}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={currentHours}
                      onChange={(e) => handleHourChange(dateStr, e.target.value)}
                      style={{
                        width: 35,
                        height: 24,
                        border: "1px solid var(--gray-5)",
                        borderRadius: 3,
                        textAlign: "center",
                        fontSize: 10,
                        background: "white",
                        color: isStateHoliday ? "var(--red-9)" : "var(--gray-12)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                padding: "16px",
                background: "var(--indigo-2)",
                border: "1px solid var(--indigo-6)",
                borderRadius: 8,
              }}
            >
              <Text size="1" style={{ color: "var(--indigo-9)", marginBottom: "8px" }}>
                Total de Horas
              </Text>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: "var(--indigo-11)",
                  lineHeight: 1,
                }}
              >
                {totalHours}h
              </div>
            </div>

            <Card size="1" style={{ padding: "12px" }}>
              <Text size="1" weight="bold" style={{ marginBottom: "8px", display: "block" }}>
                Legenda
              </Text>
              <div style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      background: "var(--gray-2)",
                      border: "1px solid var(--gray-4)",
                      borderRadius: 3,
                    }}
                  />
                  <span>Dia útil/Feriado Municipal</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      background: "var(--red-2)",
                      border: "1px solid var(--red-4)",
                      borderRadius: 3,
                    }}
                  />
                  <span>Feriado Estadual (não editável)</span>
                </div>
              </div>
            </Card>

            <Flex gap="2" direction="column">
              <Button
                onClick={handleSave}
                style={{
                  background: "var(--indigo-9)",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Salvar
              </Button>
              <Dialog.Close asChild>
                <Button variant="soft" style={{ cursor: "pointer" }}>
                  Cancelar
                </Button>
              </Dialog.Close>
            </Flex>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default function TeamCapacityModal({ open, onOpenChange, users = [] }) {
  const [tab, setTab] = useState("mes");
  const [holidays, setHolidays] = useState([]);
  const [baselineHours, setBaselineHours] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    async function loadHolidays() {
      try {
        const municipiosRef = collection(db, "municipios");
        const snapshot = await getDocs(municipiosRef);

        const allHolidays = [];
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.feriados) {
            Object.entries(data.feriados).forEach(([dateStr, holiday]) => {
              allHolidays.push({
                dateStr,
                type: holiday.type || "municipal",
              });
            });
          }
        });

        setHolidays(allHolidays);
      } catch (error) {
        console.error("Error loading holidays:", error);
      }
    }

    if (open) {
      loadHolidays();
    }
  }, [open]);

  const handleCalendarSave = (year, month, hours) => {
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    setBaselineHours((prev) => ({
      ...prev,
      [monthKey]: hours,
    }));
  };

  const months = useMemo(() => {
    const result = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      result.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      });
    }
    return result;
  }, []);

  const allocationTypes = [
    { key: "planejamento", label: "PLANEJAMENTO (h)" },
    { key: "dailys", label: "DAILYS (h)" },
    { key: "susten", label: "SUSTEN (%)" },
    { key: "apoio", label: "APOIO (%)" },
    { key: "catalogo", label: "CATALOGO(%)" },
  ];

  const tabButtonStyle = (isActive) => ({
    padding: "8px 16px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    border: "1px solid var(--gray-6)",
    background: isActive ? "var(--indigo-9)" : "transparent",
    color: isActive ? "white" : "var(--gray-11)",
    cursor: "pointer",
    transition: "all 0.15s",
  });

  const allocationButtonStyle = (isActive) => ({
    padding: "6px 14px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    border: isActive ? "1px solid var(--blue-7)" : "1px solid var(--gray-6)",
    background: isActive ? "var(--blue-3)" : "transparent",
    color: isActive ? "var(--blue-11)" : "var(--gray-11)",
    cursor: "pointer",
    transition: "all 0.15s",
  });

  return (
    <>
      <BaselineCalendarModal
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        monthYear={selectedMonth}
        holidays={holidays}
        onSave={handleCalendarSave}
      />

      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content style={{ maxWidth: 1300 }}>
          <Dialog.Title>
            <Flex justify="between" align="center">
              <Text>TEAM CAPACITY</Text>
              <Flex gap="2" align="center">
                <button
                  onClick={() => {
                    if (selectedMonth) {
                      setCalendarOpen(true);
                    }
                  }}
                  disabled={!selectedMonth}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    border: "2px solid var(--blue-9)",
                    background: "transparent",
                    color: "var(--blue-9)",
                    cursor: selectedMonth ? "pointer" : "not-allowed",
                    transition: "all 0.15s",
                    opacity: selectedMonth ? 1 : 0.5,
                  }}
                  onMouseEnter={(e) => {
                    if (selectedMonth) {
                      e.currentTarget.style.background = "rgba(59, 130, 246, 0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  📅 CALENDARIO BASE
                </button>
                <Dialog.Close asChild>
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--gray-9)",
                    }}
                  >
                    <X size={20} />
                  </button>
                </Dialog.Close>
              </Flex>
            </Flex>
          </Dialog.Title>

          <div style={{ marginTop: "20px" }}>
            {/* Tabs */}
            <Flex gap="2" mb="4">
              {[
                { key: "mes", label: "MÊS" },
                { key: "dias-uteis", label: "DIAS ÚTEIS" },
                { key: "horas", label: "HORAS" },
              ].map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)} style={tabButtonStyle(tab === t.key)}>
                  {t.label}
                </button>
              ))}
            </Flex>

            {/* Allocation Type Buttons */}
            <Flex gap="2" mb="4" wrap="wrap">
              {allocationTypes.map((alloc) => (
                <button key={alloc.key} style={allocationButtonStyle(false)}>
                  {alloc.label}
                </button>
              ))}
            </Flex>

            {/* Month selector and table */}
            <Card size="2" style={{ marginTop: 12 }}>
              <Flex gap="2" mb="3" wrap="wrap">
                {months.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setSelectedMonth([m.year, m.month])}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      border: selectedMonth && selectedMonth[0] === m.year && selectedMonth[1] === m.month ? "1px solid var(--indigo-7)" : "1px solid var(--gray-6)",
                      background: selectedMonth && selectedMonth[0] === m.year && selectedMonth[1] === m.month ? "var(--indigo-3)" : "transparent",
                      color: selectedMonth && selectedMonth[0] === m.year && selectedMonth[1] === m.month ? "var(--indigo-11)" : "var(--gray-11)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </Flex>


              {/* User allocation table */}
              <div style={{ marginTop: 16, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid var(--gray-5)", fontWeight: 700 }}>Membro</th>
                      {allocationTypes.map((alloc) => (
                        <th key={alloc.key} style={{ padding: "8px", textAlign: "center", borderBottom: "1px solid var(--gray-5)", fontWeight: 700 }}>
                          {alloc.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: "16px", textAlign: "center", color: "var(--gray-9)" }}>
                          Nenhum membro selecionado
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "8px", fontWeight: 500 }}>
                            {user.displayName || user.name || user.email}
                          </td>
                          {allocationTypes.map((alloc) => (
                            <td key={alloc.key} style={{ padding: "8px", textAlign: "center" }}>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="—"
                                style={{
                                  width: 50,
                                  padding: "4px",
                                  borderRadius: 4,
                                  border: "1px solid var(--gray-5)",
                                  background: "var(--gray-1)",
                                  color: "var(--gray-12)",
                                  textAlign: "center",
                                  fontSize: 11,
                                }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}
