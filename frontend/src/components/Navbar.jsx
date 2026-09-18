import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const HOME_BY_ROLE = {
  student: '/student',
  lecturer: '/lecturer',
  school_admin: '/admin',
  platform_admin: '/platform'
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="border-b-2 border-gold/70 bg-parchment/95 backdrop-blur sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to={user ? HOME_BY_ROLE[user.role] : '/'} className="font-display text-xl font-semibold text-ink tracking-tight">
          IMBONI <span className="text-sky">Education</span> <span className="text-leaf">Hub</span>
        </Link>
        {user ? (
          <div className="flex items-center gap-4 font-body text-sm">
            <span className="font-mono text-xs text-ink/50 uppercase">{user.role.replace('_', ' ')}</span>
            <span className="hidden sm:inline text-ink/80">{user.full_names}</span>
            <button
              className="btn-secondary !px-3 !py-1.5 text-sm"
              onClick={() => { logout(); navigate('/login'); }}
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-secondary !px-4 !py-2 text-sm">Log in</Link>
            <Link to="/register" className="btn-primary !px-4 !py-2 text-sm">Register</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
