import React, { useState, useEffect } from 'react';
import { Dialog, Flex, Text, Button, Card } from '@radix-ui/themes';
import { X, Plus, Trash2, Edit2 } from 'lucide-react';
import {
  getSquadRoles,
  createSquadRole,
  updateSquadRole,
  deleteSquadRole,
  subscribeToSquadRoles,
} from '../services/squadRolesService';

const S = {
  inp: {
    width: '100%',
    height: 34,
    borderRadius: 8,
    background: '#232336',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'var(--text)',
    padding: '0 10px',
    fontSize: 13,
    boxSizing: 'border-box',
  },
  lbl: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--gray-9)',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 3,
  },
};

export default function SquadRolesManagerModal({ open, onOpenChange }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', squadId: '' });
  const [squads, setSquads] = useState([]);

  // Subscribe to roles in real-time
  useEffect(() => {
    if (!open) return;
    const unsubscribe = subscribeToSquadRoles(setRoles);
    return () => unsubscribe?.();
  }, [open]);

  // Load squads for reference
  useEffect(() => {
    if (!open) return;
    loadSquads();
  }, [open]);

  const loadSquads = async () => {
    try {
      // Get squads from the squads collection
      const { getDocs, collection } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const snapshot = await getDocs(collection(db, 'squads'));
      setSquads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error loading squads:', error);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    try {
      if (editingId) {
        await updateSquadRole(editingId, {
          name: formData.name,
          description: formData.description,
          squadId: formData.squadId || null,
        });
      } else {
        await createSquadRole({
          name: formData.name,
          description: formData.description,
          squadId: formData.squadId || null,
        });
      }
      setFormData({ name: '', description: '', squadId: '' });
      setEditingId(null);
    } catch (error) {
      console.error('Error saving role:', error);
      alert('Erro ao salvar papel: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = role => {
    setEditingId(role.id);
    setFormData({
      name: role.name,
      description: role.description || '',
      squadId: role.squadId || '',
    });
  };

  const handleDelete = async roleId => {
    if (!window.confirm('Deseja realmente deletar este papel?')) return;

    setLoading(true);
    try {
      await deleteSquadRole(roleId);
    } catch (error) {
      console.error('Error deleting role:', error);
      alert('Erro ao deletar papel: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ name: '', description: '', squadId: '' });
  };

  const getSquadName = squadId => {
    if (!squadId) return 'Global';
    const squad = squads.find(s => s.id === squadId);
    return squad?.name || squadId;
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 900 }}>
        <Dialog.Title>
          <Flex justify="between" align="center">
            <Text>Gerenciar Papéis de Squad</Text>
            <Dialog.Close asChild>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--gray-9)',
                }}
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </Flex>
        </Dialog.Title>

        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Form */}
          <Card size="2" style={{ padding: '16px', background: 'rgba(99,102,241,0.05)', border: '1px solid var(--indigo-6)' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span style={S.lbl}>Nome do Papel</span>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Tech Lead, Desenvolvedor Senior..."
                  style={S.inp}
                  disabled={loading}
                />
              </div>

              <div>
                <span style={S.lbl}>Descrição (Opcional)</span>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição do papel..."
                  style={{
                    ...S.inp,
                    height: 60,
                    padding: '8px 10px',
                    fontFamily: 'inherit',
                    resize: 'none',
                  }}
                  disabled={loading}
                />
              </div>

              <div>
                <span style={S.lbl}>Squad (Opcional - deixe vazio para global)</span>
                <select
                  value={formData.squadId}
                  onChange={e => setFormData(prev => ({ ...prev, squadId: e.target.value }))}
                  style={{
                    ...S.inp,
                    cursor: 'pointer',
                  }}
                  disabled={loading}
                >
                  <option value="">Global (disponível para todas as squads)</option>
                  {squads.map(squad => (
                    <option key={squad.id} value={squad.id}>
                      {squad.name}
                    </option>
                  ))}
                </select>
              </div>

              <Flex gap="2">
                <Button
                  type="submit"
                  disabled={loading || !formData.name.trim()}
                  style={{
                    background: 'var(--indigo-9)',
                    color: 'white',
                    cursor: loading || !formData.name.trim() ? 'not-allowed' : 'pointer',
                    opacity: loading || !formData.name.trim() ? 0.6 : 1,
                    flex: 1,
                  }}
                >
                  <Plus size={14} style={{ marginRight: '6px' }} />
                  {editingId ? 'Atualizar' : 'Adicionar'}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    onClick={handleCancel}
                    variant="soft"
                    style={{ cursor: 'pointer' }}
                  >
                    Cancelar
                  </Button>
                )}
              </Flex>
            </form>
          </Card>

          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Text size="2" weight="bold" style={{ marginBottom: '8px' }}>
              Papéis Cadastrados ({roles.length})
            </Text>

            {roles.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: 'var(--gray-7)',
                  fontSize: 13,
                }}
              >
                Nenhum papel cadastrado ainda.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 400, overflowY: 'auto' }}>
                {roles.map(role => (
                  <div
                    key={role.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        {role.name}
                      </div>
                      {role.description && (
                        <div style={{ fontSize: 11, color: 'var(--gray-7)', marginTop: '4px' }}>
                          {role.description}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: 'var(--gray-8)', marginTop: '4px' }}>
                        Squad: <span style={{ color: 'var(--indigo-10)', fontWeight: 600 }}>{getSquadName(role.squadId)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleEdit(role)}
                        disabled={loading}
                        style={{
                          background: 'rgba(99,102,241,0.15)',
                          border: '1px solid rgba(99,102,241,0.3)',
                          borderRadius: 6,
                          padding: '6px 10px',
                          cursor: 'pointer',
                          color: 'var(--indigo-9)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: 12,
                        }}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(role.id)}
                        disabled={loading}
                        style={{
                          background: 'rgba(239,68,68,0.15)',
                          border: '1px solid rgba(239,68,68,0.3)',
                          borderRadius: 6,
                          padding: '6px 10px',
                          cursor: 'pointer',
                          color: 'var(--red-9)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: 12,
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
