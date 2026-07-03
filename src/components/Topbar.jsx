import React from 'react';
import { Search, Plus, Bell } from 'lucide-react';

const Topbar = ({ onNewTicketClick }) => {
  return (
    <header className="topbar">
      <div className="topbar-search">
        <Search size={18} />
        <input type="text" placeholder="Buscar tickets, projetos (RF-07)..." />
      </div>
      <div className="topbar-actions">
        <button className="btn btn-primary" onClick={onNewTicketClick}>
          <Plus size={18} /> Novo Ticket
        </button>
        <button className="btn-icon">
          <Bell size={20} />
        </button>
      </div>
    </header>
  );
};

export default Topbar;
