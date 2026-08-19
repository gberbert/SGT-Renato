import React, { useMemo } from 'react';
import { Box, Flex, Text, Card, Badge, Callout, Table, Grid } from '@radix-ui/themes';
import { Settings, FileText, Info, Link2, Database } from 'lucide-react';
import { getOperacaoJqlConfig } from '../../utils/jqlCargaClient';

const OperacaoConfig = ({ userRole, embedded = false }) => {
  const isAdmin = userRole === 'admin';
  const config = useMemo(() => (isAdmin ? getOperacaoJqlConfig() : null), [isAdmin]);
  const boxPadding = embedded ? '0' : '5';

  if (!isAdmin) {
    return (
      <Box p={boxPadding}>
        <Callout.Root color="amber">
          <Callout.Text>
            Apenas administradores podem visualizar a configuração de carga Jira.
          </Callout.Text>
        </Callout.Root>
      </Box>
    );
  }

  const fieldRows = Object.entries(config.fieldDefinitions || {});

  return (
    <Box p={boxPadding}>
      {!embedded && (
        <Flex direction="column" gap="2" mb="5">
          <Flex align="center" gap="3">
            <Settings size={26} color="var(--info)" />
            <Text size="7" weight="bold">Configuração Jira CPFL</Text>
          </Flex>
          <Text size="3" color="gray">
            Espelha o projeto jira-cpfl-sync: consultas em{' '}
            <code>{config.jqlFile}</code>, campos customizados e destino no Firestore.
          </Text>
        </Flex>
      )}
      {embedded && (
        <Text size="2" color="gray" mb="4" as="p">
          Consultas em <code>{config.jqlFile}</code>, campos customizados e destino no Firestore.
        </Text>
      )}

      <Callout.Root color="blue" mb="4">
        <Callout.Icon><Info size={16} /></Callout.Icon>
        <Callout.Text>
          Esta tela carrega a configuração localmente (sem Cloud Function). Prévia e carga continuam
          no servidor e exigem deploy das functions com credenciais Jira.
        </Callout.Text>
      </Callout.Root>

      <Grid columns={{ initial: '1', md: '2' }} gap="4" mb="5">
        <Card className="glass-panel" style={{ border: '1px solid var(--glass-border)' }}>
          <Flex direction="column" gap="3" p="4">
            <Flex align="center" gap="2">
              <Link2 size={18} color="var(--info)" />
              <Text size="4" weight="bold">Conexão Jira</Text>
            </Flex>
            <Table.Root variant="surface" size="1">
              <Table.Body>
                <Table.Row>
                  <Table.RowHeaderCell>Domínio</Table.RowHeaderCell>
                  <Table.Cell>
                    <code>{config.jiraDomain}</code>
                  </Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.RowHeaderCell>API</Table.RowHeaderCell>
                  <Table.Cell><code>/rest/api/3/</code> (somente leitura)</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.RowHeaderCell>Credenciais</Table.RowHeaderCell>
                  <Table.Cell>
                    <Text size="2" color="gray">
                      JIRA_API_TOKEN, JIRA_USER_EMAIL, JIRA_DOMAIN — apenas nas Cloud Functions
                    </Text>
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
          </Flex>
        </Card>

        <Card className="glass-panel" style={{ border: '1px solid var(--glass-border)' }}>
          <Flex direction="column" gap="3" p="4">
            <Flex align="center" gap="2">
              <Database size={18} color="var(--info)" />
              <Text size="4" weight="bold">Destino Firestore</Text>
            </Flex>
            <Table.Root variant="surface" size="1">
              <Table.Body>
                {Object.entries(config.collections).map(([key, value]) => (
                  <Table.Row key={key}>
                    <Table.RowHeaderCell>{key}</Table.RowHeaderCell>
                    <Table.Cell><code>{value}</code></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Flex>
        </Card>
      </Grid>

      <Card className="glass-panel" mb="5" style={{ border: '1px solid var(--glass-border)' }}>
        <Flex direction="column" gap="3" p="4">
          <Text size="4" weight="bold">Escopos de carga ({config.escopos.length})</Text>
          <Flex gap="2" wrap="wrap">
            {config.escopos.map((item) => (
              <Badge key={item.id} color="blue" size="2">
                {item.ordem}. {item.nome}
              </Badge>
            ))}
          </Flex>
        </Flex>
      </Card>

      <Card className="glass-panel" mb="5" style={{ border: '1px solid var(--glass-border)' }}>
        <Flex direction="column" gap="3" p="4">
          <Text size="4" weight="bold">Campos Jira mapeados</Text>
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Coluna Firestore</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Nomes no Jira (fallback)</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {fieldRows.map(([col, names]) => (
                <Table.Row key={col}>
                  <Table.Cell><code>{col}</code></Table.Cell>
                  <Table.Cell>{names.join(' · ')}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Flex>
      </Card>

      <Text size="5" weight="bold" mb="3">
        Consultas JQL ({config.batches.length})
      </Text>

      <Flex direction="column" gap="4">
        {config.batches.map((batch, index) => (
          <Card key={batch.escopoId || index} className="glass-panel" style={{ border: '1px solid var(--glass-border)' }}>
            <Flex direction="column" gap="3" p="4">
              <Flex align="center" justify="between" gap="3" wrap="wrap">
                <Flex align="center" gap="2">
                  <FileText size={18} color="var(--info)" />
                  <Text size="4" weight="bold">{batch.label}</Text>
                </Flex>
                <Badge color="blue">{batch.escopo}</Badge>
              </Flex>
              <Text size="1" color="gray">ID escopo: {batch.escopoId}</Text>
              <Box
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  borderRadius: '8px',
                  padding: '12px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  border: '1px solid var(--glass-border)',
                }}
              >
                {batch.jql}
              </Box>
            </Flex>
          </Card>
        ))}
      </Flex>
    </Box>
  );
};

export default OperacaoConfig;
