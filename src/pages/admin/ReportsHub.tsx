import React, { useState, useEffect, useCallback } from 'react';
import { db, type Transaction } from '../../db/db';
import axiosInstance from '../../client/axios';
import { useApp } from '../../context/AppContext';
import {
  FileXls,
  FilePdf,
  Info,
  ChartBar,
  Users,
  // Coffee,
  // Sun,
  // Moon,
  CurrencyDollar,
  WarningCircle,
  Download,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// Types for API report data
interface PayrollReport {
  employeeId: string;
  employeeName: string;
  department: string;
  mealCount: number;
  totalMealCost: number;
  employeeShare: number;
  companyShare: number;
}

interface CompanyPaymentReport {
  total_menu_number: number;
  total_menu_price: number;
  total_company_share: number;
  transactionFromDate: string;
  transactionToDate: string;
}

type ReportType = 'payroll' | 'company' | 'invoice';
type PeriodOption = 'today' | 'week' | 'month' | 'custom';

export const ReportsHub: React.FC = () => {
  const { currentUser, isOffline } = useApp();

  // Tab State
  const [activeTab, setActiveTab] = useState<ReportType>('payroll');

  // Filter States
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [employeeStatus, setEmployeeStatus] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [period, setPeriod] = useState<PeriodOption>('month');

  // Local Transaction Data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  // API Report Data
  const [payrollData, setPayrollData] = useState<PayrollReport[]>([]);
  const [companyPayment, setCompanyPayment] = useState<CompanyPaymentReport | null>(null);

  // Invoice Inputs for Invoice Tab
  const [invoiceInputs, setInvoiceInputs] = useState<Record<string, string>>({});

  /**
   * Check if user has permission to view reports
   * Handles both uppercase and capitalized role formats
   */
  const hasPermission = (): boolean => {
    if (!currentUser) return false;
    const role = currentUser.role?.toUpperCase() || '';
    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  };

  /**
   * Format currency - kept for potential future use
   */
  // const _formatCurrency = (amount: number): string => {
  //   return amount.toFixed(2) + ' ETB';
  // };

  /**
   * Get period date range
   */
  const getPeriodRange = useCallback(() => {
    const today = new Date();
    let from = new Date();
    let to = new Date();

    switch (period) {
      case 'today':
        from = new Date(today);
        to = new Date(today);
        break;
      case 'week':
        from = new Date(today);
        from.setDate(today.getDate() - 7);
        to = new Date(today);
        break;
      case 'month':
        from = new Date(today);
        from.setMonth(today.getMonth() - 1);
        to = new Date(today);
        break;
      case 'custom':
        from = new Date(startDate);
        to = new Date(endDate);
        break;
      default:
        from = new Date(today);
        to = new Date(today);
    }

    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };
  }, [period, startDate, endDate]);

  /**
   * Fetch API Reports
   */
  const fetchApiReports = async () => {
    if (isOffline) {
      toast.error('Cannot fetch reports while offline');
      return;
    }

    if (!hasPermission()) {
      toast.error('You do not have permission to view reports');
      return;
    }

    const range = getPeriodRange();
    setLoading(true);

    try {
      // Fetch all reports in parallel
      const [payrollRes, companyRes] = await Promise.all([
        axiosInstance.get('/api/reports/payroll', {
          params: { from: range.from, to: range.to }
        }).catch((err) => {
          if (err.response?.status === 404) {
            console.warn('Payroll report endpoint not found - using local data');
            return { data: null };
          }
          throw err;
        }),
        axiosInstance.get('/api/reports/company-payment', {
          params: { from: range.from, to: range.to }
        }).catch((err) => {
          if (err.response?.status === 404) {
            console.warn('Company payment endpoint not found - using local data');
            return { data: null };
          }
          throw err;
        })
      ]);

      if (payrollRes?.data?.success && payrollRes?.data?.data) {
        setPayrollData(payrollRes.data.data);
      }

      if (companyRes?.data?.success && companyRes?.data?.data) {
        setCompanyPayment(companyRes.data.data);
      }

    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error('You do not have permission to view these reports');
      } else if (error.response?.status === 404) {
        console.log('Some report endpoints not available, using local data');
      } else {
        console.error('Error fetching reports:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch local transaction data
   */
  const fetchLocalTransactions = async () => {
    setLoading(true);
    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const list = await db.transactions
        .where('timestamp')
        .between(start, end, true, true)
        .toArray();

      if (employeeStatus !== 'All') {
        const filtered = [];
        for (const t of list) {
          const emp = await db.employees.get(t.employeeId);
          // ✅ FIXED: Compare status correctly
          if (emp) {
            // Convert emp.status (which is 'ACTIVE' | 'INACTIVE') to match employeeStatus
            const empStatus = emp.status === 'ACTIVE' ? 'Active' : 'Inactive';
            if (empStatus === employeeStatus) {
              filtered.push(t);
            }
          }
        }
        setTransactions(filtered);
      } else {
        setTransactions(list);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to query transactions for reports');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchLocalTransactions();
    fetchApiReports();
  }, [startDate, endDate, employeeStatus, period]);

  // Handle invoice input edits
  const handleInvoiceChange = (dateKey: string, val: string) => {
    setInvoiceInputs(prev => ({
      ...prev,
      [dateKey]: val
    }));
  };

  // ================= CALCULATIONS & DATA MAPPING =================

  /**
   * Get payroll data from local transactions
   */
  const getLocalPayrollData = () => {
    const map: Record<string, { id: string; name: string; department: string; count: number; total: number }> = {};

    transactions.forEach(t => {
      if (!map[t.employeeId]) {
        map[t.employeeId] = {
          id: t.employeeId,
          name: t.employeeName,
          department: '',
          count: 0,
          total: 0
        };
      }
      map[t.employeeId].count += 1;
      map[t.employeeId].total += t.price;
    });

    return Object.values(map).map(item => ({
      ...item,
      empCost: item.total * 0.40,
      compCost: item.total * 0.60
    }));
  };

  /**
   * Get company payment data from local transactions
   */
  const getLocalCompanyData = () => {
    const map: Record<string, { department: string; count: number; total: number }> = {};

    transactions.forEach(t => {
      const dept = t.employeeId.includes('EMP') ? 'Engineering' : 'Finance';
      const finalDept = dept;

      if (!map[finalDept]) {
        map[finalDept] = {
          department: finalDept,
          count: 0,
          total: 0
        };
      }
      map[finalDept].count += 1;
      map[finalDept].total += t.price;
    });

    return Object.values(map).map(item => ({
      ...item,
      compCost: item.total * 0.60
    }));
  };

  /**
   * Get invoice verification data from local transactions
   */
  const getLocalInvoiceData = () => {
    const map: Record<string, { date: string; count: number; total: number; compCost: number }> = {};

    transactions.forEach(t => {
      const dateKey = format(t.timestamp, 'yyyy-MM-dd');
      if (!map[dateKey]) {
        map[dateKey] = {
          date: dateKey,
          count: 0,
          total: 0,
          compCost: 0
        };
      }
      map[dateKey].count += 1;
      map[dateKey].total += t.price;
      map[dateKey].compCost += t.price * 0.60;
    });

    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  };

  /**
   * Render session icon - kept for potential future use
   */
  // const _getSessionIcon = (session: string) => {
  //   switch (session) {
  //     case 'BREAKFAST':
  //       return <Coffee size={16} className="text-brand-gold" />;
  //     case 'LUNCH':
  //       return <Sun size={16} className="text-brand-gold" />;
  //     case 'DINNER':
  //       return <Moon size={16} className="text-brand-gold" />;
  //     default:
  //       return <Coffee size={16} className="text-brand-gray-neutral" />;
  //   }
  // };

  // ================= REPORT EXPORTS =================

  /**
   * Download file helper
   */
  const downloadFile = (blob: Blob, filename: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  /**
   * Export to Excel using backend API
   */
  const handleExportExcel = async () => {
    if (isOffline) {
      toast.error('Cannot export while offline');
      return;
    }

    if (!hasPermission()) {
      toast.error('You do not have permission to export reports');
      return;
    }

    const range = getPeriodRange();
    const loadingToast = toast.loading('Generating Excel report...');

    try {
      let endpoint = '';

      switch (activeTab) {
        case 'payroll':
          endpoint = '/api/reports/payroll/export';
          break;
        case 'company':
        case 'invoice':
          endpoint = '/api/reports/company-payment/export';
          break;
        default:
          toast.error('Invalid report type', { id: loadingToast });
          return;
      }

      // Call the backend export endpoint
      const response = await axiosInstance.get(endpoint, {
        params: {
          from: range.from,
          to: range.to,
        },
        responseType: 'blob',
      });

      // Create filename with date range
      const finalFilename = `report-${activeTab}-${range.from}-${range.to}.xlsx`;

      // Download the file
      downloadFile(response.data, finalFilename);
      toast.success('Excel report downloaded successfully!', { id: loadingToast });

    } catch (error: any) {
      console.error('Export error:', error);

      // Fallback: Use local generation if backend export fails
      if (error.response?.status === 404 || error.response?.status === 500) {
        toast.loading('Using local export as fallback...', { id: loadingToast });
        await handleLocalExportExcel(loadingToast);
      } else if (error.response?.status === 403) {
        toast.error('You do not have permission to export reports', { id: loadingToast });
      } else {
        toast.error('Failed to export report. Please try again.', { id: loadingToast });
      }
    }
  };

  /**
   * Local Excel export as fallback
   */
  const handleLocalExportExcel = async (toastId?: string) => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Derba MIDROC Cement Cafeteria Admin';
      const sheet = workbook.addWorksheet('Report');

      sheet.views = [{ showGridLines: true }];

      if (activeTab === 'payroll') {
        const data = payrollData.length > 0 ? payrollData : getLocalPayrollData();
        sheet.columns = [
          { header: 'Employee ID', key: 'id', width: 15 },
          { header: 'Employee Name', key: 'name', width: 25 },
          { header: 'Meals Count', key: 'count', width: 15 },
          { header: 'Total Value (ETB)', key: 'total', width: 20 },
          { header: 'Employee Share (40%)', key: 'empCost', width: 25 },
          { header: 'Company Share (60%)', key: 'compCost', width: 25 }
        ];

        data.forEach((row: any) => {
          sheet.addRow({
            id: row.employeeId || row.id,
            name: row.employeeName || row.name,
            count: row.mealCount || row.count,
            total: row.totalMealCost || row.total,
            empCost: row.employeeShare || row.empCost,
            compCost: row.companyShare || row.compCost || (row.total * 0.60)
          });
        });
      } else if (activeTab === 'company') {
        const data = companyPayment ? [companyPayment] : getLocalCompanyData();
        sheet.columns = [
          { header: 'Department', key: 'department', width: 25 },
          { header: 'Meals Count', key: 'count', width: 15 },
          { header: 'Total Value (ETB)', key: 'total', width: 20 },
          { header: 'Company Subsidy (60%)', key: 'compCost', width: 25 }
        ];

        const companyRows = Array.isArray(data) ? data : [data];
        companyRows.forEach((row: any) => {
          sheet.addRow({
            department: row.department || 'All Departments',
            count: row.total_menu_number || row.count || 0,
            total: row.total_menu_price || row.total || 0,
            compCost: row.total_company_share || row.compCost || 0
          });
        });
      } else {
        const data = getLocalInvoiceData();
        sheet.columns = [
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Total Meals', key: 'count', width: 15 },
          { header: 'Company Share (60%)', key: 'compCost', width: 25 },
          { header: 'Outsourced Invoice (ETB)', key: 'invoice', width: 25 },
          { header: 'Discrepancy (ETB)', key: 'discrepancy', width: 20 }
        ];

        data.forEach(row => {
          const invAmt = parseFloat(invoiceInputs[row.date] || '0');
          sheet.addRow({
            date: row.date,
            count: row.count,
            compCost: row.compCost,
            invoice: invAmt,
            discrepancy: invAmt - row.compCost
          });
        });
      }

      // Format Sheet Header style
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF326432' }
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const range = getPeriodRange();
      downloadFile(blob, `Derba_Cafeteria_${activeTab}_Report_${range.from}_to_${range.to}.xlsx`);

      if (toastId) {
        toast.success('Excel report downloaded successfully!', { id: toastId });
      } else {
        toast.success('Excel spreadsheet generated successfully!');
      }
    } catch (e) {
      console.error(e);
      if (toastId) {
        toast.error('Failed to generate Excel report', { id: toastId });
      } else {
        toast.error('Failed to generate Excel report');
      }
    }
  };

  /**
   * Export to PDF using backend API
   */
  const handleExportPDF = async () => {
    if (isOffline) {
      toast.error('Cannot export while offline');
      return;
    }

    if (!hasPermission()) {
      toast.error('You do not have permission to export reports');
      return;
    }

    const range = getPeriodRange();
    const loadingToast = toast.loading('Generating PDF report...');

    try {
      let endpoint = '';

      switch (activeTab) {
        case 'payroll':
          endpoint = '/api/reports/payroll/export';
          break;
        case 'company':
        case 'invoice':
          endpoint = '/api/reports/company-payment/export';
          break;
        default:
          toast.error('Invalid report type', { id: loadingToast });
          return;
      }

      // Call the backend export endpoint with PDF accept header
      const response = await axiosInstance.get(endpoint, {
        params: {
          from: range.from,
          to: range.to,
        },
        headers: {
          'Accept': 'application/pdf',
        },
        responseType: 'blob',
      });

      // Check if we got a PDF by checking content-type header
      const contentType = response.headers['content-type'];
      const isPdf = typeof contentType === 'string' && contentType.includes('pdf');

      if (isPdf) {
        const finalFilename = `report-${activeTab}-${range.from}-${range.to}.pdf`;
        downloadFile(response.data, finalFilename);
        toast.success('PDF report downloaded successfully!', { id: loadingToast });
      } else {
        // If backend doesn't support PDF, fallback to local generation
        toast.loading('Using local PDF generation...', { id: loadingToast });
        await handleLocalExportPDF(loadingToast);
      }

    } catch (error: any) {
      console.error('PDF export error:', error);

      // Fallback: Use local generation
      if (error.response?.status === 404 || error.response?.status === 500) {
        toast.loading('Using local PDF generation as fallback...', { id: loadingToast });
        await handleLocalExportPDF(loadingToast);
      } else if (error.response?.status === 403) {
        toast.error('You do not have permission to export reports', { id: loadingToast });
      } else {
        toast.error('Failed to export PDF. Please try again.', { id: loadingToast });
      }
    }
  };

  /**
   * Local PDF export as fallback
   */
  const handleLocalExportPDF = async (toastId?: string) => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      doc.setFont('Inter', 'normal');

      // Title header
      doc.setFillColor(50, 100, 50);
      doc.rect(0, 0, 210, 30, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text('DERBA MIDROC CEMENT CAFETERIA SUBSIDY SYSTEM', 15, 12);

      const range = getPeriodRange();
      doc.setFontSize(10);
      doc.text(`Report Type: ${activeTab.toUpperCase()} | Date Range: ${range.from} to ${range.to}`, 15, 22);

      doc.setTextColor(50, 100, 50);
      doc.setFontSize(14);
      doc.text('Report Details Preview', 15, 42);

      let currentY = 50;
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);

      if (activeTab === 'payroll') {
        const data = payrollData.length > 0 ? payrollData : getLocalPayrollData();
        doc.setFont('Inter', 'bold');
        doc.text('Employee ID', 15, currentY);
        doc.text('Name', 50, currentY);
        doc.text('Meals', 110, currentY);
        doc.text('Total (ETB)', 140, currentY);
        doc.text('Employee (40%)', 175, currentY);

        currentY += 6;
        doc.line(15, currentY - 3, 195, currentY - 3);
        doc.setFont('Inter', 'normal');

        data.forEach((row: any) => {
          if (currentY > 270) {
            doc.addPage();
            currentY = 20;
          }
          doc.text(row.employeeId || row.id, 15, currentY);
          doc.text(row.employeeName || row.name, 50, currentY);
          doc.text(String(row.mealCount || row.count), 110, currentY);
          doc.text((row.totalMealCost || row.total).toFixed(2), 140, currentY);
          doc.text((row.employeeShare || row.empCost).toFixed(2), 175, currentY);
          currentY += 8;
        });
      } else if (activeTab === 'company') {
        const data = companyPayment ? [companyPayment] : getLocalCompanyData();
        doc.setFont('Inter', 'bold');
        doc.text('Department', 15, currentY);
        doc.text('Meals', 70, currentY);
        doc.text('Total (ETB)', 110, currentY);
        doc.text('Company (60%)', 150, currentY);

        currentY += 6;
        doc.line(15, currentY - 3, 195, currentY - 3);
        doc.setFont('Inter', 'normal');

        const rows = Array.isArray(data) ? data : [data];
        rows.forEach((row: any) => {
          if (currentY > 270) {
            doc.addPage();
            currentY = 20;
          }
          doc.text(row.department || 'All', 15, currentY);
          doc.text(String(row.total_menu_number || row.count || 0), 70, currentY);
          doc.text((row.total_menu_price || row.total || 0).toFixed(2), 110, currentY);
          doc.text((row.total_company_share || row.compCost || 0).toFixed(2), 150, currentY);
          currentY += 8;
        });
      } else {
        const data = getLocalInvoiceData();
        doc.setFont('Inter', 'bold');
        doc.text('Date', 15, currentY);
        doc.text('Meals', 45, currentY);
        doc.text('Company (60%)', 70, currentY);
        doc.text('Invoice', 115, currentY);
        doc.text('Discrepancy', 160, currentY);

        currentY += 6;
        doc.line(15, currentY - 3, 195, currentY - 3);
        doc.setFont('Inter', 'normal');

        data.forEach(row => {
          if (currentY > 270) {
            doc.addPage();
            currentY = 20;
          }
          const invAmt = parseFloat(invoiceInputs[row.date] || '0');
          doc.text(row.date, 15, currentY);
          doc.text(String(row.count), 45, currentY);
          doc.text(row.compCost.toFixed(2), 70, currentY);
          doc.text(invAmt.toFixed(2), 115, currentY);

          const disc = invAmt - row.compCost;
          doc.setTextColor(disc !== 0 ? 220 : 0, disc !== 0 ? 38 : 100, disc !== 0 ? 38 : 50);
          doc.text(disc.toFixed(2), 160, currentY);
          doc.setTextColor(0, 0, 0);

          currentY += 8;
        });
      }

      const filename = `Derba_Cafeteria_${activeTab}_Report_${range.from}_to_${range.to}.pdf`;
      doc.save(filename);

      if (toastId) {
        toast.success('PDF report downloaded successfully!', { id: toastId });
      } else {
        toast.success('PDF report saved successfully!');
      }
    } catch (e) {
      console.error(e);
      if (toastId) {
        toast.error('Failed to generate PDF report', { id: toastId });
      } else {
        toast.error('Failed to generate PDF report');
      }
    }
  };

  // If user doesn't have permission, show access denied
  if (!hasPermission()) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] select-none">
        <div className="bg-brand-white border border-brand-error-red/20 rounded-[12px] p-8 max-w-md text-center shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
          <WarningCircle size={48} className="text-brand-error-red mx-auto mb-4" />
          <h2 className="text-[20px] font-semibold text-brand-dark-green mb-2">Access Denied</h2>
          <p className="text-brand-gray-neutral text-sm">
            You do not have permission to view reports. Please contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Title */}
      <div className="flex items-center justify-between border-b border-brand-light-green/30 pb-4 select-none">
        <div>
          <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none flex items-center gap-2">
            <ChartBar size={28} className="text-brand-gold" />
            Reports Hub
          </h1>
          <p className="text-brand-gray-neutral text-sm mt-2">
            Generate payroll deductions, company payments, and verify vendor catering invoices
          </p>
        </div>
      </div>

      {/* Query Filters */}
      <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] grid grid-cols-1 md:grid-cols-4 gap-4 select-none">
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-brand-dark-green">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full h-[40px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-xs text-brand-dark-green cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-brand-dark-green">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full h-[40px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-xs text-brand-dark-green cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-brand-dark-green">Employee Status</label>
          <select
            value={employeeStatus}
            onChange={(e) => setEmployeeStatus(e.target.value as any)}
            className="w-full h-[40px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-xs text-brand-dark-green bg-brand-white cursor-pointer"
          >
            <option value="All">All Employees</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-brand-dark-green">Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodOption)}
            className="w-full h-[40px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-xs text-brand-dark-green bg-brand-white cursor-pointer"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="space-y-4">
        {/* Tab Buttons */}
        <div className="flex border-b border-gray-200 select-none overflow-x-auto">
          <button
            onClick={() => setActiveTab('payroll')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${activeTab === 'payroll'
              ? 'border-brand-gold text-brand-dark-green bg-brand-light-green/10'
              : 'border-transparent text-brand-gray-neutral hover:text-brand-dark-green'
              }`}
          >
            <div className="flex items-center gap-2">
              <Users size={16} />
              Payroll Deduction
            </div>
          </button>
          <button
            onClick={() => setActiveTab('company')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${activeTab === 'company'
              ? 'border-brand-gold text-brand-dark-green bg-brand-light-green/10'
              : 'border-transparent text-brand-gray-neutral hover:text-brand-dark-green'
              }`}
          >
            <div className="flex items-center gap-2">
              <CurrencyDollar size={16} />
              Company Subsidy
            </div>
          </button>
          <button
            onClick={() => setActiveTab('invoice')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${activeTab === 'invoice'
              ? 'border-brand-gold text-brand-dark-green bg-brand-light-green/10'
              : 'border-transparent text-brand-gray-neutral hover:text-brand-dark-green'
              }`}
          >
            <div className="flex items-center gap-2">
              <FilePdf size={16} />
              Invoice Verification
            </div>
          </button>
        </div>

        {/* Action Downloads Toolbar */}
        <div className="flex justify-end gap-3 select-none">
          <button
            onClick={handleExportExcel}
            className="h-[36px] bg-brand-white border border-brand-dark-green text-brand-dark-green font-medium text-xs px-4 rounded-[8px] hover:bg-brand-dark-green/5 transition flex items-center gap-1.5"
          >
            <FileXls size={16} />
            <span>Excel Export</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="h-[36px] bg-brand-white border border-brand-dark-green text-brand-dark-green font-medium text-xs px-4 rounded-[8px] hover:bg-brand-dark-green/5 transition flex items-center gap-1.5"
          >
            <FilePdf size={16} />
            <span>PDF Export</span>
          </button>
          <button
            onClick={() => {
              // Quick download of current report data as JSON
              const range = getPeriodRange();
              const data = {
                reportType: activeTab,
                dateRange: range,
                transactions: transactions.length,
                generatedAt: new Date().toISOString(),
                payrollData: activeTab === 'payroll' ? payrollData : undefined,
                companyPayment: activeTab === 'company' ? companyPayment : undefined,
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `report-data-${activeTab}-${range.from}-${range.to}.json`;
              link.click();
              URL.revokeObjectURL(link.href);
              toast.success('Data exported as JSON');
            }}
            className="h-[36px] bg-brand-white border border-brand-gold text-brand-gold font-medium text-xs px-4 rounded-[8px] hover:bg-brand-gold/5 transition flex items-center gap-1.5"
          >
            <Download size={16} />
            <span>JSON Data</span>
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="h-10 bg-gray-50 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* TAB 1: PAYROLL PREVIEW */}
              {activeTab === 'payroll' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-brand-light-green bg-[#F9FAFB]/50 text-[13px] font-medium text-brand-dark-green select-none">
                        <th className="p-4">Employee ID</th>
                        <th className="p-4">Name</th>
                        <th className="p-4 text-center">Meals Count</th>
                        <th className="p-4 text-right">Total Cost</th>
                        <th className="p-4 text-right">Employee Share (40%)</th>
                        <th className="p-4 text-right">Company Share (60%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(payrollData.length > 0 ? payrollData : getLocalPayrollData()).map((row: any) => (
                        <tr key={row.employeeId || row.id} className="hover:bg-brand-light-green/5 transition-colors">
                          <td className="p-4 font-mono text-[13px] text-brand-dark-green">
                            {row.employeeId || row.id}
                          </td>
                          <td className="p-4 font-medium text-brand-dark-green">
                            {row.employeeName || row.name}
                          </td>
                          <td className="p-4 text-center text-brand-dark-green font-semibold">
                            {row.mealCount || row.count}
                          </td>
                          <td className="p-4 text-right text-brand-dark-green font-mono">
                            {(row.totalMealCost || row.total).toFixed(2)} ETB
                          </td>
                          <td className="p-4 text-right text-brand-dark-green font-bold font-mono">
                            {(row.employeeShare || row.empCost).toFixed(2)} ETB
                          </td>
                          <td className="p-4 text-right text-brand-dark-green font-bold font-mono">
                            {(row.companyShare || row.compCost || (row.total * 0.60)).toFixed(2)} ETB
                          </td>
                        </tr>
                      ))}
                      {payrollData.length === 0 && getLocalPayrollData().length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-brand-gray-neutral text-sm">
                            No payroll data available for the selected period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: COMPANY SUBSIDY PREVIEW */}
              {activeTab === 'company' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-brand-light-green bg-[#F9FAFB]/50 text-[13px] font-medium text-brand-dark-green select-none">
                        <th className="p-4">Department</th>
                        <th className="p-4 text-center">Meals Count</th>
                        <th className="p-4 text-right">Total Cost</th>
                        <th className="p-4 text-right">Company Share (60%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {companyPayment ? (
                        <tr className="hover:bg-brand-light-green/5 transition-colors">
                          <td className="p-4 font-semibold text-brand-dark-green">All Departments</td>
                          <td className="p-4 text-center text-brand-dark-green font-semibold">
                            {companyPayment.total_menu_number}
                          </td>
                          <td className="p-4 text-right text-brand-dark-green font-mono">
                            {companyPayment.total_menu_price.toFixed(2)} ETB
                          </td>
                          <td className="p-4 text-right text-brand-dark-green font-bold font-mono">
                            {companyPayment.total_company_share.toFixed(2)} ETB
                          </td>
                        </tr>
                      ) : getLocalCompanyData().map((row, idx) => (
                        <tr key={idx} className="hover:bg-brand-light-green/5 transition-colors">
                          <td className="p-4 font-semibold text-brand-dark-green">{row.department}</td>
                          <td className="p-4 text-center text-brand-dark-green font-semibold">{row.count}</td>
                          <td className="p-4 text-right text-brand-dark-green font-mono">{row.total.toFixed(2)} ETB</td>
                          <td className="p-4 text-right text-brand-dark-green font-bold font-mono">{row.compCost.toFixed(2)} ETB</td>
                        </tr>
                      ))}
                      {!companyPayment && getLocalCompanyData().length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-brand-gray-neutral text-sm">
                            No company payment data available for the selected period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: INVOICE VERIFICATION PREVIEW */}
              {activeTab === 'invoice' && (
                <div className="space-y-4">
                  <div className="m-4 bg-brand-light-green/20 border-l-4 border-brand-light-green p-3 rounded-r-[8px] text-xs text-brand-dark-green select-none flex gap-2">
                    <Info size={18} className="shrink-0 mt-0.5" />
                    <span>
                      <strong>Wizard Calculation Comparison</strong>: Compare our recorded company payments (60%) against the caterer's outsourced invoices to check for discrepancies.
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-brand-light-green bg-[#F9FAFB]/50 text-[13px] font-medium text-brand-dark-green select-none">
                          <th className="p-4">Date</th>
                          <th className="p-4 text-center">Meals Count</th>
                          <th className="p-4 text-right">Subsidy (60% Share)</th>
                          <th className="p-4" style={{ width: '200px' }}>Outsourced Invoice (ETB)</th>
                          <th className="p-4 text-right">Discrepancy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {getLocalInvoiceData().map(row => {
                          const inputVal = invoiceInputs[row.date] || '';
                          const invAmt = parseFloat(inputVal) || 0;
                          const disc = invAmt - row.compCost;
                          return (
                            <tr key={row.date} className="hover:bg-brand-light-green/5 transition-colors">
                              <td className="p-4 font-mono text-[13px] text-brand-dark-green">{row.date}</td>
                              <td className="p-4 text-center text-brand-dark-green font-semibold">{row.count}</td>
                              <td className="p-4 text-right text-brand-dark-green font-mono">{row.compCost.toFixed(2)} ETB</td>
                              <td className="p-4">
                                <div className="relative">
                                  <input
                                    type="number"
                                    placeholder="Enter amount"
                                    value={inputVal}
                                    onChange={(e) => handleInvoiceChange(row.date, e.target.value)}
                                    className="w-full h-8 px-2 border border-gray-300 rounded focus:outline-none focus:border-brand-dark-green text-xs font-mono text-brand-dark-green bg-brand-white"
                                  />
                                </div>
                              </td>
                              <td className={`p-4 text-right font-bold font-mono ${disc === 0
                                ? 'text-brand-dark-green'
                                : 'text-brand-error-red bg-brand-error-red/5'
                                }`}>
                                {disc.toFixed(2)} ETB
                              </td>
                            </tr>
                          );
                        })}
                        {getLocalInvoiceData().length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-brand-gray-neutral text-sm">
                              No invoice data available for the selected period
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};