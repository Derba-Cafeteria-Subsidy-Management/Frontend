import React, { useState, useEffect } from 'react';
import { db, type Transaction } from '../../db/db';
import { FileXls, FilePdf, Info } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

export const ReportsHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'payroll' | 'company' | 'invoice'>('payroll');
  
  // Filter States
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Default to last 30 days
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [employeeStatus, setEmployeeStatus] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Loaded Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Invoice Inputs for Invoice Tab (grouped by Date)
  const [invoiceInputs, setInvoiceInputs] = useState<Record<string, string>>({});

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Query database transactions in range
      const list = await db.transactions
        .where('timestamp')
        .between(start, end, true, true)
        .toArray();

      // Filter by Employee Status if necessary
      if (employeeStatus !== 'All') {
        const filtered = [];
        for (const t of list) {
          const emp = await db.employees.get(t.employeeId);
          if (emp && emp.status === employeeStatus) {
            filtered.push(t);
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

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate, employeeStatus]);

  // Handle invoice input edits
  const handleInvoiceChange = (dateKey: string, val: string) => {
    setInvoiceInputs(prev => ({
      ...prev,
      [dateKey]: val
    }));
  };

  // ================= CALCULATIONS & DATA MAPPING =================

  // 1. PAYROLL DEDUCTION DATA
  const getPayrollData = () => {
    const map: Record<string, { id: string; name: string; department: string; count: number; total: number }> = {};
    
    transactions.forEach(t => {
      if (!map[t.employeeId]) {
        map[t.employeeId] = {
          id: t.employeeId,
          name: t.employeeName,
          department: '', // we will fetch or fill, let's keep empty or default
          count: 0,
          total: 0
        };
      }
      map[t.employeeId].count += 1;
      map[t.employeeId].total += t.price;
    });

    return Object.values(map).map(item => ({
      ...item,
      empCost: item.total * 0.40
    }));
  };

  // 2. COMPANY PAYMENT DATA (By Department)
  const getCompanyData = () => {
    const map: Record<string, { department: string; count: number; total: number }> = {};
    
    transactions.forEach(t => {
      const dept = t.employeeId.includes('EMP') ? 'Engineering' : 'Finance'; // Fallback mapping
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

  // 3. INVOICE VERIFICATION DATA (By Date)
  const getInvoiceData = () => {
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

  // ================= REPORT EXPORTS =================

  // EXPORT EXCEL
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Derba Cafeteria Admin';
      const sheet = workbook.addWorksheet('Report');

      sheet.views = [{ showGridLines: true }];

      if (activeTab === 'payroll') {
        sheet.columns = [
          { header: 'Employee ID', key: 'id', width: 15 },
          { header: 'Employee Name', key: 'name', width: 25 },
          { header: 'Meals Count', key: 'count', width: 15 },
          { header: 'Total Value (ETB)', key: 'total', width: 20 },
          { header: 'Deduction Share (40%)', key: 'empCost', width: 25 }
        ];

        getPayrollData().forEach(row => {
          sheet.addRow({
            id: row.id,
            name: row.name,
            count: row.count,
            total: row.total,
            empCost: row.empCost
          });
        });
      } else if (activeTab === 'company') {
        sheet.columns = [
          { header: 'Department', key: 'department', width: 25 },
          { header: 'Meals Count', key: 'count', width: 15 },
          { header: 'Total Value (ETB)', key: 'total', width: 20 },
          { header: 'Company Subsidy (60%)', key: 'compCost', width: 25 }
        ];

        getCompanyData().forEach(row => {
          sheet.addRow({
            department: row.department,
            count: row.count,
            total: row.total,
            compCost: row.compCost
          });
        });
      } else {
        sheet.columns = [
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Total Meals', key: 'count', width: 15 },
          { header: 'Company Share (60%)', key: 'compCost', width: 25 },
          { header: 'Outsourced Invoice (ETB)', key: 'invoice', width: 25 },
          { header: 'Discrepancy (ETB)', key: 'discrepancy', width: 20 }
        ];

        getInvoiceData().forEach(row => {
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
        fgColor: { argb: 'FF326432' } // Brand Dark Green
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Derba_Cafeteria_${activeTab}_Report_${startDate}_to_${endDate}.xlsx`;
      link.click();

      toast.success('Excel spreadsheet generated successfully!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate Excel report');
    }
  };

  // EXPORT PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFont('Inter', 'normal');

      // Title header
      doc.setFillColor(50, 100, 50); // Brand Dark Green
      doc.rect(0, 0, 210, 30, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text('DERBA CAFETERIA SUBSIDY SYSTEM', 15, 12);
      doc.setFontSize(10);
      doc.text(`Report Type: ${activeTab.toUpperCase()} | Date Range: ${startDate} to ${endDate}`, 15, 22);

      doc.setTextColor(50, 100, 50);
      doc.setFontSize(14);
      doc.text('Report Details Preview', 15, 42);

      let currentY = 50;
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);

      if (activeTab === 'payroll') {
        // Headers
        doc.setFont('Inter', 'bold');
        doc.text('Employee ID', 15, currentY);
        doc.text('Name', 50, currentY);
        doc.text('Meals Count', 110, currentY);
        doc.text('Total Cost (ETB)', 140, currentY);
        doc.text('Deduction (40%)', 175, currentY);
        
        currentY += 6;
        doc.line(15, currentY - 3, 195, currentY - 3);
        doc.setFont('Inter', 'normal');

        getPayrollData().forEach(row => {
          doc.text(row.id, 15, currentY);
          doc.text(row.name, 50, currentY);
          doc.text(String(row.count), 110, currentY);
          doc.text(row.total.toFixed(2), 140, currentY);
          doc.text(row.empCost.toFixed(2), 175, currentY);
          currentY += 8;
        });
      } else if (activeTab === 'company') {
        doc.setFont('Inter', 'bold');
        doc.text('Department', 15, currentY);
        doc.text('Meals Count', 70, currentY);
        doc.text('Total Cost (ETB)', 110, currentY);
        doc.text('Company share (60%)', 150, currentY);

        currentY += 6;
        doc.line(15, currentY - 3, 195, currentY - 3);
        doc.setFont('Inter', 'normal');

        getCompanyData().forEach(row => {
          doc.text(row.department, 15, currentY);
          doc.text(String(row.count), 70, currentY);
          doc.text(row.total.toFixed(2), 110, currentY);
          doc.text(row.compCost.toFixed(2), 150, currentY);
          currentY += 8;
        });
      } else {
        doc.setFont('Inter', 'bold');
        doc.text('Date', 15, currentY);
        doc.text('Meals', 45, currentY);
        doc.text('Company Share (60%)', 70, currentY);
        doc.text('Outsourced Invoice', 115, currentY);
        doc.text('Discrepancy', 160, currentY);

        currentY += 6;
        doc.line(15, currentY - 3, 195, currentY - 3);
        doc.setFont('Inter', 'normal');

        getInvoiceData().forEach(row => {
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

      doc.save(`Derba_Cafeteria_${activeTab}_Report_${startDate}_to_${endDate}.pdf`);
      toast.success('PDF report saved successfully!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate PDF report');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Title */}
      <div className="flex items-center justify-between border-b border-brand-light-green/30 pb-4 select-none">
        <div>
          <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none">
            Reports Hub
          </h1>
          <p className="text-brand-gray-neutral text-sm mt-2">
            Generate payroll deductions, company payments, and verify vendor catering invoices
          </p>
        </div>
      </div>

      {/* Query Filters */}
      <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] grid grid-cols-1 md:grid-cols-3 gap-4 select-none">
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
      </div>

      {/* Tabs Layout */}
      <div className="space-y-4">
        {/* Tab Buttons */}
        <div className="flex border-b border-gray-200 select-none">
          <button
            onClick={() => setActiveTab('payroll')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'payroll'
                ? 'border-brand-gold text-brand-dark-green bg-brand-light-green/10'
                : 'border-transparent text-brand-gray-neutral hover:text-brand-dark-green'
            }`}
          >
            Payroll Deduction
          </button>
          <button
            onClick={() => setActiveTab('company')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'company'
                ? 'border-brand-gold text-brand-dark-green bg-brand-light-green/10'
                : 'border-transparent text-brand-gray-neutral hover:text-brand-dark-green'
            }`}
          >
            Company Subsidy
          </button>
          <button
            onClick={() => setActiveTab('invoice')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'invoice'
                ? 'border-brand-gold text-brand-dark-green bg-brand-light-green/10'
                : 'border-transparent text-brand-gray-neutral hover:text-brand-dark-green'
            }`}
          >
            Invoice Verification
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
        </div>

        {/* Tab Previews Container */}
        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-50 rounded animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-16 text-center select-none">
              <span className="text-brand-gray-neutral text-3xl block">📁</span>
              <p className="text-brand-gray-neutral text-xs mt-1">No transaction records found for range</p>
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
                        <th className="p-4 text-right">Deduction (40% Share)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {getPayrollData().map(row => (
                        <tr key={row.id} className="hover:bg-brand-light-green/5 transition-colors">
                          <td className="p-4 font-mono text-[13px] text-brand-dark-green">{row.id}</td>
                          <td className="p-4 font-medium text-brand-dark-green">{row.name}</td>
                          <td className="p-4 text-center text-brand-dark-green font-semibold">{row.count}</td>
                          <td className="p-4 text-right text-brand-dark-green font-mono">{row.total.toFixed(2)} ETB</td>
                          <td className="p-4 text-right text-brand-dark-green font-bold font-mono">{row.empCost.toFixed(2)} ETB</td>
                        </tr>
                      ))}
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
                        <th className="p-4 text-right">Company Cost (60% Subsidy)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {getCompanyData().map((row, idx) => (
                        <tr key={idx} className="hover:bg-brand-light-green/5 transition-colors">
                          <td className="p-4 font-semibold text-brand-dark-green">{row.department}</td>
                          <td className="p-4 text-center text-brand-dark-green font-semibold">{row.count}</td>
                          <td className="p-4 text-right text-brand-dark-green font-mono">{row.total.toFixed(2)} ETB</td>
                          <td className="p-4 text-right text-brand-dark-green font-bold font-mono">{row.compCost.toFixed(2)} ETB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: INVOICE VERIFICATION PREVIEW */}
              {activeTab === 'invoice' && (
                <div className="space-y-4">
                  
                  {/* Explanatory banner */}
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
                        {getInvoiceData().map(row => {
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
                              <td className={`p-4 text-right font-bold font-mono ${
                                disc === 0 
                                  ? 'text-brand-dark-green' 
                                  : 'text-brand-error-red bg-brand-error-red/5'
                              }`}>
                                {disc.toFixed(2)} ETB
                              </td>
                            </tr>
                          );
                        })}
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
