import React, { useState } from "react";
import { Dialog, Flex, Text, Badge, Button, Select, Tabs } from "@radix-ui/themes";
import { ExternalLink } from "lucide-react";
import { updateTicketRadarFields, PRIORIDADE_INTERNA_OPTIONS } from "../../services/operacaoRadarService";

/* ─── Estilos base ─────────────────────────────────────────────────────────── */
const CARD_STYLE = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 8,
  padding: "8px 10px",
};

const LABEL_STYLE = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--gray-10)",
  marginBottom: 4,
  display: "block",
};

const TEXTAREA_STYLE = {
  width: "100%",
  minHeight: 100,
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--gray-6)",
  color: "var(--gray-12)",
  padding: "8px 10px",
  fontSize: 13,
  boxSizing: "border-box",
  resize: "vertical",
  fontFamily: "inherit",
  maxHeight: 400,
};

const DATE_INPUT_STYLE = {
  width: "100%",
  background: "transparent",
  border: "none",
  color: "var(--gray-12)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  colorScheme: "dark",
  cursor: "pointer",
};

/* ─── Campo caixa genérica ─────────────────────────────────────────────────── */
function FieldBox({ label, children, style }) {
  return (
    <div style={{ ...CARD_STYLE, ...style }}>
      <span style={LABEL_STYLE}>{label}</span>
      {children}
    </div>
  );
}

/* ─── Formatação de data ───────────────────────────────────────────────────── */
function formatDate(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0;
    if (hasTime) {
      return d.toLocaleString("pt-BR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      });
    }
    return d.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return String(value);
  }
}

function toDateInputValue(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

/* ─── Célula de data somente leitura ──────────────────────────────────────── */
function PlanDateCell({ label, value }) {
  const formatted = formatDate(value);
  return (
    <div style={{ ...CARD_STYLE, marginBottom: 4 }}>
      <span style={LABEL_STYLE}>{label}</span>
      <Text
        size="2"
        style={{
          color: formatted ? "var(--gray-12)" : "var(--gray-8)",
          fontWeight: formatted ? 500 : 400,
        }}
      >
        {formatted || "—"}
      </Text>
    </div>
  );
}

/* ─── Célula de data INTERNO editável ─────────────────────────────────────── */
function PlanDateEditCell({ label, field, isEdit, draft, setDraft }) {
  const draftValue = draft[field] ?? "";
  const formatted = formatDate(draftValue || null);

  return (
    <div
      style={{
        ...CARD_STYLE,
        marginBottom: 4,
        border: isEdit
          ? "1px solid var(--gray-6)"
          : "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <span
        style={{
          ...LABEL_STYLE,
          color: isEdit ? "var(--blue-9)" : "var(--gray-10)",
        }}
      >
        {label}
      </span>
      {isEdit ? (
        <input
          type="date"
          style={DATE_INPUT_STYLE}
          value={toDateInputValue(draftValue)}
          onChange={(e) =>
            setDraft((p) => ({ ...p, [field]: e.target.value || null }))
          }
        />
      ) : (
        <Text
          size="2"
          style={{
            color: formatted ? "var(--gray-12)" : "var(--gray-8)",
            fontWeight: formatted ? 500 : 400,
          }}
        >
          {formatted || "—"}
        </Text>
      )}
    </div>
  );
}

/* ─── Tab GERAL ────────────────────────────────────────────────────────────── */
function TabGeral({ ticket, isEdit, draft, setDraft, prioMeta }) {
  const prioLabel = prioMeta ? `${prioMeta.label} – ${prioMeta.description}` : null;
  const prioColor = prioMeta?.color ?? "var(--gray-8)";

  return (
    <Flex direction="column" gap="2">
      {/* Linha 1: ISSUE_KEY + SUMMARY */}
      <Flex gap="2" align="stretch">
        <FieldBox label="ISSUE_KEY" style={{ flex: "0 0 auto", minWidth: 120 }}>
          {ticket.issueUrl ? (
            <a
              href={ticket.issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#38bdf8",
                fontWeight: 700,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                gap: 4,
                textDecoration: "none",
              }}
            >
              {ticket.issueKey} <ExternalLink size={11} />
            </a>
          ) : (
            <Text size="2" weight="bold">
              {ticket.issueKey || "—"}
            </Text>
          )}
        </FieldBox>
        <FieldBox label="SUMMARY" style={{ flex: 1 }}>
          <Text size="2" style={{ lineHeight: 1.5, wordBreak: "break-word" }}>
            {ticket.summary || "—"}
          </Text>
        </FieldBox>
      </Flex>

      {/* Linha 2: PRIORIDADE | ESTIMATIVA MACRO | ESTIMATIVA TOTAL | NATUREZA DA OPERAÇÃO */}
      <Flex gap="2" align="stretch">
        <FieldBox label="PRIORIDADE" style={{ flex: 1 }}>
          {isEdit ? (
            <Select.Root
              value={String(draft.prioridadeInterna || "")}
              onValueChange={(v) =>
                setDraft((p) => ({ ...p, prioridadeInterna: v }))
              }
            >
              <Select.Trigger
                style={{ width: "100%", fontSize: 11 }}
                placeholder="—"
              />
              <Select.Content>
                <Select.Item value="">—</Select.Item>
                {PRIORIDADE_INTERNA_OPTIONS.map((p) => (
                  <Select.Item key={p.value} value={String(p.value)}>
                    {p.label} – {p.description}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          ) : prioLabel ? (
            <Text size="2" style={{ color: prioColor, fontWeight: 600 }}>
              {prioLabel}
            </Text>
          ) : (
            <Text size="2" color="gray">
              —
            </Text>
          )}
        </FieldBox>

        <FieldBox label="ESTIMATIVA MACRO" style={{ flex: 1 }}>
          {isEdit ? (
            <input
              type="number"
              min="0"
              step="0.5"
              value={draft.estimativaMacro ?? ""}
              onChange={(e) =>
                setDraft((p) => ({ ...p, estimativaMacro: e.target.value }))
              }
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                color: "var(--gray-12)",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
              }}
              placeholder="—"
            />
          ) : (
            <Text
              size="2"
              style={{
                color:
                  ticket.estimativaMacro != null
                    ? "var(--gray-12)"
                    : "var(--gray-8)",
              }}
            >
              {ticket.estimativaMacro != null
                ? `${ticket.estimativaMacro}h`
                : "—"}
            </Text>
          )}
        </FieldBox>

        <FieldBox label="ESTIMATIVA TOTAL" style={{ flex: 1 }}>
          <Text
            size="2"
            style={{
              color:
                ticket.estimativaHoras != null
                  ? "var(--gray-12)"
                  : "var(--gray-8)",
            }}
          >
            {ticket.estimativaHoras != null
              ? `${ticket.estimativaHoras}h`
              : "—"}
          </Text>
        </FieldBox>

        <FieldBox label="NATUREZA DA OPERAÇÃO" style={{ flex: 1.6 }}>
          <Text
            size="2"
            style={{
              color: ticket.naturezaIniciativa
                ? "var(--gray-12)"
                : "var(--gray-8)",
              wordBreak: "break-word",
            }}
          >
            {ticket.naturezaIniciativa || "—"}
          </Text>
        </FieldBox>
      </Flex>

      {/* Linha 3: SISTEMAS IMPACTADOS */}
      <FieldBox label="SISTEMAS IMPACTADOS">
        <Text
          size="2"
          style={{
            color: ticket.sistemasImpactados
              ? "var(--gray-12)"
              : "var(--gray-8)",
            wordBreak: "break-word",
          }}
        >
          {ticket.sistemasImpactados || "—"}
        </Text>
      </FieldBox>

      {/* Linha 4: IMPEDIDO + MOTIVO IMPEDIMENTO */}
      <Flex gap="2" align="stretch">
        <FieldBox
          label="IMPEDIDO"
          style={{
            flex: "0 0 auto",
            minWidth: 100,
            border: isEdit ? "1px solid var(--gray-6)" : CARD_STYLE.border,
          }}
        >
          {isEdit ? (
            <Flex align="center" gap="2" style={{ paddingTop: 2 }}>
              <input
                type="checkbox"
                checked={draft.impedimento || false}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, impedimento: e.target.checked }))
                }
                style={{ cursor: "pointer", width: 15, height: 15 }}
              />
              <Text size="2">{draft.impedimento ? "Sim" : "Não"}</Text>
            </Flex>
          ) : ticket.impedimento ? (
            <Badge color="yellow" variant="soft" size="1">
              Sim
            </Badge>
          ) : (
            <Text size="2" color="gray">
              Não
            </Text>
          )}
        </FieldBox>

        <FieldBox
          label="MOTIVO IMPEDIMENTO"
          style={{
            flex: 1,
            border: isEdit ? "1px solid var(--gray-6)" : CARD_STYLE.border,
          }}
        >
          {isEdit ? (
            <textarea
              style={{ ...TEXTAREA_STYLE, minHeight: 48 }}
              value={draft.motivoImpedimento || ""}
              placeholder="Descreva o motivo do impedimento..."
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  motivoImpedimento: e.target.value,
                }))
              }
            />
          ) : (
            <Text
              size="2"
              style={{
                color: ticket.motivoImpedimento
                  ? "var(--gray-12)"
                  : "var(--gray-8)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {ticket.motivoImpedimento || "—"}
            </Text>
          )}
        </FieldBox>
      </Flex>

      {/* Linha 5: OBSERVAÇÃO */}
      <FieldBox
        label="OBSERVAÇÃO"
        style={{
          border: isEdit ? "1px solid var(--gray-6)" : CARD_STYLE.border,
        }}
      >
        {isEdit ? (
          <textarea
            style={TEXTAREA_STYLE}
            value={draft.observacaoAdicional || ""}
            placeholder="Digite uma observação sobre esta demanda..."
            onChange={(e) =>
              setDraft((p) => ({ ...p, observacaoAdicional: e.target.value }))
            }
          />
        ) : (
          <Text
            size="2"
            style={{
              color: ticket.observacaoAdicional
                ? "var(--gray-12)"
                : "var(--gray-8)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: 1.6,
            }}
          >
            {ticket.observacaoAdicional || "Nenhuma observação registrada."}
          </Text>
        )}
      </FieldBox>
    </Flex>
  );
}

/* ─── Tab PLANEJAMENTO ─────────────────────────────────────────────────────── */
function TabPlanejamento({ ticket, isEdit, draft, setDraft }) {
  return (
    <Flex gap="4" align="flex-start">
      {/* Coluna JIRA (somente leitura) */}
      <Flex direction="column" style={{ flex: 1 }}>
        <Text
          size="1"
          weight="bold"
          style={{
            color: "var(--gray-9)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Jira
        </Text>
        <PlanDateCell label="Data Aprovação EFSR" value={ticket.dataAprovacaoEfsr} />
        <PlanDateCell label="Data Início Atend. Plan." value={ticket.dataInicioAtendimentoPlanejada} />
        <PlanDateCell label="Data Início Atendimento" value={ticket.dataInicioAtendimento} />
        <PlanDateCell label="Data Aprovação QA Plan." value={ticket.dataAprovacaoQaPlanejada} />
        <PlanDateCell label="Data Início HML Plan." value={ticket.dataInicioHomologacaoPlanejada} />
        <PlanDateCell label="Data Início HML Efetiva" value={ticket.dataInicioHomologacaoEfetiva} />
        <PlanDateCell label="Data Fim HML Plan." value={ticket.dataFimHomologacaoPlanejada} />
        <PlanDateCell label="Data Fim HML Efetiva" value={ticket.dataFimHomologacaoEfetiva} />
        <PlanDateCell label="Data Entrega Produção Prevista" value={ticket.dataEntregaProducaoPrevista} />
        <PlanDateCell label="Data Fim Planejado" value={ticket.dataFimPlanejado} />
      </Flex>

      {/* Coluna INTERNO (editável) */}
      <Flex direction="column" style={{ flex: 1 }}>
        <Text
          size="1"
          weight="bold"
          style={{
            color: isEdit ? "var(--blue-9)" : "var(--gray-9)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Interno {isEdit && <span style={{ fontSize: 9, opacity: 0.7 }}>(editável)</span>}
        </Text>
        <PlanDateEditCell label="Data Fim Desenvolvimento" field="dataFimDesenvolvimento" isEdit={isEdit} draft={draft} setDraft={setDraft} />
        <PlanDateEditCell label="Data Fim Teste Interno" field="dataFimTesteInterno" isEdit={isEdit} draft={draft} setDraft={setDraft} />
        <PlanDateEditCell label="Data Fim Teste (QA)" field="dataFimTesteQA" isEdit={isEdit} draft={draft} setDraft={setDraft} />
        <PlanDateEditCell label="Data Fim Homologação" field="dataFimHomologacao" isEdit={isEdit} draft={draft} setDraft={setDraft} />
        <PlanDateEditCell label="Data Conclusão" field="dataConclusao" isEdit={isEdit} draft={draft} setDraft={setDraft} />
      </Flex>
    </Flex>
  );
}

/* ─── Tab DETALHES ─────────────────────────────────────────────────────────── */
function TabDetalhes({ ticket }) {
  const linked = ticket.linkedWorkItems?.length
    ? ticket.linkedWorkItems.join(", ")
    : ticket.linkedTicketKeys?.length
      ? ticket.linkedTicketKeys.join(", ")
      : null;

  return (
    <Flex direction="column" gap="2">
      <Flex gap="2" align="stretch">
        <FieldBox label="STATUS" style={{ flex: 1 }}>
          <Text size="2">{ticket.status || "—"}</Text>
        </FieldBox>
        <FieldBox label="PRIORIDADE JIRA" style={{ flex: 1 }}>
          <Text size="2">{ticket.priority || "—"}</Text>
        </FieldBox>
        <FieldBox label="TIPO" style={{ flex: 1 }}>
          <Text size="2">{ticket.issueType || "—"}</Text>
        </FieldBox>
      </Flex>

      <Flex gap="2" align="stretch">
        <FieldBox label="PROJETO" style={{ flex: 1 }}>
          <Text size="2">{ticket.projectName || ticket.projectKey || "—"}</Text>
        </FieldBox>
        <FieldBox label="ASSIGNEE" style={{ flex: 1 }}>
          <Text size="2">{ticket.assignee || "—"}</Text>
        </FieldBox>
        <FieldBox label="REPORTER" style={{ flex: 1 }}>
          <Text size="2">{ticket.reporter || "—"}</Text>
        </FieldBox>
      </Flex>

      <Flex gap="2" align="stretch">
        <FieldBox label="EMPRESA" style={{ flex: 1 }}>
          <Text size="2">{ticket.empresa || "—"}</Text>
        </FieldBox>
        <FieldBox label="FORNECEDOR" style={{ flex: 1 }}>
          <Text size="2">{ticket.fornecedor || "—"}</Text>
        </FieldBox>
        <FieldBox label="TORRE ATUAÇÃO" style={{ flex: 1 }}>
          <Text size="2">{ticket.torreAtuacao || "—"}</Text>
        </FieldBox>
      </Flex>

      <Flex gap="2" align="stretch">
        <FieldBox label="GRUPO SUPORTE" style={{ flex: 1 }}>
          <Text size="2">{ticket.grupoSuporte || "—"}</Text>
        </FieldBox>
        <FieldBox label="PARENT KEY" style={{ flex: 1 }}>
          <Text size="2">{ticket.parentKey || "—"}</Text>
        </FieldBox>
        <FieldBox label="EPIC KEY" style={{ flex: 1 }}>
          <Text size="2">{ticket.epicKey || "—"}</Text>
        </FieldBox>
      </Flex>

      <Flex gap="2" align="stretch">
        <FieldBox label="CRIADO EM" style={{ flex: 1 }}>
          <Text size="2">{formatDate(ticket.createdAt) || "—"}</Text>
        </FieldBox>
        <FieldBox label="ATUALIZADO EM" style={{ flex: 1 }}>
          <Text size="2">{formatDate(ticket.updatedAt) || "—"}</Text>
        </FieldBox>
        <FieldBox label="RESOLVIDO EM" style={{ flex: 1 }}>
          <Text size="2">{formatDate(ticket.resolvedAt) || "—"}</Text>
        </FieldBox>
      </Flex>

      {linked && (
        <FieldBox label="DEMANDAS VINCULADAS">
          <Text size="2" style={{ wordBreak: "break-word" }}>{linked}</Text>
        </FieldBox>
      )}

      {ticket.labels?.length > 0 && (
        <FieldBox label="LABELS">
          <Flex gap="1" wrap="wrap">
            {ticket.labels.map((l) => (
              <Badge key={l} variant="soft" size="1">{l}</Badge>
            ))}
          </Flex>
        </FieldBox>
      )}

      {ticket.components?.length > 0 && (
        <FieldBox label="COMPONENTES">
          <Flex gap="1" wrap="wrap">
            {ticket.components.map((c) => (
              <Badge key={c} variant="outline" size="1">{c}</Badge>
            ))}
          </Flex>
        </FieldBox>
      )}
    </Flex>
  );
}

/* ─── Modal principal ──────────────────────────────────────────────────────── */
export default function OperacaoDemandaModal({ ticket, open, onClose, onSaved }) {
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({});

  const prioMeta = ticket
    ? PRIORIDADE_INTERNA_OPTIONS.find(
        (p) => p.value === Number(draft.prioridadeInterna ?? ticket.prioridadeInterna)
      ) || null
    : null;

  function handleEdit() {
    setDraft({
      prioridadeInterna: ticket?.prioridadeInterna ?? "",
      estimativaMacro: ticket?.estimativaMacro ?? "",
      impedimento: ticket?.impedimento ?? false,
      motivoImpedimento: ticket?.motivoImpedimento ?? "",
      observacaoAdicional: ticket?.observacaoAdicional ?? "",
      // Datas INTERNO
      dataFimDesenvolvimento: ticket?.dataFimDesenvolvimento ?? null,
      dataFimTesteInterno: ticket?.dataFimTesteInterno ?? null,
      dataFimTesteQA: ticket?.dataFimTesteQA ?? null,
      dataFimHomologacao: ticket?.dataFimHomologacao ?? null,
      dataConclusao: ticket?.dataConclusao ?? null,
    });
    setIsEdit(true);
  }

  function handleCancel() {
    setDraft({});
    setIsEdit(false);
  }

  async function handleSave() {
    if (!ticket?.issueKey) return;
    setSaving(true);
    try {
      await updateTicketRadarFields(ticket.issueKey, {
        prioridadeInterna: draft.prioridadeInterna,
        estimativaMacro: draft.estimativaMacro,
        impedimento: draft.impedimento,
        motivoImpedimento: draft.motivoImpedimento,
        observacaoAdicional: draft.observacaoAdicional,
        dataFimDesenvolvimento: draft.dataFimDesenvolvimento,
        dataFimTesteInterno: draft.dataFimTesteInterno,
        dataFimTesteQA: draft.dataFimTesteQA,
        dataFimHomologacao: draft.dataFimHomologacao,
        dataConclusao: draft.dataConclusao,
      });
      onSaved?.({
        ...ticket,
        ...draft,
      });
      setIsEdit(false);
      setDraft({});
    } catch (err) {
      console.error("Erro ao salvar campos radar:", err);
    } finally {
      setSaving(false);
    }
  }

  if (!ticket) return null;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) { handleCancel(); onClose?.(); } }}>
      <Dialog.Content
        style={{
          maxWidth: 900,
          width: "95vw",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "var(--gray-2)",
          border: "1px solid var(--gray-5)",
          borderRadius: 12,
          padding: 0,
        }}
      >
        {/* Header */}
        <Flex
          align="center"
          justify="between"
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--gray-5)",
            flexShrink: 0,
          }}
        >
          <Flex align="center" gap="2">
            <Text size="3" weight="bold">
              {ticket.issueKey}
            </Text>
            <Badge
              variant="soft"
              size="1"
              style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              {ticket.escopo || "—"}
            </Badge>
            {ticket.impedimento && (
              <Badge color="yellow" variant="soft" size="1">
                Impedido
              </Badge>
            )}
          </Flex>

          <Flex align="center" gap="2">
            {isEdit ? (
              <>
                <Button
                  size="1"
                  variant="soft"
                  color="gray"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  size="1"
                  onClick={handleSave}
                  loading={saving}
                >
                  Salvar
                </Button>
              </>
            ) : (
              <Button size="1" variant="soft" onClick={handleEdit}>
                ✏ Editar
              </Button>
            )}
            <Dialog.Close>
              <Button size="1" variant="ghost" color="gray">
                ✕
              </Button>
            </Dialog.Close>
          </Flex>
        </Flex>

        {/* Conteúdo com Tabs */}
        <Tabs.Root defaultValue="geral" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <Tabs.List style={{ flexShrink: 0, padding: "0 18px", borderBottom: "1px solid var(--gray-5)" }}>
            <Tabs.Trigger value="geral">Geral</Tabs.Trigger>
            <Tabs.Trigger value="planejamento">Planejamento</Tabs.Trigger>
            <Tabs.Trigger value="detalhes">Detalhes</Tabs.Trigger>
          </Tabs.List>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
            <Tabs.Content value="geral">
              <TabGeral ticket={ticket} isEdit={isEdit} draft={draft} setDraft={setDraft} prioMeta={prioMeta} />
            </Tabs.Content>
            <Tabs.Content value="planejamento">
              <TabPlanejamento ticket={ticket} isEdit={isEdit} draft={draft} setDraft={setDraft} />
            </Tabs.Content>
            <Tabs.Content value="detalhes">
              <TabDetalhes ticket={ticket} />
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </Dialog.Content>
    </Dialog.Root>
  );
}
