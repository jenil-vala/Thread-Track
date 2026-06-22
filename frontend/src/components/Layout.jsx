import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Layers,
  Users,
  IndianRupee,
  FileBarChart,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/sarees', label: 'Saree Lots', icon: Layers },
    { path: '/vendors', label: 'Vendors (Hisab)', icon: Users },
    { path: '/payments', label: 'Payments', icon: IndianRupee },
    { path: '/reports', label: 'Reports', icon: FileBarChart }
  ];


  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 border-r border-slate-800 transition-all duration-300`}>
        <div>
          {/* Logo */}
          <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-6'} border-b border-slate-800 bg-slate-950 transition-all duration-300`}>
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm shrink-0">
              TT
            </div>
            {!isCollapsed && <span className="font-extrabold text-white text-lg tracking-wide whitespace-nowrap animate-fade-in">Thread Track</span>}
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={isCollapsed ? item.label : ""}
                  className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                      : 'hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!isCollapsed && <span className="whitespace-nowrap animate-fade-in">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile Footer */}
        <div className={`p-4 border-t border-slate-800 bg-slate-950/40 transition-all duration-300 ${isCollapsed ? 'flex flex-col items-center gap-4' : ''}`}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700">
                  <User className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <h4 className="text-sm font-bold text-white truncate">{user?.name || 'User'}</h4>
                  <p className="text-xs text-slate-500 capitalize">{user?.role || 'Operator'}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:bg-rose-950/30 hover:text-rose-400 border border-transparent hover:border-rose-900/30 transition-all active:scale-[0.98]"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700 shrink-0" title={`${user?.name} (${user?.role})`}>
                <User className="w-5 h-5" />
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="flex items-center justify-center p-2.5 rounded-xl text-slate-400 hover:bg-rose-950/30 hover:text-rose-400 border border-transparent hover:border-rose-900/30 transition-all active:scale-[0.98]"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden animate-fade-in">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all border border-slate-200 shadow-sm active:scale-95"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
            <h2 className="text-xl font-bold text-slate-800 capitalize">
              {navItems.find(item => item.path === location.pathname)?.label || 'Thread Track'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 hidden sm:block">
              Active Session: {user?.name || 'Operator'}
            </div>
            <div className="text-sm text-slate-500 font-medium hidden md:block">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          <div className="max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
