import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { db, type MenuItem } from '../../db/db';
import { 
  Fingerprint, 
  MagnifyingGlass, 
  WarningCircle, 
  CheckCircle,
  Coffee,
  Sun,
  Moon,
  ArrowLeft,
  Question,
  CheckSquare
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export const CashierFlow: React.FC = () => {
  const {
    cashierStep,
    selectedEmployee,
    selectedSession,
    selectedMenu,
    lastTransactionId,
    setEmployee,
    setSession,
    setMenu,
    goToStep,
    resetCashierFlow,
    submitTransaction
  } = useApp();

  const navigate = useNavigate();

  // Step 1: Identification states
  const [allowManualId, setAllowManualId] = useState(true);
  const [manualId, setManualId] = useState('');
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'matched' | 'nomatch'>('idle');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const savedSetting = localStorage.getItem('allow_manual_id');
    if (savedSetting !== null) {
      setAllowManualId(savedSetting === 'true');
    }
  }, [cashierStep]);

  // Step 2: Session States
  const [sessionStatus, setSessionStatus] = useState<Record<string, 'Available' | 'Consumed'>>({
    Breakfast: 'Available',
    Lunch: 'Available',
    Dinner: 'Available'
  });

  // Step 3: Menu States
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);

  // Step 4: Confirm Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 5: Auto-Reset Timer
  const [countdown, setCountdown] = useState(10);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch session consumption status for selected employee (Step 2)
  useEffect(() => {
    if (cashierStep === 2 && selectedEmployee) {
      const checkSessions = async () => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Fetch transactions for this employee today
        const todaysTransactions = await db.transactions
          .where('employeeId')
          .equals(selectedEmployee.id)
          .and(t => t.timestamp >= startOfDay && t.timestamp <= endOfDay)
          .toArray();

        const status = {
          Breakfast: 'Available' as const,
          Lunch: 'Available' as const,
          Dinner: 'Available' as const
        };

        todaysTransactions.forEach(t => {
          if (t.session in status) {
            (status as Record<string, 'Available' | 'Consumed'>)[t.session] = 'Consumed';
          }
        });

        setSessionStatus(status);
      };
      checkSessions();
    }
  }, [cashierStep, selectedEmployee]);

  // Fetch menu items for selected session (Step 3)
  useEffect(() => {
    if (cashierStep === 3 && selectedSession) {
      const fetchMenus = async () => {
        setIsLoadingMenu(true);
        const items = await db.menuItems
          .filter(item => item.isActive)
          .toArray();
        setMenuItems(items);
        setIsLoadingMenu(false);
      };
      fetchMenus();
    }
  }, [cashierStep, selectedSession]);

  // Step 5: 10s auto-reset countdown
  useEffect(() => {
    if (cashierStep === 5) {
      setCountdown(10);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            resetCashierFlow();
            return 10;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [cashierStep]);

  // ================= ACTIONS =================

  // Manual Employee ID Lookup
  const handleManualLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualId.trim()) return;

    setLookupError(null);
    setIsSearching(true);

    try {
      const emp = await db.employees.get(manualId.trim().toUpperCase());
      setIsSearching(false);

      if (!emp) {
        setLookupError('Employee not found. Check the ID and try again');
        toast.error('Employee not found');
      } else if (emp.status === 'Inactive') {
        setLookupError('Access Denied — Employee status is Inactive');
        toast.error('Access Denied: Employee is Inactive');
      } else {
        setEmployee(emp);
        setLookupError(null);
        toast.success(`Welcome, ${emp.name}!`);
        goToStep(2);
      }
    } catch (err) {
      console.error(err);
      setIsSearching(false);
      setLookupError('Error looking up employee ID.');
    }
  };

  // Simulated Fingerprint Scanner
  const triggerFingerprintScan = async () => {
    if (scanStatus === 'scanning') return;
    
    setScanStatus('scanning');
    setLookupError(null);

    // Scan delay
    setTimeout(async () => {
      try {
        // Fetch all active employees with fingerprints registered
        const candidates = await db.employees
          .where('fingerprintRegistered')
          .equals(1)
          .and(emp => emp.status === 'Active')
          .toArray();

        if (candidates.length === 0) {
          setScanStatus('nomatch');
          setLookupError('Fingerprint not recognized. Try again or use Employee ID');
          toast.error('No match found');
          return;
        }

        // Match a random active registered employee
        const matchedEmp = candidates[Math.floor(Math.random() * candidates.length)];
        setScanStatus('matched');
        setEmployee(matchedEmp);
        toast.success(`Fingerprint Matched: ${matchedEmp.name}`);
        
        setTimeout(() => {
          setScanStatus('idle');
          goToStep(2);
        }, 1000);

      } catch (e) {
        console.error(e);
        setScanStatus('nomatch');
        setLookupError('Scanner hardware error.');
      }
    }, 2000);
  };

  // Select Session (Step 2)
  const handleSelectSession = (session: 'Breakfast' | 'Lunch' | 'Dinner') => {
    if (sessionStatus[session] === 'Consumed') {
      toast.error(`${session} session has already been consumed today!`);
      return;
    }
    setSession(session);
    goToStep(3);
  };

  // Select Menu Item (Step 3)
  const handleSelectMenu = (item: MenuItem) => {
    setMenu(item);
  };

  // Confirm Submit (Step 4)
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    await submitTransaction();
    setIsSubmitting(false);
    setShowConfirmModal(false);
  };

  // Clean Reset Helper
  const handleNewRegistration = () => {
    resetCashierFlow();
  };

  // ================= RENDER SUBCOMPONENTS =================

  // Persistent Employee Info Banner
  const renderEmployeeBanner = () => {
    if (!selectedEmployee) return null;
    return (
      <div className="w-full bg-brand-white border border-[rgba(50,100,50,0.1)] border-l-4 border-l-brand-light-green rounded-[12px] p-4 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-6 select-none">
        <div className="flex items-center gap-4">
          <img 
            src={selectedEmployee.photo} 
            alt={selectedEmployee.name} 
            className="w-12 h-12 rounded-full object-cover border border-brand-light-green shrink-0"
          />
          <div>
            <h4 className="text-brand-dark-green font-semibold text-[16px] leading-tight">
              {selectedEmployee.name}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-brand-gray-neutral text-xs">{selectedEmployee.department}</span>
              <span className="text-brand-gray-neutral text-xs font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                {selectedEmployee.id}
              </span>
            </div>
          </div>
        </div>
        <div>
          <span className="bg-brand-dark-green text-brand-white text-xs px-3 py-1 rounded-full font-medium tracking-wide">
            Active
          </span>
        </div>
      </div>
    );
  };

  // ---------------- STEP 1: IDENTIFY EMPLOYEE ----------------
  if (cashierStep === 1) {
    return (
      <div className="w-full max-w-[520px] mx-auto mt-4">
        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 space-y-6">
          
          {/* Title */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-dark-green/5 text-brand-dark-green mb-1 select-none">
              <Fingerprint size={36} className="opacity-80" />
            </div>
            <h2 className="text-[20px] font-semibold text-brand-dark-green font-sans">
              Identify Employee
            </h2>
            <p className="text-brand-gray-neutral text-sm">
              Scan fingerprint or enter Employee ID
            </p>
          </div>

          {/* Inline Error Displays */}
          {lookupError && (
            <div className="bg-brand-error-red/5 border border-brand-error-red/20 text-brand-error-red p-3 rounded-[8px] text-xs flex items-start gap-2">
              <WarningCircle size={18} className="shrink-0 mt-0.5" />
              <span>{lookupError}</span>
            </div>
          )}

          {/* Method 1: Fingerprint Scan */}
          <div className="space-y-2">
            <span className="text-[13px] font-medium text-brand-dark-green uppercase tracking-wider block">
              Method 1: Biometric Scan
            </span>
            <div 
              onClick={triggerFingerprintScan}
              className={`border-2 border-dashed rounded-[8px] p-6 text-center cursor-pointer select-none transition-all duration-200 relative overflow-hidden group ${
                scanStatus === 'scanning' 
                  ? 'border-brand-gold bg-brand-gold/5' 
                  : scanStatus === 'matched'
                  ? 'border-brand-dark-green bg-brand-dark-green/5'
                  : 'border-gray-300 hover:border-brand-dark-green bg-brand-white'
              }`}
            >
              {/* Scan Moving Line Animation */}
              {scanStatus === 'scanning' && (
                <div className="absolute left-0 right-0 h-[2px] bg-brand-gold animate-scan-moving-line shadow-[0_0_8px_#A98C03]" />
              )}

              <div className="flex flex-col items-center gap-3">
                <Fingerprint 
                  size={48} 
                  className={`${
                    scanStatus === 'scanning' 
                      ? 'text-brand-gold animate-scanner-pulse' 
                      : scanStatus === 'matched'
                      ? 'text-brand-dark-green'
                      : 'text-brand-gray-neutral group-hover:text-brand-dark-green'
                  }`} 
                />
                <div>
                  <p className="text-brand-dark-green font-medium text-sm">
                    {scanStatus === 'scanning' 
                      ? 'Scanning fingerprint...' 
                      : scanStatus === 'matched'
                      ? 'Fingerprint matched!'
                      : 'Place finger on scanner'}
                  </p>
                  <p className="text-brand-gray-neutral text-xs mt-0.5">
                    {scanStatus === 'scanning' 
                      ? 'Keep finger flat' 
                      : scanStatus === 'nomatch'
                      ? 'Fingerprint not recognized. Click to try again.'
                      : 'Click area to simulate physical scan'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Divider & Method 2: Manual Employee ID Input */}
          {allowManualId && (
            <>
              {/* Divider */}
              <div className="flex items-center justify-between select-none">
                <div className="h-[1px] bg-brand-light-green/40 flex-1" />
                <span className="px-4 text-xs font-semibold text-brand-gray-neutral">OR</span>
                <div className="h-[1px] bg-brand-light-green/40 flex-1" />
              </div>

              {/* Method 2: Manual Employee ID Input */}
              <form onSubmit={handleManualLookup} className="space-y-4">
                <span className="text-[13px] font-medium text-brand-dark-green uppercase tracking-wider block">
                  Method 2: Manual Lookup
                </span>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      placeholder="e.g. EMP-00123"
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      disabled={isSearching}
                      className="w-full h-[44px] pl-10 pr-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-2 focus:border-brand-dark-green text-sm text-brand-dark-green"
                    />
                    <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral" />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="h-[44px] bg-brand-gold text-brand-white px-5 rounded-[8px] text-sm font-medium hover:opacity-90 transition shrink-0 flex items-center justify-center gap-1.5"
                  >
                    {isSearching ? '...' : 'Lookup'}
                  </button>
                </div>
              </form>
            </>
          )}

        </div>
      </div>
    );
  }

  // ---------------- STEP 2: SESSION SELECTION ----------------
  if (cashierStep === 2) {
    // Edge case check: Are all sessions consumed?
    const allConsumed = Object.values(sessionStatus).every(status => status === 'Consumed');

    return (
      <div className="w-full max-w-[650px] mx-auto mt-4 space-y-4">
        {renderEmployeeBanner()}

        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-[20px] font-semibold text-brand-dark-green">
              Select Meal Session
            </h2>
            <p className="text-brand-gray-neutral text-sm">
              Choose which meal is being served
            </p>
          </div>

          {allConsumed ? (
            <div className="border border-brand-error-red/20 bg-brand-error-red/5 rounded-[12px] p-8 text-center space-y-3">
              <CheckCircle size={48} className="text-brand-error-red mx-auto opacity-85" />
              <div>
                <h3 className="text-brand-dark-green font-semibold text-lg">All Meals Consumed</h3>
                <p className="text-brand-gray-neutral text-sm mt-1">
                  All meal sessions today have already been logged for this employee.
                </p>
              </div>
              <button
                onClick={resetCashierFlow}
                className="mt-2 text-brand-gold text-sm font-semibold hover:underline"
              >
                Go back to employee list
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Breakfast */}
              <button
                disabled={sessionStatus.Breakfast === 'Consumed'}
                onClick={() => handleSelectSession('Breakfast')}
                className={`border rounded-[12px] p-6 text-center select-none flex flex-col items-center gap-3 transition-all duration-200 ${
                  sessionStatus.Breakfast === 'Consumed'
                    ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                    : 'bg-brand-white border-gray-300 hover:border-brand-gold hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] cursor-pointer'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-brand-dark-green/5 text-brand-dark-green flex items-center justify-center shrink-0">
                  <Coffee size={24} />
                </div>
                <div>
                  <h4 className="text-brand-dark-green font-medium text-base">Breakfast</h4>
                  <div className="flex items-center gap-1.5 justify-center mt-1.5">
                    <span className={`w-2 h-2 rounded-full ${sessionStatus.Breakfast === 'Consumed' ? 'bg-brand-error-red' : 'bg-brand-dark-green'}`} />
                    <span className={`text-[12px] font-medium ${sessionStatus.Breakfast === 'Consumed' ? 'text-brand-error-red' : 'text-brand-dark-green'}`}>
                      {sessionStatus.Breakfast === 'Consumed' ? 'Consumed' : 'Available'}
                    </span>
                  </div>
                </div>
              </button>

              {/* Lunch */}
              <button
                disabled={sessionStatus.Lunch === 'Consumed'}
                onClick={() => handleSelectSession('Lunch')}
                className={`border rounded-[12px] p-6 text-center select-none flex flex-col items-center gap-3 transition-all duration-200 ${
                  sessionStatus.Lunch === 'Consumed'
                    ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                    : 'bg-brand-white border-gray-300 hover:border-brand-gold hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] cursor-pointer'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-brand-dark-green/5 text-brand-dark-green flex items-center justify-center shrink-0">
                  <Sun size={24} />
                </div>
                <div>
                  <h4 className="text-brand-dark-green font-medium text-base">Lunch</h4>
                  <div className="flex items-center gap-1.5 justify-center mt-1.5">
                    <span className={`w-2 h-2 rounded-full ${sessionStatus.Lunch === 'Consumed' ? 'bg-brand-error-red' : 'bg-brand-dark-green'}`} />
                    <span className={`text-[12px] font-medium ${sessionStatus.Lunch === 'Consumed' ? 'text-brand-error-red' : 'text-brand-dark-green'}`}>
                      {sessionStatus.Lunch === 'Consumed' ? 'Consumed' : 'Available'}
                    </span>
                  </div>
                </div>
              </button>

              {/* Dinner */}
              <button
                disabled={sessionStatus.Dinner === 'Consumed'}
                onClick={() => handleSelectSession('Dinner')}
                className={`border rounded-[12px] p-6 text-center select-none flex flex-col items-center gap-3 transition-all duration-200 ${
                  sessionStatus.Dinner === 'Consumed'
                    ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                    : 'bg-brand-white border-gray-300 hover:border-brand-gold hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] cursor-pointer'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-brand-dark-green/5 text-brand-dark-green flex items-center justify-center shrink-0">
                  <Moon size={24} />
                </div>
                <div>
                  <h4 className="text-brand-dark-green font-medium text-base">Dinner</h4>
                  <div className="flex items-center gap-1.5 justify-center mt-1.5">
                    <span className={`w-2 h-2 rounded-full ${sessionStatus.Dinner === 'Consumed' ? 'bg-brand-error-red' : 'bg-brand-dark-green'}`} />
                    <span className={`text-[12px] font-medium ${sessionStatus.Dinner === 'Consumed' ? 'text-brand-error-red' : 'text-brand-dark-green'}`}>
                      {sessionStatus.Dinner === 'Consumed' ? 'Consumed' : 'Available'}
                    </span>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-start pt-2 select-none">
            <button
              onClick={() => goToStep(1)}
              className="text-brand-gold hover:underline text-sm font-medium flex items-center gap-1.5"
            >
              <ArrowLeft size={16} />
              <span>Back to Identification</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- STEP 3: MENU SELECTION ----------------
  if (cashierStep === 3) {
    return (
      <div className="w-full max-w-[650px] mx-auto mt-4 space-y-4">
        {renderEmployeeBanner()}

        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 space-y-6">
          
          {/* Header & Session Badge */}
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div className="space-y-1">
              <h2 className="text-[20px] font-semibold text-brand-dark-green">
                Select Menu Item
              </h2>
              <p className="text-brand-gray-neutral text-sm">
                What is the employee eating?
              </p>
            </div>
            
            <div className="flex items-center gap-2 select-none">
              <span className="bg-brand-light-green text-brand-dark-green text-xs font-semibold px-3 py-1.5 rounded-full uppercase tracking-wider">
                {selectedSession} Selected
              </span>
              <button 
                onClick={() => goToStep(2)}
                className="text-brand-gold text-xs font-medium hover:underline"
              >
                Change
              </button>
            </div>
          </div>

          {/* Menu Items List */}
          <div className="space-y-3">
            {isLoadingMenu ? (
              // Skeleton loading rows
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-50 rounded-[8px] animate-pulse border border-gray-100" />
              ))
            ) : menuItems.length === 0 ? (
              <div className="text-center py-8 text-brand-gray-neutral text-sm">
                No menu items available for this session.
              </div>
            ) : (
              menuItems.map((item) => {
                const isSelected = selectedMenu?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectMenu(item)}
                    className={`border rounded-[8px] p-4 flex items-center justify-between cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-brand-gold bg-brand-light-green/10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]' 
                        : 'border-gray-300 hover:border-brand-gold bg-brand-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Custom Circular Radio Icon */}
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-brand-gold' : 'border-gray-300'
                      }`}>
                        {isSelected && <div className="w-2.5 h-2.5 bg-brand-gold rounded-full" />}
                      </div>
                      <span className="text-brand-dark-green font-medium text-sm md:text-base">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-brand-dark-green font-semibold text-sm">
                      {item.price.toFixed(2)} ETB
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => goToStep(2)}
              className="text-brand-gold hover:underline text-sm font-medium flex items-center gap-1.5"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>

            <button
              disabled={!selectedMenu}
              onClick={() => goToStep(4)}
              className="bg-brand-gold text-brand-white px-6 h-[48px] rounded-[8px] text-sm font-medium hover:opacity-90 active:scale-[0.99] transition disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- STEP 4: REVIEW & CONFIRM ----------------
  if (cashierStep === 4) {
    if (!selectedEmployee || !selectedSession || !selectedMenu) return null;

    // Subsidy splits
    const empShare = parseFloat(((selectedMenu.price * 40) / 100).toFixed(2));
    const compShare = parseFloat(((selectedMenu.price * 60) / 100).toFixed(2));

    const dateString = new Date().toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    return (
      <div className="w-full max-w-[650px] mx-auto mt-4 space-y-4">
        {renderEmployeeBanner()}

        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-[20px] font-semibold text-brand-dark-green">
              Review Transaction
            </h2>
            <p className="text-brand-gray-neutral text-sm">
              Please verify all details before submitting
            </p>
          </div>

          {/* Details Table */}
          <div className="border border-gray-200 rounded-[8px] overflow-hidden select-none">
            <table className="w-full text-sm border-collapse text-left">
              <tbody>
                <tr className="border-b border-gray-100 bg-[#F9FAFB]/30">
                  <td className="p-3 text-brand-gray-neutral font-medium w-[40%]">Employee Name</td>
                  <td className="p-3 text-brand-dark-green font-semibold">{selectedEmployee.name}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="p-3 text-brand-gray-neutral font-medium">Employee ID</td>
                  <td className="p-3 text-brand-dark-green font-mono text-[13px]">{selectedEmployee.id}</td>
                </tr>
                <tr className="border-b border-gray-100 bg-[#F9FAFB]/30">
                  <td className="p-3 text-brand-gray-neutral font-medium">Department</td>
                  <td className="p-3 text-brand-dark-green">{selectedEmployee.department}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="p-3 text-brand-gray-neutral font-medium">Meal Session</td>
                  <td className="p-3">
                    <span className="bg-brand-light-green text-brand-dark-green text-xs font-semibold px-2 py-0.5 rounded">
                      {selectedSession}
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-gray-100 bg-[#F9FAFB]/30">
                  <td className="p-3 text-brand-gray-neutral font-medium">Menu Item</td>
                  <td className="p-3 text-brand-dark-green font-medium">{selectedMenu.name}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="p-3 text-brand-gray-neutral font-medium">Menu Price</td>
                  <td className="p-3 text-brand-dark-green font-semibold">{selectedMenu.price.toFixed(2)} ETB</td>
                </tr>
                <tr className="border-b border-gray-100 bg-brand-light-green/5">
                  <td className="p-3 text-brand-gray-neutral font-medium">Employee Share (40%)</td>
                  <td className="p-3 text-brand-dark-green font-medium">{empShare.toFixed(2)} ETB</td>
                </tr>
                <tr className="border-b border-gray-200 bg-brand-dark-green/5">
                  <td className="p-3 text-brand-gray-neutral font-medium">Company Share (60%)</td>
                  <td className="p-3 text-brand-dark-green font-medium">{compShare.toFixed(2)} ETB</td>
                </tr>
                <tr>
                  <td className="p-3 text-brand-gray-neutral font-medium">Date & Time</td>
                  <td className="p-3 text-brand-gray-neutral text-xs">{dateString}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Subsidy Split Graphic */}
          <div className="space-y-2 select-none">
            <span className="text-[13px] font-medium text-brand-dark-green uppercase tracking-wider block">
              Subsidy Split Allocation
            </span>
            <div className="h-8 rounded-[8px] overflow-hidden flex text-xs font-semibold text-center leading-8">
              <div 
                className="bg-brand-light-green text-brand-dark-green transition-all" 
                style={{ width: '40%' }}
                title="Employee share (40%)"
              >
                Employee ({empShare.toFixed(2)} ETB)
              </div>
              <div 
                className="bg-brand-dark-green text-brand-white transition-all" 
                style={{ width: '60%' }}
                title="Company share (60%)"
              >
                Company ({compShare.toFixed(2)} ETB)
              </div>
            </div>
            <p className="text-[11px] text-brand-gray-neutral">
              * Rates pulled dynamically from current configuration.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => setShowConfirmModal(true)}
              className="w-full h-[56px] bg-brand-dark-green text-brand-white rounded-[8px] font-semibold text-base hover:opacity-95 active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-sm"
            >
              <CheckSquare size={22} />
              <span>Confirm & Submit</span>
            </button>

            <div className="flex justify-center gap-6 text-sm">
              <button 
                onClick={() => goToStep(3)} 
                className="text-brand-gold font-medium hover:underline"
              >
                Edit Selection
              </button>
              <button 
                onClick={resetCashierFlow} 
                className="text-brand-gold font-medium hover:underline text-brand-error-red"
              >
                Cancel & Reset
              </button>
            </div>
          </div>

          {/* Confirm Transaction Modal */}
          {showConfirmModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 select-none">
              <div className="bg-brand-white rounded-[12px] p-8 max-w-[400px] w-full border border-[rgba(50,100,50,0.15)] shadow-lg space-y-6 animate-scanner-pulse/0">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-brand-gold/10 text-brand-gold inline-flex items-center justify-center">
                    <Question size={36} />
                  </div>
                  <h3 className="text-brand-dark-green font-bold text-[18px]">
                    Confirm Transaction?
                  </h3>
                  <p className="text-brand-gray-neutral text-xs leading-relaxed">
                    This will permanently record the meal subsidy registration. This operation cannot be deleted; corrections require Admin approval.
                  </p>
                </div>
                
                <div className="flex flex-col gap-2">
                  <button
                    disabled={isSubmitting}
                    onClick={handleFinalSubmit}
                    className="w-full h-[48px] bg-brand-gold text-brand-white font-medium text-sm rounded-[8px] hover:opacity-90 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Yes, Submit'}
                  </button>
                  
                  <button
                    disabled={isSubmitting}
                    onClick={() => setShowConfirmModal(false)}
                    className="w-full h-[48px] border border-brand-dark-green text-brand-dark-green font-medium text-sm rounded-[8px] hover:bg-brand-dark-green/5 transition"
                  >
                    No, Go Back
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  // ---------------- STEP 5: SUCCESS / RECEIPT ----------------
  if (cashierStep === 5) {
    if (!selectedEmployee || !selectedSession || !selectedMenu) return null;

    return (
      <div className="w-full max-w-[500px] mx-auto mt-4 select-none">
        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] border-t-[6px] border-t-brand-light-green rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-8 space-y-6">
          
          <div className="text-center space-y-2">
            <CheckCircle size={64} className="text-brand-dark-green mx-auto" />
            <h2 className="text-[20px] font-semibold text-brand-dark-green">
              Transaction Successful
            </h2>
            <p className="text-brand-gray-neutral text-sm font-mono bg-gray-50 px-3 py-1 rounded inline-block border border-gray-100">
              ID: {lastTransactionId || 'TXN-UNKNOWN'}
            </p>
          </div>

          {/* Compact Receipt Card */}
          <div className="border border-brand-light-green/30 bg-[#F9FAFB]/40 p-4 rounded-[8px] space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-brand-gray-neutral">Employee</span>
              <span className="text-brand-dark-green font-semibold">{selectedEmployee.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-gray-neutral">Department</span>
              <span className="text-brand-dark-green">{selectedEmployee.department}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-gray-neutral">Session</span>
              <span className="text-brand-dark-green font-medium">{selectedSession}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-gray-neutral">Item</span>
              <span className="text-brand-dark-green font-medium">{selectedMenu.name}</span>
            </div>
            <div className="h-[1px] bg-brand-light-green/30 my-1" />
            <div className="flex justify-between text-base font-bold">
              <span className="text-brand-dark-green">Amount Charged</span>
              <span className="text-brand-dark-green">{selectedMenu.price.toFixed(2)} ETB</span>
            </div>
          </div>

          <div className="text-center text-xs text-brand-gray-neutral bg-gray-50 py-2 rounded">
            Auto-resetting page in <span className="font-semibold text-brand-dark-green font-mono">{countdown}</span> seconds...
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleNewRegistration}
              className="w-full h-[48px] bg-brand-gold text-brand-white font-medium text-sm rounded-[8px] hover:opacity-90 active:scale-[0.99] transition"
            >
              New Registration
            </button>
            
            <button
              onClick={() => {
                resetCashierFlow();
                navigate('/cashier/transactions');
              }}
              className="w-full h-[48px] border border-brand-dark-green text-brand-dark-green font-medium text-sm rounded-[8px] hover:bg-brand-dark-green/5 transition"
            >
              View Today's Transactions
            </button>
          </div>

        </div>
      </div>
    );
  }

  return null;
};
