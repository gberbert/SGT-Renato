import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, Box, Text } from '@radix-ui/themes';
import OperacaoConfig from './OperacaoConfig';
import OperacaoCarga from './OperacaoCarga';

const OperacaoJiraSettings = ({ userRole }) => {
  const [searchParams] = useSearchParams();
  const initialJiraTab = searchParams.get('jira') === 'carga' ? 'carga' : 'config';
  const [jiraTab, setJiraTab] = useState(initialJiraTab);

  useEffect(() => {
    const next = searchParams.get('jira') === 'carga' ? 'carga' : 'config';
    setJiraTab(next);
  }, [searchParams]);

  return (
    <Box>
      <Box mb="4">
        <Text as="h2" size="4" weight="bold">Jira Operação AMS</Text>
        <Text color="gray" as="p" size="2">
          Configuração das JQLs de carga e sincronização com o Firestore (<code>tickets_global</code>).
        </Text>
      </Box>

      <Tabs.Root value={jiraTab} onValueChange={setJiraTab}>
        <Tabs.List>
          <Tabs.Trigger value="config">Configuração Jira</Tabs.Trigger>
          <Tabs.Trigger value="carga">Carga Jira</Tabs.Trigger>
        </Tabs.List>

        <Box pt="4">
          <Tabs.Content value="config">
            <OperacaoConfig userRole={userRole} embedded />
          </Tabs.Content>
          <Tabs.Content value="carga">
            <OperacaoCarga userRole={userRole} embedded />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  );
};

export default OperacaoJiraSettings;
