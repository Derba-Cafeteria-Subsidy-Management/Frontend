import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  Fingerprint,
  Clock,
  ArrowRight,
  List,
  X,
  FileText,
  Phone,
  User,
  ForkKnife,
  FilePdf,
  CheckCircle,
  WarningCircle,
  WifiHigh,
  ShieldCheck,
  Check,
  Sliders,
  Database
} from '@phosphor-icons/react';
import logo from '../assets/logo.png';
import toast from 'react-hot-toast';

export const LandingPage: React.FC = () => {
  const { currentUser } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Statistics counters
  const [employeesCount, setEmployeesCount] = useState(0);
  const [speedVal, setSpeedVal] = useState(0.0);
  const [duplicateBlockCount, setDuplicateBlockCount] = useState(0);

  // Mockup Simulation States
  const [simStatus, setSimStatus] = useState<'idle' | 'scanning' | 'verified' | 'success'>('idle');
  const [simEmployee, setSimEmployee] = useState<any>(null);
  const [simLog, setSimLog] = useState<Array<{ time: string; name: string; meal: string; status: string }>>([
    { time: '12:14:02', name: 'Abebe Kebede', meal: 'Lunch Beyaynetu', status: 'Approved' },
    { time: '12:15:10', name: 'Tigist Assefa', meal: 'Lunch Beyaynetu', status: 'Approved' },
    { time: '12:15:45', name: 'Chala Bekele', meal: 'Lunch Beyaynetu', status: 'Approved' },
  ]);
  const [selectedPreviewReport, setSelectedPreviewReport] = useState<'payroll' | 'subsidy' | 'invoice'>('payroll');

  // Sticky header on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Stats animation trigger when visible
  useEffect(() => {
    const targetEmployees = 1200;
    const targetSpeed = 2.4;
    const targetDuplicates = 4850;

    let empInterval = setInterval(() => {
      setEmployeesCount(prev => {
        if (prev >= targetEmployees) {
          clearInterval(empInterval);
          return targetEmployees;
        }
        return prev + 40;
      });
    }, 30);

    let speedInterval = setInterval(() => {
      setSpeedVal(prev => {
        if (prev >= targetSpeed) {
          clearInterval(speedInterval);
          return targetSpeed;
        }
        return parseFloat((prev + 0.1).toFixed(1));
      });
    }, 40);

    let dupInterval = setInterval(() => {
      setDuplicateBlockCount(prev => {
        if (prev >= targetDuplicates) {
          clearInterval(dupInterval);
          return targetDuplicates;
        }
        return prev + 150;
      });
    }, 30);

    return () => {
      clearInterval(empInterval);
      clearInterval(speedInterval);
      clearInterval(dupInterval);
    };
  }, []);

  // Biometric scanner simulation loop
  const triggerScannerSimulation = () => {
    if (simStatus !== 'idle') return;
    setSimStatus('scanning');

    setTimeout(() => {
      setSimStatus('verified');
      setSimEmployee({
        name: 'Mahlet Wolde',
        id: 'EMP-0482',
        dept: 'Engineering',
        status: 'Eligible',
        photo: 'MW'
      });

      setTimeout(() => {
        setSimStatus('success');
        setSimLog(prev => [
          {
            time: new Date().toLocaleTimeString('en-US', { hour12: false }),
            name: 'Mahlet Wolde',
            meal: 'Lunch Beyaynetu',
            status: 'Approved'
          },
          ...prev.slice(0, 4)
        ]);

        toast.success('Meal registered successfully! Duplicate check passed.');

        setTimeout(() => {
          setSimStatus('idle');
          setSimEmployee(null);
        }, 3000);
      }, 1500);
    }, 1800);
  };

  const handleDownloadReport = (reportName: string) => {
    toast.success(`Preparing draft of ${reportName}...`);
    setTimeout(() => {
      toast.success(`${reportName} downloaded successfully! (Sample PDF/Excel)`);
    }, 1500);
  };

  const getDashboardRedirectUrl = () => {
    if (!currentUser) return '/login';
    const role = currentUser.role as any;
    if (role === 'Admin' || role === 'ADMIN') return '/admin';
    if (role === 'Super Admin' || role === 'SUPER_ADMIN') return '/super-admin';
    return '/cashier';
  };

  const handleNavClick = (sectionId: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#2D3748] font-sans antialiased selection:bg-[#1A5C3A]/20 selection:text-[#1A5C3A]">

      {/* Sticky Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-md py-3' : 'bg-transparent py-5'
        }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src={logo} alt="Derba MIDROC Logo" className="h-10 w-10 object-contain" />
            <div>
              <span className="font-bold text-lg text-[#1A5C3A] tracking-tight block leading-tight">CSMS</span>
              <span className="text-[10px] text-gray-500 font-medium block -mt-0.5 tracking-wider uppercase">Derba MIDROC Cement</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            <button onClick={() => handleNavClick('features')} className="text-sm font-medium text-gray-600 hover:text-[#1A5C3A] transition-colors cursor-pointer">Features</button>
            <button onClick={() => handleNavClick('how-it-works')} className="text-sm font-medium text-gray-600 hover:text-[#1A5C3A] transition-colors cursor-pointer">How It Works</button>
            <button onClick={() => handleNavClick('reports')} className="text-sm font-medium text-gray-600 hover:text-[#1A5C3A] transition-colors cursor-pointer">Reports</button>
            <button onClick={() => handleNavClick('roles')} className="text-sm font-medium text-gray-600 hover:text-[#1A5C3A] transition-colors cursor-pointer">User Roles</button>
          </nav>

          <div className="hidden lg:flex items-center gap-4">
            {currentUser ? (
              <Link
                to={getDashboardRedirectUrl()}
                className="bg-[#1A5C3A] hover:bg-[#15462c] text-white px-5 py-2 rounded-[8px] text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 shadow-[0_4px_12px_rgba(26,92,58,0.15)] hover:shadow-[0_4px_18px_rgba(26,92,58,0.25)] hover:-translate-y-0.5"
              >
                Go to Dashboard
                <ArrowRight size={16} weight="bold" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-[#1A5C3A] hover:text-[#15462c] text-sm font-semibold transition-colors">
                  Sign In
                </Link>
              </>
            )}
          </div>

          {/* Hamburger Icon */}
          <button className="lg:hidden text-gray-700 hover:text-[#1A5C3A] transition-colors" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={28} /> : <List size={28} />}
          </button>
        </div>

        {/* Mobile Menu Panel */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-xl py-6 px-6 flex flex-col gap-4 animate-fade-in">
            <button onClick={() => handleNavClick('features')} className="text-left py-2 font-medium text-gray-700 hover:text-[#1A5C3A] transition-colors">Features</button>
            <button onClick={() => handleNavClick('how-it-works')} className="text-left py-2 font-medium text-gray-700 hover:text-[#1A5C3A] transition-colors">How It Works</button>
            <button onClick={() => handleNavClick('reports')} className="text-left py-2 font-medium text-gray-700 hover:text-[#1A5C3A] transition-colors">Reports</button>
            <button onClick={() => handleNavClick('roles')} className="text-left py-2 font-medium text-gray-700 hover:text-[#1A5C3A] transition-colors">User Roles</button>
            
            <div className="flex justify-between items-center py-1">
              <span className="text-sm font-medium text-gray-500">Language</span>
            </div>

            <hr className="border-gray-100 my-2" />
            {currentUser ? (
              <Link
                to={getDashboardRedirectUrl()}
                onClick={() => setMobileMenuOpen(false)}
                className="bg-[#1A5C3A] text-white text-center py-3 rounded-[8px] font-semibold transition-colors flex items-center justify-center gap-2"
              >
                Go to Dashboard
                <ArrowRight size={16} weight="bold" />
              </Link>
            ) : (
              <div className="flex flex-col gap-3">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="border border-[#1A5C3A] text-[#1A5C3A] text-center py-2.5 rounded-[8px] font-semibold hover:bg-gray-50 transition-colors"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden bg-gradient-to-br from-white via-[#F4FAF6] to-[#E8F3EC]">
        {/* Subtle Decorative Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 -z-10" />

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          {/* Left Text Column */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-[#E2F0E7] border border-[#C5E2CF] px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#1A5C3A]">
              <span className="w-2 h-2 rounded-full bg-[#F5A623] animate-pulse" />
              Designed for Derba MIDROC Cement
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-[1.1] font-sans">
              Streamline Cafeteria Subsidy Management with <span className="text-[#1A5C3A] bg-clip-text">Smart Verification</span>
            </h1>
            <p className="text-base md:text-lg text-gray-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Eliminate duplicate claims, automate payroll deductions, and verify vendor invoices in real-time with our secure, biometric-enabled enterprise system.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <button
                onClick={() => handleNavClick('features')}
                className="w-full sm:w-auto border-2 border-gray-300 hover:border-[#1A5C3A] hover:text-[#1A5C3A] text-gray-700 px-8 py-3.5 rounded-[8px] font-semibold transition-all duration-200 flex items-center justify-center cursor-pointer"
              >
                View Features
              </button>
            </div>

            {/* Micro Highlights Badges */}
            <div className="pt-6 grid grid-cols-2 gap-4 max-w-sm mx-auto lg:mx-0">
              <div className="flex items-center gap-2">
                <CheckCircle className="text-[#1A5C3A] flex-shrink-0" size={18} weight="fill" />
                <span className="text-xs text-gray-600 font-medium">99.9% Uptime Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="text-[#1A5C3A] flex-shrink-0" size={18} weight="fill" />
                <span className="text-xs text-gray-600 font-medium">Role-Based Auditing</span>
              </div>
            </div>
          </div>

          {/* Right Visual Column (Interactive Mockup) */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden transition-all duration-300 hover:shadow-[0_20px_60px_rgba(0,0,0,0.1)]">
              {/* Mockup Header Bar */}
              <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-[11px] text-gray-400 font-medium font-mono ml-2">TERMINAL-MOCKUP // ONLINE</span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#E2F0E7] text-[#1A5C3A] text-[10px] font-bold px-2 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  SYSTEM ACTIVE
                </div>
              </div>

              {/* Mockup Body Content */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 bg-white min-h-[380px]">

                {/* Left Mini Panel: Biometric Verification */}
                <div className="md:col-span-5 border border-gray-200/80 rounded-lg p-4 bg-[#F8F9FA] flex flex-col justify-between items-center text-center">
                  <div className="w-full">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-3">BIOMETRIC SCANNER</span>

                    {/* Scanner Circular Indicator */}
                    <div className="relative w-28 h-28 mx-auto bg-white rounded-full border border-gray-100 flex items-center justify-center overflow-hidden shadow-inner group cursor-pointer" onClick={triggerScannerSimulation}>
                      {/* Scanning Line */}
                      {simStatus === 'scanning' && (
                        <div className="absolute left-0 right-0 h-0.5 bg-cyan-500 shadow-[0_0_8px_cyan] animate-scan-moving-line" />
                      )}

                      {/* Success Scan Glow */}
                      {simStatus === 'success' && (
                        <div className="absolute inset-0 bg-[#E2F0E7]/60 animate-pulse" />
                      )}

                      <Fingerprint
                        size={60}
                        className={`transition-colors duration-300 ${simStatus === 'idle' ? 'text-gray-400' :
                          simStatus === 'scanning' ? 'text-cyan-500 animate-scanner-pulse' :
                            simStatus === 'verified' ? 'text-[#F5A623]' :
                              'text-[#1A5C3A]'
                          }`}
                      />
                    </div>
                  </div>

                  {/* Status Box */}
                  <div className="mt-4 w-full">
                    {simStatus === 'idle' && (
                      <button
                        onClick={triggerScannerSimulation}
                        className="bg-[#1A5C3A] hover:bg-[#15462c] text-white text-xs font-semibold px-4 py-2 rounded shadow-sm w-full transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Fingerprint size={14} />
                        Simulate Scan
                      </button>
                    )}
                    {simStatus === 'scanning' && (
                      <div className="text-xs text-cyan-600 font-semibold animate-pulse py-2">
                        Scanning Fingerprint...
                      </div>
                    )}
                    {simStatus === 'verified' && (
                      <div className="text-xs text-[#F5A623] font-semibold py-2">
                        Verifying Eligibility...
                      </div>
                    )}
                    {simStatus === 'success' && (
                      <div className="bg-[#E2F0E7] text-[#1A5C3A] rounded py-1.5 px-2 text-xs font-bold flex items-center justify-center gap-1">
                        <Check size={14} weight="bold" />
                        ACCESS GRANTED
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Mini Panel: Live Status & Transaction Log */}
                <div className="md:col-span-7 flex flex-col justify-between space-y-4">

                  {/* Verified Employee Screen Mockup */}
                  <div className="border border-gray-100 rounded-lg p-3.5 bg-[#FAFBFD] min-h-[140px] flex flex-col justify-center">
                    {simEmployee ? (
                      <div className="flex items-center gap-3 animate-fade-in">
                        <div className="w-12 h-12 bg-[#E2F0E7] border border-[#C5E2CF] rounded-full flex items-center justify-center font-bold text-[#1A5C3A] text-sm">
                          {simEmployee.photo}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-gray-800 truncate">{simEmployee.name}</h4>
                          <p className="text-[10px] text-gray-500">ID: {simEmployee.id} | Dept: {simEmployee.dept}</p>
                          <div className="mt-2 flex gap-1.5">
                            <span className="bg-[#E2F0E7] text-[#1A5C3A] text-[9px] px-1.5 py-0.5 rounded font-bold">
                              {simEmployee.status}
                            </span>
                            <span className="bg-[#EBF3FC] text-[#2B6CB0] text-[9px] px-1.5 py-0.5 rounded font-bold">
                              Lunch Session
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 py-6">
                        <User size={32} className="mx-auto opacity-30 mb-1" />
                        <span className="text-[11px] font-medium block">Scan employee fingerprint to verify benefits eligibility</span>
                      </div>
                    )}
                  </div>

                  {/* Live Transaction Log Mockup */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Live Terminal Logs</span>
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    </div>
                    <div className="border border-gray-100 rounded-lg overflow-hidden bg-white">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                            <th className="py-2 px-3">Time</th>
                            <th className="py-2 px-3">Employee</th>
                            <th className="py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {simLog.map((log, idx) => (
                            <tr key={idx} className={idx === 0 && simStatus === 'success' ? 'bg-[#E2F0E7]/40 font-medium' : ''}>
                              <td className="py-2 px-3 text-gray-400 font-mono">{log.time}</td>
                              <td className="py-2 px-3 text-gray-700 truncate max-w-[100px]">{log.name}</td>
                              <td className="py-2 px-3">
                                <span className="text-[#1A5C3A] bg-[#E2F0E7] px-1.5 py-0.5 rounded-[4px] font-bold text-[9px]">
                                  {log.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Callout Info Box */}
      <section className="bg-white border-y border-gray-200/60 py-8 select-none">
        <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row items-center gap-4 text-center md:text-left justify-center">
          <div className="bg-[#E2F0E7] text-[#1A5C3A] p-2.5 rounded-full flex-shrink-0">
            <ShieldCheck size={24} weight="fill" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              Designed for Derba MIDROC Cement
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Managing employee cafeteria subsidies efficiently with biometric verification, double-registration preventions, and automated billing.
            </p>
          </div>
        </div>
      </section>

      {/* Key Features Grid Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-[11px] font-bold tracking-widest text-[#1A5C3A] uppercase">Enterprise Capabilities</h2>
            <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
              Powerful Features for Seamless Subsidy Control
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Designed from the ground up to prevent leakages, improve security, and simplify reporting for modern enterprise cafeterias.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

            {/* Feature 1 */}
            <div className="bg-white p-8 rounded-xl border border-gray-200/80 shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-[#E2F0E7] text-[#1A5C3A] flex items-center justify-center mb-6">
                  <Fingerprint size={28} />
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Fingerprint Verification</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Secure biometric authentication at the point of service ensures transaction authenticity and completely eliminates proxy meal claims.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center text-xs font-semibold text-[#1A5C3A] hover:text-[#15462c]">
                Prevents identity fraud
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-8 rounded-xl border border-gray-200/80 shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-[#FFF2DE] text-[#F5A623] flex items-center justify-center mb-6">
                  <WarningCircle size={28} />
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Smart Duplicate Prevention</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Advanced validation engine automatically blocks multiple meal registrations for the same session, enforcing single-benefit policy rules.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center text-xs font-semibold text-[#F5A623]">
                Protects company subsidy budget
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-8 rounded-xl border border-gray-200/80 shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-[#EBF3FC] text-[#2B6CB0] flex items-center justify-center mb-6">
                  <Clock size={28} />
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Real-Time Transaction Logging</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Every meal is permanently logged in a cloud-synced database with a comprehensive audit trail, providing complete transaction visibility.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center text-xs font-semibold text-[#2B6CB0]">
                Immediate auditable history
              </div>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-8 rounded-xl border border-gray-200/80 shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-[#E2F0E7] text-[#1A5C3A] flex items-center justify-center mb-6">
                  <ForkKnife size={28} />
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Menu & Price Management</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Flexible administration allows dynamic menu definition, custom subsidy allocations, and historical price tracking for all items.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center text-xs font-semibold text-[#1A5C3A]">
                Adaptable menu sessions
              </div>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-8 rounded-xl border border-gray-200/80 shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-[#FFF2DE] text-[#F5A623] flex items-center justify-center mb-6">
                  <CheckCircle size={28} />
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Correction Workflow</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Secure correction adjudication process allows cashiers to flag transactions, subject to strict Administrator verification and approval.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center text-xs font-semibold text-[#F5A623]">
                Reduces discrepancies securely
              </div>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-8 rounded-xl border border-gray-200/80 shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-[#EBF3FC] text-[#2B6CB0] flex items-center justify-center mb-6">
                  <WifiHigh size={28} />
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Offline Operations Mode</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Local database backup enables the system to register transactions even during network failures, automatically syncing logs when online.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center text-xs font-semibold text-[#2B6CB0]">
                Zero interruption in service
              </div>
            </div>

          </div>

          <div className="text-center mt-12">
            <button onClick={() => handleNavClick('contact')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1A5C3A] hover:text-[#15462c] hover:underline cursor-pointer">
              Explore All Features in a Demo
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-white border-y border-gray-200/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-[11px] font-bold tracking-widest text-[#1A5C3A] uppercase font-sans">Operational Flow</h2>
            <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
              Simplified Transactions in 4 Steps
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Designed to take less than 3 seconds per employee scan to ensure fast moving lines during high-traffic lunch hours.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {/* Connecting lines for large desktops */}
            <div className="hidden lg:block absolute top-16 left-28 right-28 h-0.5 bg-gray-100 -z-10" />

            {/* Step 1 */}
            <div className="flex flex-col items-center text-center group">
              <div className="w-14 h-14 rounded-full bg-[#E2F0E7] text-[#1A5C3A] border border-[#C5E2CF] flex items-center justify-center font-bold text-lg mb-6 group-hover:scale-105 transition-transform duration-300">
                1
              </div>
              <h4 className="text-base font-bold text-gray-900 mb-2">Verify Employee</h4>
              <p className="text-xs text-gray-500 max-w-[200px] leading-relaxed">
                Employee places their finger on the terminal scanner at the start of the queue.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center group">
              <div className="w-14 h-14 rounded-full bg-[#E2F0E7] text-[#1A5C3A] border border-[#C5E2CF] flex items-center justify-center font-bold text-lg mb-6 group-hover:scale-105 transition-transform duration-300">
                2
              </div>
              <h4 className="text-base font-bold text-gray-900 mb-2">Select Session Menu</h4>
              <p className="text-xs text-gray-500 max-w-[200px] leading-relaxed">
                The Cashier selects the active meal session and matches the custom menu item.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center group">
              <div className="w-14 h-14 rounded-full bg-[#E2F0E7] text-[#1A5C3A] border border-[#C5E2CF] flex items-center justify-center font-bold text-lg mb-6 group-hover:scale-105 transition-transform duration-300">
                3
              </div>
              <h4 className="text-base font-bold text-gray-900 mb-2">Validate Duplication</h4>
              <p className="text-xs text-gray-500 max-w-[200px] leading-relaxed">
                The system checks eligibility rules and duplication records instantly.
              </p>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center text-center group">
              <div className="w-14 h-14 rounded-full bg-[#E2F0E7] text-[#1A5C3A] border border-[#C5E2CF] flex items-center justify-center font-bold text-lg mb-6 group-hover:scale-105 transition-transform duration-300">
                4
              </div>
              <h4 className="text-base font-bold text-gray-900 mb-2">Automatic Reports</h4>
              <p className="text-xs text-gray-500 max-w-[200px] leading-relaxed">
                Subsidies are recorded and sent directly to HR for automated payroll deduction exports.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Reports Section */}
      <section id="reports" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">

          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-[11px] font-bold tracking-widest text-[#1A5C3A] uppercase">Information Control</h2>
            <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
              Actionable Insights & Billing Exports
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Export precise calculation reports for vendor matching and salary deductions.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">

            {/* Reports Showcase Nav Cards */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <button
                onClick={() => setSelectedPreviewReport('payroll')}
                className={`text-left p-5 rounded-lg border transition-all duration-200 flex items-start gap-4 cursor-pointer ${selectedPreviewReport === 'payroll'
                  ? 'bg-white border-[#1A5C3A] shadow-md'
                  : 'bg-transparent border-gray-200/80 hover:bg-gray-100/50'
                  }`}
              >
                <div className={`p-2.5 rounded-lg ${selectedPreviewReport === 'payroll' ? 'bg-[#E2F0E7] text-[#1A5C3A]' : 'bg-gray-200/60 text-gray-500'}`}>
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Payroll Deduction Report</h4>
                  <p className="text-xs text-gray-500 mt-1">Export employee meal cost deductions directly to HR (.xlsx format).</p>
                </div>
              </button>

              <button
                onClick={() => setSelectedPreviewReport('subsidy')}
                className={`text-left p-5 rounded-lg border transition-all duration-200 flex items-start gap-4 cursor-pointer ${selectedPreviewReport === 'subsidy'
                  ? 'bg-white border-[#1A5C3A] shadow-md'
                  : 'bg-transparent border-gray-200/80 hover:bg-gray-100/50'
                  }`}
              >
                <div className={`p-2.5 rounded-lg ${selectedPreviewReport === 'subsidy' ? 'bg-[#E2F0E7] text-[#1A5C3A]' : 'bg-gray-200/60 text-gray-500'}`}>
                  <FilePdf size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Company Payment Report</h4>
                  <p className="text-xs text-gray-500 mt-1">Track total company subsidies and departmental costs over any date range.</p>
                </div>
              </button>

              <button
                onClick={() => setSelectedPreviewReport('invoice')}
                className={`text-left p-5 rounded-lg border transition-all duration-200 flex items-start gap-4 cursor-pointer ${selectedPreviewReport === 'invoice'
                  ? 'bg-white border-[#1A5C3A] shadow-md'
                  : 'bg-transparent border-gray-200/80 hover:bg-gray-100/50'
                  }`}
              >
                <div className={`p-2.5 rounded-lg ${selectedPreviewReport === 'invoice' ? 'bg-[#E2F0E7] text-[#1A5C3A]' : 'bg-gray-200/60 text-gray-500'}`}>
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Invoice Verification Report</h4>
                  <p className="text-xs text-gray-500 mt-1">Cross-check external caterer invoices against biometric system logs.</p>
                </div>
              </button>
            </div>

            {/* Report Preview Panel */}
            <div className="lg:col-span-8 bg-white border border-gray-200/80 rounded-xl p-6 shadow-sm flex flex-col justify-between min-h-[350px]">

              {/* Dynamic Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <h4 className="text-base font-bold text-gray-900">
                    {selectedPreviewReport === 'payroll' && 'Payroll Deduction Log (Preview)'}
                    {selectedPreviewReport === 'subsidy' && 'Departmental Subsidy Cost Summary'}
                    {selectedPreviewReport === 'invoice' && 'Invoice Discrepancy Reconciliation'}
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">Showing mock export data for verification</p>
                </div>
                <button
                  onClick={() => handleDownloadReport(
                    selectedPreviewReport === 'payroll' ? 'Payroll Deduction Report' :
                      selectedPreviewReport === 'subsidy' ? 'Company Payment Report' : 'Invoice Verification Report'
                  )}
                  className="bg-[#1A5C3A] hover:bg-[#15462c] text-white text-xs font-semibold px-4 py-2 rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText size={14} />
                  Download Sample
                </button>
              </div>

              {/* Dynamic Table Preview */}
              <div className="my-6 overflow-x-auto">
                {selectedPreviewReport === 'payroll' && (
                  <table className="w-full text-left text-xs text-gray-600">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                        <th className="py-2.5 px-3">Employee Name</th>
                        <th className="py-2.5 px-3">ID</th>
                        <th className="py-2.5 px-3 text-center">Meals Count</th>
                        <th className="py-2.5 px-3 text-right">Deduction (ETB)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      <tr>
                        <td className="py-2.5 px-3 font-semibold">Tilahun Gessese</td>
                        <td className="py-2.5 px-3 font-mono text-gray-400">EMP-012</td>
                        <td className="py-2.5 px-3 text-center">26</td>
                        <td className="py-2.5 px-3 text-right font-mono">1,040.00</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold">Mulu Alkene</td>
                        <td className="py-2.5 px-3 font-mono text-gray-400">EMP-304</td>
                        <td className="py-2.5 px-3 text-center">22</td>
                        <td className="py-2.5 px-3 text-right font-mono">880.00</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold">Zenebech Bekele</td>
                        <td className="py-2.5 px-3 font-mono text-gray-400">EMP-401</td>
                        <td className="py-2.5 px-3 text-center">30</td>
                        <td className="py-2.5 px-3 text-right font-mono">1,200.00</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {selectedPreviewReport === 'subsidy' && (
                  <table className="w-full text-left text-xs text-gray-600">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                        <th className="py-2.5 px-3">Department</th>
                        <th className="py-2.5 px-3 text-center">Active Staff</th>
                        <th className="py-2.5 px-3 text-right">Total Subsidy (ETB)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      <tr>
                        <td className="py-2.5 px-3 font-semibold">Production & Milling</td>
                        <td className="py-2.5 px-3 text-center">480</td>
                        <td className="py-2.5 px-3 text-right font-mono">124,800.00</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold">Logistics & Drivers</td>
                        <td className="py-2.5 px-3 text-center">320</td>
                        <td className="py-2.5 px-3 text-right font-mono">96,400.00</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold">Administration & Support</td>
                        <td className="py-2.5 px-3 text-center">150</td>
                        <td className="py-2.5 px-3 text-right font-mono">45,000.00</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {selectedPreviewReport === 'invoice' && (
                  <table className="w-full text-left text-xs text-gray-600">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                        <th className="py-2.5 px-3">Calculation Area</th>
                        <th className="py-2.5 px-3 text-right">Caterer Invoice</th>
                        <th className="py-2.5 px-3 text-right">System Calculation</th>
                        <th className="py-2.5 px-3 text-center">Discrepancy Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      <tr>
                        <td className="py-2.5 px-3 font-semibold">June Breakfast Session</td>
                        <td className="py-2.5 px-3 text-right font-mono">42,500.00</td>
                        <td className="py-2.5 px-3 text-right font-mono">42,500.00</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="bg-[#E2F0E7] text-[#1A5C3A] text-[9px] px-1.5 py-0.5 rounded font-bold">MATCHED</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold">June Lunch Session</td>
                        <td className="py-2.5 px-3 text-right font-mono">148,600.00</td>
                        <td className="py-2.5 px-3 text-right font-mono">148,600.00</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="bg-[#E2F0E7] text-[#1A5C3A] text-[9px] px-1.5 py-0.5 rounded font-bold">MATCHED</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold">June Dinner Session</td>
                        <td className="py-2.5 px-3 text-right font-mono">68,200.00</td>
                        <td className="py-2.5 px-3 text-right font-mono">67,800.00</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="bg-red-50 text-red-600 text-[9px] px-1.5 py-0.5 rounded font-bold">ADJUSTED (+400 ETB)</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer Tip */}
              <div className="bg-[#FAFBFD] border border-gray-100 rounded-lg p-3 flex items-center gap-2">
                <WarningCircle size={16} className="text-[#F5A623]" />
                <span className="text-[10px] text-gray-500">
                  Data generated complies with standard audit trail formatting protocols. Exports are ready for Excel / SAP importing tools.
                </span>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* Trust & Stats Section */}
      <section className="bg-gradient-to-r from-[#1A5C3A] to-[#15462c] py-16 text-white select-none">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">

          <div className="space-y-2">
            <h4 className="text-4xl font-extrabold font-mono tracking-tight text-[#DDEF94]">
              {employeesCount}+
            </h4>
            <p className="text-sm font-medium text-green-100 uppercase tracking-wider">
              Employees Managed per Session
            </p>
            <p className="text-xs text-green-200/70">
              Supporting rapid multi-session registration daily
            </p>
          </div>

          <div className="space-y-2 border-y md:border-y-0 md:border-x border-green-800/60 py-8 md:py-0">
            <h4 className="text-4xl font-extrabold font-mono tracking-tight text-[#DDEF94]">
              &lt; {speedVal}s
            </h4>
            <p className="text-sm font-medium text-green-100 uppercase tracking-wider">
              Verification Processing Speed
            </p>
            <p className="text-xs text-green-200/70">
              Average biometric scan and validation validation time
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-4xl font-extrabold font-mono tracking-tight text-[#DDEF94]">
              {duplicateBlockCount}+
            </h4>
            <p className="text-sm font-medium text-green-100 uppercase tracking-wider">
              Duplicate Meal Claims Prevented
            </p>
            <p className="text-xs text-green-200/70">
              Automatically caught and blocked at cashier stations
            </p>
          </div>

        </div>
      </section>

      {/* User Roles Section */}
      <section id="roles" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">

          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-[11px] font-bold tracking-widest text-[#1A5C3A] uppercase font-sans">Role Matrix</h2>
            <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
              Designed for Cooperative Access Controls
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Enforce transparency with customized modules tailored for distinct cafeteria stakeholders.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            {/* Cashier */}
            <div className="border border-gray-200 rounded-xl p-8 bg-gray-50 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-full bg-[#E2F0E7] text-[#1A5C3A] flex items-center justify-center font-bold text-sm mb-6">
                  CS
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Cashier Terminal Role</h4>
                <p className="text-xs text-gray-500 leading-relaxed mb-6">
                  Optimized for fast-paced meal service environments. Minimal clicks required to register transactions.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-xs text-gray-600">
                    <Check size={12} className="text-[#1A5C3A]" weight="bold" />
                    Secure biometric scanners link
                  </li>
                  <li className="flex items-center gap-2 text-xs text-gray-600">
                    <Check size={12} className="text-[#1A5C3A]" weight="bold" />
                    Register meal & beverage selections
                  </li>
                  <li className="flex items-center gap-2 text-xs text-gray-600">
                    <Check size={12} className="text-[#1A5C3A]" weight="bold" />
                    Submit correction requests
                  </li>
                </ul>
              </div>
              <div className="mt-8 pt-4 border-t border-gray-200 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Authorized device log required
              </div>
            </div>

            {/* Administrator */}
            <div className="border border-gray-200 rounded-xl p-8 bg-gray-50 flex flex-col justify-between shadow-sm">
              <div>
                <div className="w-10 h-10 rounded-full bg-[#FFF2DE] text-[#F5A623] flex items-center justify-center font-bold text-sm mb-6">
                  AD
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Administrator Panel Role</h4>
                <p className="text-xs text-gray-500 leading-relaxed mb-6">
                  Provides daily operational oversight. Controls personnel registers, pricing history, and adjudicates adjustments.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-xs text-gray-600">
                    <Check size={12} className="text-[#1A5C3A]" weight="bold" />
                    Manage Employee profiles & bio keys
                  </li>
                  <li className="flex items-center gap-2 text-xs text-gray-600">
                    <Check size={12} className="text-[#1A5C3A]" weight="bold" />
                    Control prices & menu sessions
                  </li>
                  <li className="flex items-center gap-2 text-xs text-gray-600">
                    <Check size={12} className="text-[#1A5C3A]" weight="bold" />
                    Approve or Reject Cashier corrections
                  </li>
                </ul>
              </div>
              <div className="mt-8 pt-4 border-t border-gray-200 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Full session logging enforced
              </div>
            </div>

            {/* Super Admin */}
            <div className="border border-gray-200 rounded-xl p-8 bg-gray-50 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-full bg-[#EBF3FC] text-[#2B6CB0] flex items-center justify-center font-bold text-sm mb-6">
                  SA
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Super-Admin Console Role</h4>
                <p className="text-xs text-gray-500 leading-relaxed mb-6">
                  Total system configuration controls. Manages global settings, user accounts, security roles, and full logs.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-xs text-gray-600">
                    <Check size={12} className="text-[#1A5C3A]" weight="bold" />
                    Configure global subsidy ratios
                  </li>
                  <li className="flex items-center gap-2 text-xs text-gray-600">
                    <Check size={12} className="text-[#1A5C3A]" weight="bold" />
                    Audit full system activity logs
                  </li>
                  <li className="flex items-center gap-2 text-xs text-gray-600">
                    <Check size={12} className="text-[#1A5C3A]" weight="bold" />
                    Create/revoke Administrator accounts
                  </li>
                </ul>
              </div>
              <div className="mt-8 pt-4 border-t border-gray-200 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Multi-Factor authentication enabled
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Integration & Compliance Badges Banner */}
      <section className="bg-gray-100 border-y border-gray-200/50 py-12 select-none">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-center items-center gap-8 md:gap-16">

          <div className="flex items-center gap-2.5 text-gray-400 hover:text-gray-600 transition-colors">
            <Sliders size={24} />
            <span className="font-bold text-xs uppercase tracking-widest">HR System Ready</span>
          </div>

          <div className="flex items-center gap-2.5 text-gray-400 hover:text-gray-600 transition-colors">
            <FileText size={24} />
            <span className="font-bold text-xs uppercase tracking-widest">Payroll Export Compatible</span>
          </div>

          <div className="flex items-center gap-2.5 text-gray-400 hover:text-gray-600 transition-colors">
            <Database size={24} />
            <span className="font-bold text-xs uppercase tracking-widest">Audit Trail Compliant</span>
          </div>

          <div className="flex items-center gap-2.5 text-gray-400 hover:text-gray-600 transition-colors">
            <ShieldCheck size={24} />
            <span className="font-bold text-xs uppercase tracking-widest">99.9% Uptime Guarantee</span>
          </div>

        </div>
      </section>


      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* Col 1 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Derba Logo" className="h-8 w-8 object-contain brightness-110" />
              <span className="font-bold text-white text-base">CSMS Terminal</span>
            </div>
            <p className="text-xs leading-relaxed text-gray-500">
              Biometric verification and cafeteria subsidy auditing solutions.
            </p>
            <p className="text-[11px] text-[#DDEF94] font-medium font-mono uppercase tracking-wider">
              Smart Verification, Transparent Subsidies
            </p>
          </div>

          {/* Col 2 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Product Features</h4>
            <ul className="space-y-2 text-xs">
              <li><button onClick={() => handleNavClick('features')} className="hover:text-white transition-colors cursor-pointer">Biometric Verification</button></li>
              <li><button onClick={() => handleNavClick('features')} className="hover:text-white transition-colors cursor-pointer">Duplicate Claims Blocker</button></li>
              <li><button onClick={() => handleNavClick('how-it-works')} className="hover:text-white transition-colors cursor-pointer">3-Second Scan Flow</button></li>
              <li><button onClick={() => handleNavClick('features')} className="hover:text-white transition-colors cursor-pointer">Offline Database Cache</button></li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Audit Exports</h4>
            <ul className="space-y-2 text-xs">
              <li><button onClick={() => handleNavClick('reports')} className="hover:text-white transition-colors cursor-pointer">Salary Deductions log</button></li>
              <li><button onClick={() => handleNavClick('reports')} className="hover:text-white transition-colors cursor-pointer">Company Subsidies cost</button></li>
              <li><button onClick={() => handleNavClick('reports')} className="hover:text-white transition-colors cursor-pointer">Reconciliation logs</button></li>
            </ul>
          </div>

          {/* Col 4 */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Enterprise Inquiries</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Seeking specific integrations for SAP or custom biometric terminals?
            </p>
            <button
              onClick={() => handleNavClick('contact')}
              className="bg-[#1A5C3A] hover:bg-[#15462c] text-white text-xs font-semibold px-4 py-2.5 rounded shadow-sm transition-colors cursor-pointer"
            >
              Contact Sales Division
            </button>
          </div>

        </div>

        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-600 gap-4">
          <p>© 2026 CSMS - Cafeteria Subsidy Management System. All Rights Reserved.</p>
          <div className="flex gap-6">
            <span className="hover:text-gray-400 cursor-pointer">Terms of Service</span>
            <span className="hover:text-gray-400 cursor-pointer">Security Protocol</span>
          </div>
        </div>
      </footer>

      {/* Mobile Floating Request Demo Button */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => handleNavClick('contact')}
          className="bg-[#1A5C3A] hover:bg-[#15462c] text-white p-4 rounded-full shadow-lg transition-transform duration-200 active:scale-95 flex items-center justify-center"
        >
          <Phone size={24} weight="bold" />
        </button>
      </div>

    </div>
  );
};