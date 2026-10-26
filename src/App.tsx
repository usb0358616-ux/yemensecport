import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { Users, FileText, BarChart3, ShieldCheck, LogOut, Truck, Settings as SettingsIcon, Menu, X, Bell, User as UserIcon, LogIn, ChevronRight, Home, Search as SearchIcon, Globe, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Travelers from './pages/Travelers';
import Reports from './pages/Reports';
import Statistics from './pages/Statistics';
import Movements from './pages/Movements';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { Toaster } from './components/ui/sonner';
import { getCurrentUser, setCurrentUser } from './lib/storage';
import { useEffect, useState } from 'react';
import { Button } from './components/ui/button';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [globalSearch, setGlobalSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const user = getCurrentUser();

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/?search=${encodeURIComponent(globalSearch)}`);
      setGlobalSearch('');
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  const navItems = [
    { path: '/', label: 'المسافرين', icon: Users },
    { path: '/movements', label: 'حركة الأطقم', icon: Truck },
    { path: '/reports', label: 'بلاغات الضبط', icon: FileText },
    { path: '/statistics', label: 'الإحصائيات', icon: BarChart3 },
    { path: '/settings', label: 'الإعدادات', icon: SettingsIcon },
  ];

  const handleLogout = () => {
    setCurrentUser(null);
    navigate('/login');
  };

  const currentLabel = navItems.find(item => item.path === location.pathname)?.label || 'الرئيسية';

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden text-[#1E293B]" dir="rtl">
      {/* Mobile Backdrop for Sidebar Drawer */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-45 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="bg-primary text-white flex flex-col z-50 fixed lg:relative inset-y-0 right-0 shadow-2xl overflow-hidden max-w-[85vw]"
          >
            <div className="p-5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="bg-accent p-2 rounded-xl shadow-lg">
                  <ShieldCheck className="h-6 w-6 text-accent-foreground" />
                </div>
                <div className="font-bold leading-tight">
                  <p className="text-base tracking-wide">نظام المنافذ</p>
                  <p className="text-[10px] uppercase opacity-70 tracking-widest">والجوازات الذكي</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/10"
                onClick={() => setIsSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <nav className="flex-1 p-4 space-y-1 mt-2 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || (item.path === '/' && location.pathname.startsWith('/travelers'));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group ${
                      isActive 
                        ? 'bg-accent text-accent-foreground shadow-lg font-bold translate-x-1' 
                        : 'hover:bg-white/5 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="h-4 w-4" />}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 mt-auto">
              <div className="bg-white/5 rounded-2xl p-4 mb-3 border border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-accent/20 h-10 w-10 rounded-full flex items-center justify-center shrink-0">
                    <UserIcon className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold truncate">{user?.name || 'مستخدم النظام'}</p>
                    <p className="text-[10px] opacity-60 uppercase">{user?.role || 'ضابط المنافذ'}</p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-destructive/10 text-destructive-foreground hover:bg-destructive/20 transition-colors text-xs font-bold"
                >
                  <LogOut className="h-4 w-4" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
              <div className="text-center">
                <p className="text-[10px] opacity-40 font-mono">v1.2.0 · MOBILE & OFFLINE READY</p>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top Navbar */}
        <header className="h-16 lg:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 lg:px-8 z-30 sticky top-0 shadow-xs shrink-0">
          <div className="flex items-center gap-3 sm:gap-6">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hover:bg-slate-100"
              title="القائمة"
            >
              <Menu className="h-5 w-5 text-slate-700" />
            </Button>
            
            <div className="flex flex-col">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 mb-0.5">
                <Home className="h-3 w-3" />
                <span>الرئيسية</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-primary font-medium">{currentLabel}</span>
              </div>
              <h2 className="text-base sm:text-xl font-bold text-slate-800 leading-tight">{currentLabel}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <form onSubmit={handleGlobalSearch} className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-full text-slate-500 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <SearchIcon className="h-4 w-4" />
              <input 
                type="text" 
                placeholder="بحث عن مسافر، وثيقة، بلاغ..." 
                className="bg-transparent border-none outline-none text-xs w-44 lg:w-64 text-right font-medium" 
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
            </form>

            <div className="hidden lg:flex items-center gap-4 border-l pl-4 ml-2">
              <div className="flex flex-col items-end">
                <p className="text-sm font-bold text-slate-700 font-mono">
                  {currentTime.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                  <Calendar className="h-3 w-3" />
                  <span>{currentTime.toLocaleDateString('ar-YE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="ghost" size="icon" className="relative text-slate-500 hover:bg-slate-100 rounded-full h-9 w-9">
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-white"></span>
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="p-1 pr-2 sm:pr-3 hover:bg-slate-100 rounded-full flex items-center gap-2">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{user?.name || 'الضابط'}</p>
                      <p className="text-[10px] text-slate-400 uppercase">{user?.role || 'أمن المنافذ'}</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center overflow-hidden">
                      <UserIcon className="h-4.5 w-4.5" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56" dir="rtl">
                  <DropdownMenuLabel>حسابي</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <SettingsIcon className="ml-2 h-4 w-4" />
                    <span>الإعدادات</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Globe className="ml-2 h-4 w-4" />
                    <span>اللغة: العربية (اليمن)</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                    <LogOut className="ml-2 h-4 w-4" />
                    <span>تسجيل الخروج</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main Content Scroll Area - 4-Direction Scroll Enabled */}
        <main className="flex-1 overflow-x-auto overflow-y-auto bg-[#F8FAFC] pb-24 md:pb-8 w-full min-w-0">
          <div className="p-3 sm:p-6 lg:p-8 max-w-[1600px] w-full min-w-0 mx-auto">
            {children}
          </div>
        </main>

        {/* Mobile Smartphone Bottom Navigation Bar */}
        <nav className="mobile-bottom-bar fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex justify-around items-center shadow-[0_-4px_20px_rgba(0,0,0,0.06)] md:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path === '/' && location.pathname.startsWith('/travelers'));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] ${
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-slate-500 hover:text-slate-900 font-medium'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-primary/10 scale-105' : ''}`}>
                  <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-slate-500'}`} />
                </div>
                <span className="text-[10px] mt-0.5 leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Travelers /></PrivateRoute>} />
        <Route path="/travelers/:id" element={<PrivateRoute><Travelers /></PrivateRoute>} />
        <Route path="/movements" element={<PrivateRoute><Movements /></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
        <Route path="/statistics" element={<PrivateRoute><Statistics /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-center" />
    </Router>
  );
}
