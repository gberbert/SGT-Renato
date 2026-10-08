import React, { useMemo, useState } from 'react';
import { Box, Flex, Text, Card, Badge, Table, Button, ScrollArea } from '@radix-ui/themes';
import { ChevronDown, ChevronRight, ShieldCheck, RefreshCw, Calculator, Database, ListChecks } from 'lucide-react';
import { CARGA_FIELD_CATALOG, CATEGORIAS } from './cargaFieldData';

const SYNC_META = {
  sempre:         { label: 'Sincronizado', color: 'green',  title: 'Atualizado a cada carga' },
  primeira_carga: { label: '1ª carga',     color: 'amber',  title: 'Gravado apenas no primeiro upsert do ticket' },
  nunca:          { label: 'SGT Protegido', color: 'red',   title: 'Nunca sobrescrito pelo sync — editado somente via UI' },
  calculado:      { label: 'Calculado',    color: 'blue',   title: 'Calculado internamente pelo sistema' },
};

const ORIGEM_META = {
  jira:      { label: 'Jira',      color: 'blue'   },
  sgt:       { label: 'SGT',       color: 'violet' },
  calculado: { label: 'Sistema',   color: 'cyan'   },
  carga:     { label: 'Carga',     color: 'gray'   },
};

function SyncBadge({ sync }) {
  const m = SYNC_META[sync] || { label: sync, color: 'gray', title: '' };
  return <Badge color={m.color} size="1" title={m.title}>{m.label}</Badge>;
}

function OrigemBadge({ origem }) {
  const m = ORIGEM_META[origem] || { label: origem, color: 'gray' };
  return <Badge color={m.color} variant="soft" size="1">{m.label}</Badge>;
}

export default function CargaFieldCatalogPanel() {
  const [open, setOpen] = useState(false);
  const [filterSync, setFilterSync] = useState('todos');
  const [openCats, setOpenCats] = useState({});

  const filtered = useMemo(() => {
    if (filterSync === 'todos') return CARGA_FIELD_CATALOG;
    return CARGA_FIELD_CATALOG.filter((f) => f.sync === filterSync);
  }, [filterSync]);

  const byCategory = useMemo(() => {
    const map = {};
    for (const f of filtered) {
      if (!map[f.categoria]) map[f.categoria] = [];
      map[f.categoria].push(f);
    }
    return map;
  }, [filtered]);

  const toggleCat = (cat) => setOpenCats((p) => ({ ...p, [cat]: !p[cat] }));

  const counts = useMemo(() => ({
    total: CARGA_FIELD_CATALOG.length,
    sempre: CARGA_FIELD_CATALOG.filter((f) => f.sync === 'sempre').length,
    primeira_carga: CARGA_FIELD_CATALOG.filter((f) => f.sync === 'primeira_carga').length,
    nunca: CARGA_FIELD_CATALOG.filter((f) => f.sync === 'nunca').length,
    calculado: CARGA_FIELD_CATALOG.filter((f) => f.sync === 'calculado').length,
  }), []);

  const FILTERS = [
    { key: 'todos',         label: `Todos (${counts.total})`,                color: 'gray'   },
    { key: 'sempre',        label: `Sincronizados (${counts.sempre})`,        color: 'green'  },
    { key: 'primeira_carga',label: `1ª carga (${counts.primeira_carga})`,     color: 'amber'  },
    { key: 'nunca',         label: `SGT Protegido (${counts.nunca})`,         color: 'red'    },
    { key: 'calculado',     label: `Calculados (${counts.calculado})`,        color: 'blue'   },
  ];

  return (
    <Card mb="4" style={{ border: open ? '1px solid var(--blue-6)' : undefined }}>
      {/* Header toggle */}
      <Flex
        align="center"
        justify="between"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen((p) => !p)}
      >
        <Flex align="center" gap="2">
          <ListChecks size={16} color="var(--blue-9)" />
          <Text size="3" weight="bold">Campos da Carga</Text>
          <Badge size="1" color="gray" variant="soft">{counts.total} campos</Badge>
        </Flex>
        <Flex align="center" gap="2">
          <Badge size="1" color="green">{counts.sempre} sync</Badge>
          <Badge size="1" color="red">{counts.nunca} protegidos</Badge>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </Flex>
      </Flex>

      {open && (
        <Box mt="3">
          <Text size="1" color="gray" mb="3" style={{ display: 'block' }}>
            Mapa completo dos campos capturados na carga Jira e seu comportamento de atualização no Firestore (<code>tickets_global</code>).
          </Text>

          {/* Summary badges */}
          <Flex gap="2" mb="3" wrap="wrap">
            <Flex align="center" gap="1">
              <RefreshCw size={12} color="var(--green-9)" />
              <Text size="1" color="gray">Sincronizado = atualizado a cada carga</Text>
            </Flex>
            <Flex align="center" gap="1">
              <Database size={12} color="var(--amber-9)" />
              <Text size="1" color="gray">1ª carga = gravado só no primeiro upsert</Text>
            </Flex>
            <Flex align="center" gap="1">
              <ShieldCheck size={12} color="var(--red-9)" />
              <Text size="1" color="gray">SGT Protegido = nunca sobrescrito pelo Jira</Text>
            </Flex>
            <Flex align="center" gap="1">
              <Calculator size={12} color="var(--blue-9)" />
              <Text size="1" color="gray">Calculado = gerado internamente</Text>
            </Flex>
          </Flex>

          {/* Filter pills */}
          <Flex gap="2" mb="3" wrap="wrap">
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                size="1"
                variant={filterSync === f.key ? 'solid' : 'soft'}
                color={f.color}
                onClick={() => setFilterSync(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </Flex>

          {/* Categories */}
          <Flex direction="column" gap="2">
            {Object.entries(byCategory).map(([cat, fields]) => {
              const isCatOpen = openCats[cat] !== false; // default open
              return (
                <Box key={cat} style={{ border: '1px solid var(--gray-4)', borderRadius: 8 }}>
                  <Flex
                    align="center"
                    justify="between"
                    p="2"
                    style={{ cursor: 'pointer', borderRadius: isCatOpen ? '8px 8px 0 0' : 8, background: 'var(--gray-2)' }}
                    onClick={() => toggleCat(cat)}
                  >
                    <Flex align="center" gap="2">
                      {isCatOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <Text size="2" weight="medium">{cat}</Text>
                      <Badge size="1" variant="soft" color="gray">{fields.length}</Badge>
                    </Flex>
                    <Flex gap="1">
                      {['sempre','primeira_carga','nunca','calculado'].map((s) => {
                        const n = fields.filter((f) => f.sync === s).length;
                        if (!n) return null;
                        return <Badge key={s} size="1" color={SYNC_META[s]?.color}>{n}</Badge>;
                      })}
                    </Flex>
                  </Flex>

                  {isCatOpen && (
                    <ScrollArea>
                      <Table.Root size="1">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeaderCell style={{ minWidth: 160 }}>Campo no sistema</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Label</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Origem</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Sync</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Campo Jira</Table.ColumnHeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {fields.map((f) => (
                            <Table.Row key={f.campo}>
                              <Table.Cell>
                                <Text size="1" style={{ fontFamily: 'monospace', color: 'var(--gray-12)' }}>{f.campo}</Text>
                              </Table.Cell>
                              <Table.Cell><Text size="1">{f.label}</Text></Table.Cell>
                              <Table.Cell><OrigemBadge origem={f.origem} /></Table.Cell>
                              <Table.Cell><SyncBadge sync={f.sync} /></Table.Cell>
                              <Table.Cell>
                                <Text size="1" style={{ fontFamily: 'monospace', color: 'var(--blue-11)' }}>{f.jiraField}</Text>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    </ScrollArea>
                  )}
                </Box>
              );
            })}
          </Flex>
        </Box>
      )}
    </Card>
  );
}
