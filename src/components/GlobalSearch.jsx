import React, { useState, useEffect, useRef } from 'react';
import { subscribeToTickets } from '../services/ticketService';
import { Search } from 'lucide-react';
import { Box, Flex, Text } from '@radix-ui/themes';

const GlobalSearch = ({ onSelectTicket }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tickets, setTickets] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeToTickets((data) => {
      setTickets(data);
    }, (err) => console.error(err));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTickets = tickets.filter(t => {
    if (!searchTerm) return false;
    const lowerSearch = searchTerm.toLowerCase();
    return (
      (t.title && t.title.toLowerCase().includes(lowerSearch)) ||
      (t.code && t.code.toLowerCase().includes(lowerSearch)) ||
      (t.description && t.description.toLowerCase().includes(lowerSearch)) ||
      (t.assignee && t.assignee.toLowerCase().includes(lowerSearch))
    );
  }).slice(0, 5); // Limit to top 5 results

  return (
    <div className="topbar-search" style={{ position: 'relative' }} ref={dropdownRef}>
      <Search size={18} color="var(--text-muted)" />
      <input 
        type="text" 
        placeholder="Buscar tickets, projetos..." 
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />
      
      {isOpen && searchTerm && (
        <Box 
          style={{ 
            position: 'absolute', 
            top: '45px', 
            left: 0, 
            width: '100%', 
            background: 'var(--bg-surface)', 
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            zIndex: 1000,
            overflow: 'hidden'
          }}
        >
          {filteredTickets.length > 0 ? (
            filteredTickets.map(ticket => (
              <Flex 
                key={ticket.id} 
                direction="column" 
                p="3" 
                style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'background 0.2s' }}
                onClick={() => {
                  setIsOpen(false);
                  setSearchTerm('');
                  onSelectTicket(ticket);
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Flex justify="between" align="center" mb="1">
                  <Text size="2" weight="bold" color="iris">{ticket.code}</Text>
                  <Text size="1" color="gray" style={{ textTransform: 'capitalize' }}>{ticket.status || ticket.columnId}</Text>
                </Flex>
                <Text size="2" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ticket.title}
                </Text>
              </Flex>
            ))
          ) : (
            <Box p="3">
              <Text size="2" color="gray">Nenhum resultado encontrado.</Text>
            </Box>
          )}
        </Box>
      )}
    </div>
  );
};

export default GlobalSearch;
