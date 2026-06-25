import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  IndianRupee,
  Search,
  PlusCircle,
  FileDown,
  FileSpreadsheet,
  Trash2,
  Edit,
  Calendar,
  User,
  XCircle,
  AlertCircle,
  Printer,
  ChevronRight,
  TrendingDown,
  DollarSign,
  Briefcase,
  History,
  Filter,
  CheckCircle,
  Eye
} from 'lucide-react';
import PdfViewerModal from '../components/PdfViewerModal';

const formatDateDMY = (dateInput) => {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const Payments = () => {
  const [workRecords, setWorkRecords] = useState([]);
  const [outstandingVendors, setOutstandingVendors] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOutstandingView, setShowOutstandingView] = useState(false);
  
  // Search & Filters
  const [lotFilter, setLotFilter] = useState('');
  const [vendorNameFilter, setVendorNameFilter] = useState('');
  const [vendorTypeFilter, setVendorTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Lot-driven payment form state
  const [lotSearchText, setLotSearchText] = useState('');
  const [isLotDropdownOpen, setIsLotDropdownOpen] = useState(false);
  const [lotDropdownIndex, setLotDropdownIndex] = useState(-1);
  const [selectedLotRecord, setSelectedLotRecord] = useState(null); // the work record chosen via lot

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedRecordHistory, setSelectedRecordHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Forms data
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [newPayment, setNewPayment] = useState({
    vendor_id: '',
    history_id: '',
    amount: '',
    payment_method: 'UPI',
    remarks: '',
    payment_date: new Date().toISOString().split('T')[0],
    discount: '0',
    discount_reason: ''
  });

  const [editingPayment, setEditingPayment] = useState({
    payment_id: '',
    vendor_id: '',
    history_id: '',
    amount: '',
    payment_method: 'UPI',
    remarks: '',
    payment_date: '',
    discount: '0',
    discount_reason: ''
  });

  // PDF Viewer Modal State
  const [pdfModal, setPdfModal] = useState({
    isOpen: false,
    url: '',
    title: '',
    filename: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch work records payments
      const wrRes = await api.get('/payments/work-records');
      setWorkRecords(wrRes.data);

      // 2. Fetch outstanding vendors list
      const outRes = await api.get('/payments/outstanding-vendors');
      setOutstandingVendors(outRes.data);

      // 3. Fetch vendors list for forms selection
      const venRes = await api.get('/vendors');
      setVendors(venRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch payment/discount history for a single selected work record
  const fetchRecordHistory = async (historyId) => {
    setHistoryLoading(true);
    try {
      const res = await api.get(`/payments/history/${historyId}`);
      setSelectedRecordHistory(res.data);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSelectRecord = (record) => {
    setSelectedRecord(record);
    fetchRecordHistory(record.history_id);
  };

  const handleVendorChangeInForm = (vendorId, type = 'new') => {
    if (type === 'new') {
      setNewPayment(prev => ({
        ...prev,
        vendor_id: vendorId,
        history_id: '',
        amount: '',
        discount: '0',
        discount_reason: ''
      }));
    } else {
      setEditingPayment(prev => ({
        ...prev,
        vendor_id: vendorId,
        history_id: '',
        amount: '',
        discount: '0',
        discount_reason: ''
      }));
    }
  };

  const handleChallanChangeInForm = (historyId, type = 'new') => {
    const selectedWr = workRecords.find(r => r.history_id === parseInt(historyId));
    if (!selectedWr) return;

    if (type === 'new') {
      setNewPayment(prev => ({
        ...prev,
        history_id: historyId,
        amount: selectedWr.outstanding_amount.toString()
      }));
    } else {
      setEditingPayment(prev => ({
        ...prev,
        history_id: historyId,
        amount: selectedWr.outstanding_amount.toString()
      }));
    }
  };

  // Lot-driven: when user picks a lot/work-record from the searchable dropdown
  const handleLotSelect = (record) => {
    setSelectedLotRecord(record);
    setLotSearchText(`LOT-${record.lot_number} | ${record.challan_number} | ${record.work_stage}`);
    setIsLotDropdownOpen(false);
    setLotDropdownIndex(-1);
    setNewPayment(prev => ({
      ...prev,
      vendor_id: record.vendor_id.toString(),
      history_id: record.history_id.toString(),
      amount: record.outstanding_amount > 0 ? record.outstanding_amount.toString() : '',
      discount: '0',
      discount_reason: ''
    }));
  };

  // Build the filtered list for the lot searchable dropdown
  const getFilteredLotOptions = () => {
    if (!lotSearchText.trim()) return workRecords;
    const q = lotSearchText.toLowerCase();
    return workRecords.filter(r =>
      r.lot_number.toString().includes(q) ||
      r.challan_number.toLowerCase().includes(q) ||
      r.vendor_name.toLowerCase().includes(q) ||
      r.work_stage.toLowerCase().includes(q)
    );
  };

  // Reset lot form state
  const resetLotForm = () => {
    setLotSearchText('');
    setSelectedLotRecord(null);
    setIsLotDropdownOpen(false);
    setLotDropdownIndex(-1);
    setNewPayment({
      vendor_id: '',
      history_id: '',
      amount: '',
      payment_method: 'UPI',
      remarks: '',
      payment_date: new Date().toISOString().split('T')[0],
      discount: '0',
      discount_reason: ''
    });
  };

  const handleAmountChange = (val) => {
    setNewPayment(prev => ({
      ...prev,
      amount: val
    }));
  };

  const handleDiscountChange = (val) => {
    const disc = parseFloat(val) || 0;
    setNewPayment(prev => {
      let amt = parseFloat(prev.amount) || 0;
      if (selectedLotRecord) {
        const maxPayable = selectedLotRecord.outstanding_amount;
        amt = Math.max(0, maxPayable - disc);
      }
      return {
        ...prev,
        amount: amt.toString(),
        discount: val
      };
    });
  };

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    setFormError('');
    setActionLoading(true);

    const { vendor_id, history_id, amount, payment_method, remarks, payment_date, discount, discount_reason } = newPayment;
    
    if (!vendor_id) {
      setFormError('Please select a lot number to identify the vendor.');
      setActionLoading(false);
      return;
    }

    const amt = parseFloat(amount) || 0;
    const disc = parseFloat(discount) || 0;

    if (amt <= 0 && disc <= 0) {
      setFormError('Please enter either a paid amount or discount greater than 0.');
      setActionLoading(false);
      return;
    }

    // Overpayment validation
    if (selectedLotRecord) {
      const maxPayable = selectedLotRecord.outstanding_amount;
      if ((amt + disc) > maxPayable + 0.01) {
        setFormError(`Paid amount (₹${amt.toLocaleString('en-IN')}) + Discount (₹${disc.toLocaleString('en-IN')}) cannot exceed outstanding amount of ₹${maxPayable.toLocaleString('en-IN')}.`);
        setActionLoading(false);
        return;
      }
    }

    try {
      await api.post('/payments', {
        vendor_id: parseInt(vendor_id),
        history_id: history_id ? parseInt(history_id) : null,
        amount: amt,
        payment_method,
        remarks,
        payment_date,
        discount: disc,
        discount_reason
      });

      // Clear & Close
      setIsNewModalOpen(false);
      resetLotForm();
      
      await fetchData();
      if (selectedRecord && history_id && parseInt(history_id) === selectedRecord.history_id) {
        const updatedRecord = workRecords.find(r => r.history_id === parseInt(history_id));
        if (updatedRecord) handleSelectRecord(updatedRecord);
        else fetchRecordHistory(history_id);
      }
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to record payment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditModal = (payment) => {
    setEditingPayment({
      payment_id: payment.payment_id,
      vendor_id: payment.vendor_id,
      history_id: payment.history_id || '',
      amount: payment.amount.toString(),
      payment_method: payment.payment_method,
      remarks: payment.remarks || '',
      payment_date: payment.payment_date ? payment.payment_date.split('T')[0] : '',
      discount: (payment.discount || 0).toString(),
      discount_reason: payment.discount_reason || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditPayment = async (e) => {
    e.preventDefault();
    setFormError('');
    setActionLoading(true);

    const { payment_id, amount, payment_method, remarks, payment_date, history_id, discount, discount_reason } = editingPayment;
    const amt = parseFloat(amount) || 0;
    const disc = parseFloat(discount) || 0;

    if (amt <= 0 && disc <= 0) {
      setFormError('Please enter either a paid amount or discount greater than 0.');
      setActionLoading(false);
      return;
    }

    try {
      await api.put(`/payments/${payment_id}`, {
        amount: amt,
        payment_method,
        remarks,
        payment_date,
        history_id: history_id ? parseInt(history_id) : null,
        discount: disc,
        discount_reason
      });

      setIsEditModalOpen(false);
      await fetchData();
      if (selectedRecord) {
        fetchRecordHistory(selectedRecord.history_id);
      }
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to update payment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId, amount, discount) => {
    const totalReduction = parseFloat(amount || 0) + parseFloat(discount || 0);
    if (!window.confirm(`Are you sure you want to delete this payment transaction (Value: ₹${totalReduction.toLocaleString('en-IN')})? This action will restore outstanding balances and is written to audit logs.`)) return;

    try {
      await api.delete(`/payments/${paymentId}`);
      await fetchData();
      if (selectedRecord) {
        fetchRecordHistory(selectedRecord.history_id);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete payment.');
    }
  };

  // Filter calculations (Standard Work Records View)
  const filteredWorkRecords = workRecords.filter(r => {
    const matchesLot = lotFilter ? r.lot_number.toString().includes(lotFilter) : true;
    const matchesVendor = vendorNameFilter ? r.vendor_name.toLowerCase().includes(vendorNameFilter.toLowerCase()) : true;
    const matchesVendorType = vendorTypeFilter ? r.vendor_type === vendorTypeFilter : true;
    const matchesStatus = statusFilter ? r.payment_status === statusFilter : true;

    return matchesLot && matchesVendor && matchesVendorType && matchesStatus;
  });

  // Summary Metrics calculations (Based on overall data)
  const totalWorkCost = workRecords.reduce((sum, r) => sum + parseFloat(r.work_amount || 0), 0);
  const totalPaid = workRecords.reduce((sum, r) => sum + parseFloat(r.paid_amount || 0) + parseFloat(r.discount || 0), 0);
  const totalOutstanding = Math.max(0, totalWorkCost - totalPaid);

  // Dynamic dropdown list of completed challans for selected vendor in forms
  const getPendingChallansForVendor = (vendorId) => {
    if (!vendorId) return [];
    return workRecords.filter(r => r.vendor_id === parseInt(vendorId));
  };

  // Excel (CSV) generator
  const handleExportExcel = () => {
    let headers = [];
    let rows = [];
    let filename = '';

    if (showOutstandingView) {
      headers = ['Vendor Name', 'Vendor Type', 'Total Work Cost (Cr)', 'Total Paid/Discount (Dr)', 'Outstanding Amount', 'Last Payment Date', 'Days Outstanding'];
      rows = outstandingVendors.map(v => [
        v.vendor_name,
        v.vendor_type,
        v.total_work_amount,
        v.total_paid + (v.total_discount || 0),
        v.outstanding_amount,
        v.last_payment_date ? new Date(v.last_payment_date).toLocaleDateString('en-IN') : 'N/A',
        v.days_outstanding
      ]);
      filename = 'outstanding_vendor_balances_report.csv';
    } else {
      headers = [
        'Date', 'Lot Number', 'Challan Number', 'Vendor Name', 'Vendor Type', 
        'Work Stage', 'Work Amount', 'Discount', 'Net Amount', 'Paid Amount', 
        'Outstanding Amount', 'Payment Status'
      ];
      rows = filteredWorkRecords.map(r => [
        new Date(r.date).toLocaleDateString('en-IN'),
        r.lot_number,
        r.challan_number,
        r.vendor_name,
        r.vendor_type,
        r.work_stage,
        r.work_amount,
        r.discount,
        r.net_amount,
        r.paid_amount,
        r.outstanding_amount,
        r.payment_status
      ]);
      filename = 'vendor_payment_statement.csv';
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        if (typeof val === 'string' && val.includes(',')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val !== null && val !== undefined ? val : '';
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* 3 SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total Cost Card */}
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl p-6 shadow-md transition-all hover:scale-[1.01] hover:shadow-lg relative overflow-hidden">
          <div className="absolute right-4 bottom-4 opacity-15">
            <Briefcase className="w-24 h-24" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">Total Work Value</span>
          <h2 className="text-3xl font-extrabold mt-2">₹{totalWorkCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
          <p className="text-xs text-indigo-200 mt-2">Sum of all completed stages to date</p>
        </div>

        {/* Total Paid Card */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl p-6 shadow-md transition-all hover:scale-[1.01] hover:shadow-lg relative overflow-hidden">
          <div className="absolute right-4 bottom-4 opacity-15">
            <CheckCircle className="w-24 h-24" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Total Paid Amount</span>
          <h2 className="text-3xl font-extrabold mt-2">₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
          <p className="text-xs text-emerald-200 mt-2">Already paid + discounts adjusted</p>
        </div>

        {/* Total Outstanding Card */}
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-2xl p-6 shadow-md transition-all hover:scale-[1.01] hover:shadow-lg relative overflow-hidden">
          <div className="absolute right-4 bottom-4 opacity-15">
            <TrendingDown className="w-24 h-24" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-rose-100">Total Outstanding Amount</span>
          <h2 className="text-3xl font-extrabold mt-2">₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
          <p className="text-xs text-rose-200 mt-2">Total outstanding vendor dues pending</p>
        </div>

      </div>

      {/* SEARCH AND FILTERS (Middle Section) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Filters Group */}
        <div className="flex flex-wrap gap-4 items-end flex-1">
          <div className="w-[120px]">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1.5 tracking-wider">Lot Number</label>
            <input
              type="text"
              value={lotFilter}
              onChange={(e) => setLotFilter(e.target.value)}
              placeholder="e.g. 1001"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white"
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1.5 tracking-wider">Vendor Name</label>
            <input
              type="text"
              value={vendorNameFilter}
              onChange={(e) => setVendorNameFilter(e.target.value)}
              placeholder="Search vendor name..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white"
            />
          </div>

          <div className="w-[140px]">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1.5 tracking-wider">Vendor Type</label>
            <select
              value={vendorTypeFilter}
              onChange={(e) => setVendorTypeFilter(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700 font-bold"
            >
              <option value="">All Types</option>
              <option value="Dyed">Dyed</option>
              <option value="Dyeing/Print">Dyeing/Print</option>
              <option value="Embroidery">Embroidery</option>
              <option value="Stitching">Stitching</option>
              <option value="Diamond">Diamond</option>
              <option value="Folding">Folding</option>
            </select>
          </div>

          <div className="w-[140px]">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1.5 tracking-wider">Payment Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700 font-bold"
            >
              <option value="">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>
          </div>

          {(lotFilter || vendorNameFilter || vendorTypeFilter || statusFilter) && (
            <button
              onClick={() => {
                setLotFilter('');
                setVendorNameFilter('');
                setVendorTypeFilter('');
                setStatusFilter('');
              }}
              className="text-xs font-semibold text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100/70 px-4 py-2.5 rounded-xl transition-all h-[36px] active:scale-95 border border-rose-100"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Global Indicator */}
        <div className="text-slate-400 text-xs font-semibold shrink-0">
          Showing {showOutstandingView ? outstandingVendors.length : filteredWorkRecords.length} records
        </div>

      </div>

      {/* CORE Split screen layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* LEFT COLUMN: Main payments & liabilities table (takes 3 cols on lg) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          
          {/* Header & Tabs */}
          <div className="border-b border-slate-100 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setShowOutstandingView(false); setSelectedRecord(null); }}
                className={`text-sm font-bold pb-1.5 transition-all relative ${!showOutstandingView ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Lot-wise Payment Ledger
              </button>
              <button
                onClick={() => { setShowOutstandingView(true); setSelectedRecord(null); }}
                className={`text-sm font-bold pb-1.5 transition-all relative ${showOutstandingView ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Outstanding Balances View
              </button>
            </div>
            <div className="text-xs text-slate-400 font-semibold">
              * Click a row to load detailed payment & discount histories
            </div>
          </div>

          {loading ? (
            <div className="flex-grow flex items-center justify-center min-h-[300px]">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="overflow-x-auto flex-grow">
              
              {!showOutstandingView ? (
                /* VIEW 1: LOT-WISE PAYMENT TABLE */
                filteredWorkRecords.length === 0 ? (
                  <div className="text-center py-20 space-y-3">
                    <IndianRupee className="w-12 h-12 text-slate-300 mx-auto" />
                    <h3 className="text-lg font-bold text-slate-700">No work records found</h3>
                    <p className="text-slate-400 text-sm">Enter search details or receive finished sarees from vendors to generate work sheets.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        <th className="px-6 py-4">Challan No</th>
                        <th className="px-6 py-4">Vendor Partner</th>
                        <th className="px-6 py-4">Work Stage</th>
                        <th className="px-6 py-4 text-right">Work Amt</th>
                        <th className="px-6 py-4 text-right">Discount</th>
                        <th className="px-6 py-4 text-right">Net Amt</th>
                        <th className="px-6 py-4 text-right">Paid Amt</th>
                        <th className="px-6 py-4 text-right">Outstanding</th>
                        <th className="px-6 py-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                      {filteredWorkRecords.map((r) => {
                        const isSelected = selectedRecord?.history_id === r.history_id;
                        return (
                          <tr 
                            key={r.history_id} 
                            onClick={() => handleSelectRecord(r)}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'hover:bg-slate-50/50'}`}
                          >
                            <td className="px-6 py-4 text-indigo-600 font-bold whitespace-nowrap">CH-{r.challan_number}</td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{r.vendor_name}</span>
                                <span className="text-[10px] text-slate-400 font-normal">({r.vendor_type})</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 bg-slate-100 border text-slate-600 rounded font-bold text-[10px]">{r.work_stage}</span>
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap text-slate-800">₹{r.work_amount.toLocaleString('en-IN')}</td>
                            <td className="px-6 py-4 text-right whitespace-nowrap text-amber-600">
                              {r.discount > 0 ? `₹${r.discount.toLocaleString('en-IN')}` : '-'}
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap text-slate-800 font-bold">₹{r.net_amount.toLocaleString('en-IN')}</td>
                            <td className="px-6 py-4 text-right whitespace-nowrap text-emerald-600">₹{r.paid_amount.toLocaleString('en-IN')}</td>
                            <td className={`px-6 py-4 text-right whitespace-nowrap font-black ${r.outstanding_amount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                              ₹{r.outstanding_amount.toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                                r.payment_status === 'Paid' 
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                  : r.payment_status === 'Partially Paid'
                                  ? 'bg-amber-50 text-amber-600 border-amber-100'
                                  : 'bg-rose-50 text-rose-600 border-rose-100'
                              }`}>
                                {r.payment_status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              ) : (
                /* VIEW 2: OUTSTANDING BALANCES VIEW */
                outstandingVendors.length === 0 ? (
                  <div className="text-center py-20 space-y-3">
                    <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                    <h3 className="text-lg font-bold text-slate-700">Perfect! Zero Outstanding Dues</h3>
                    <p className="text-slate-400 text-sm">All vendor bills have been fully paid off.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        <th className="px-6 py-4">Vendor Name</th>
                        <th className="px-6 py-4">Vendor Type</th>
                        <th className="px-6 py-4 text-right">Total Work Costs</th>
                        <th className="px-6 py-4 text-right">Total Settled (Paid+Disc)</th>
                        <th className="px-6 py-4 text-right">Outstanding Dues</th>
                        <th className="px-6 py-4">Last Payment Date</th>
                        <th className="px-6 py-4 text-center">Aging Period</th>
                        <th className="px-6 py-4 text-right">Print</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                      {outstandingVendors.map((v) => (
                        <tr key={v.vendor_id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800">{v.vendor_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-slate-100 border text-slate-600 rounded font-bold text-[10px]">{v.vendor_type}</span>
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap text-slate-800">₹{v.total_work_amount.toLocaleString('en-IN')}</td>
                          <td className="px-6 py-4 text-right whitespace-nowrap text-emerald-600">₹{(v.total_paid + (v.total_discount || 0)).toLocaleString('en-IN')}</td>
                          <td className="px-6 py-4 text-right whitespace-nowrap text-rose-600 font-extrabold text-sm">₹{v.outstanding_amount.toLocaleString('en-IN')}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-normal">
                            {formatDateDMY(v.last_payment_date)}
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded font-black text-[10px] border ${
                              v.days_outstanding > 30 
                                ? 'bg-rose-50 text-rose-600 border-rose-100' 
                                : v.days_outstanding > 15
                                ? 'bg-amber-50 text-amber-600 border-amber-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {v.days_outstanding} days
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => setPdfModal({
                                isOpen: true,
                                url: `/pdf/vendor-statement/${v.vendor_id}`,
                                title: `Vendor Ledger Statement - ${v.vendor_name}`,
                                filename: `vendor_statement_${v.vendor_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
                              })}
                              className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-all font-bold"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Statement</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Sidebar Quick Actions (1 col on lg) */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Actions card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">QUICK OPERATIONS</h4>
            
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="w-full flex items-center justify-between bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-3 rounded-xl transition-all active:scale-[0.98] shadow-md shadow-indigo-600/10"
            >
              <div className="flex items-center gap-2 text-xs">
                <PlusCircle className="w-4 h-4" />
                <span>RECORD PAYMENT</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                const params = new URLSearchParams();
                if (vendorNameFilter) params.append('vendorName', vendorNameFilter);
                if (vendorTypeFilter) params.append('vendorType', vendorTypeFilter);
                
                setPdfModal({
                  isOpen: true,
                  url: `/pdf/payments-ledger-statement?${params.toString()}`,
                  title: 'Payments Ledger Statement PDF',
                  filename: 'vendor_payment_statement.pdf'
                });
              }}
              className="w-full flex items-center justify-between bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-all active:scale-[0.98] text-xs border border-slate-200"
            >
              <div className="flex items-center gap-2">
                <FileDown className="w-4 h-4 text-slate-500" />
                <span>EXPORT TO PDF</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={handleExportExcel}
              className="w-full flex items-center justify-between bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-all active:scale-[0.98] text-xs border border-slate-200"
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>EXPORT TO EXCEL</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => {
                setPdfModal({
                  isOpen: true,
                  url: `/pdf/outstanding-report`,
                  title: 'Outstanding Liabilities Report',
                  filename: 'outstanding_report.pdf'
                });
              }}
              className="w-full flex items-center justify-between bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-all active:scale-[0.98] text-xs border border-slate-200"
            >
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-rose-500" />
                <span>OUTSTANDING REPORT</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Detailed Transaction Drawer (if selected) */}
          {selectedRecord && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-slide-up">
              
              {/* Header */}
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">CH-{selectedRecord.challan_number}</h4>
                </div>
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              {/* Work details summary */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/30 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-semibold">Vendor:</span>
                  <span className="font-bold text-slate-700">{selectedRecord.vendor_name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-semibold">Stage Name:</span>
                  <span className="font-bold text-slate-700">{selectedRecord.work_stage}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-semibold">Work Amount:</span>
                  <span className="font-extrabold text-slate-800">₹{selectedRecord.work_amount.toLocaleString('en-IN')}</span>
                </div>
                
                {/* Progress bar */}
                <div className="pt-2">
                  <div className="flex justify-between text-[10px] font-black text-slate-400 mb-1">
                    <span>PROGRESS SUMMARY</span>
                    <span>{Math.round(((selectedRecord.paid_amount + selectedRecord.discount) / selectedRecord.work_amount) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 rounded-full" 
                      style={{ width: `${Math.min(100, ((selectedRecord.paid_amount + selectedRecord.discount) / selectedRecord.work_amount) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Transactions log list */}
              <div className="p-5 space-y-3 max-h-[300px] overflow-y-auto">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TRANSACTION RECORDS</h5>

                {historyLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : selectedRecordHistory.length === 0 ? (
                  <p className="text-[11px] font-semibold text-slate-400 text-center py-4">No payments recorded against this challan yet.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedRecordHistory.map(p => (
                      <div key={p.payment_id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-semibold text-slate-600 space-y-2 relative group hover:border-slate-200 transition-colors">
                        
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">PAY-{p.payment_id}</span>
                          <span className="text-[10px] font-normal text-slate-400">{formatDateDMY(p.payment_date)}</span>
                        </div>

                        {parseFloat(p.amount) > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-bold">Paid:</span>
                            <span className="font-extrabold text-emerald-600">₹{p.amount.toLocaleString('en-IN')} ({p.payment_method})</span>
                          </div>
                        )}

                        {parseFloat(p.discount) > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500 font-bold">Discount:</span>
                              <span className="font-extrabold text-amber-600">₹{p.discount.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="text-[10px] font-normal text-slate-400 italic">
                              Reason: {p.discount_reason || 'N/A'}
                            </div>
                          </div>
                        )}

                        {p.remarks && (
                          <div className="text-[10px] font-normal text-slate-400">
                            Note: {p.remarks}
                          </div>
                        )}

                        <div className="text-[9px] font-normal text-slate-400 flex justify-between items-center border-t border-slate-100 pt-1.5 mt-1.5">
                          <span>Recorded by: {p.creator_name || 'System'}</span>
                          
                          {/* Hover edit/delete actions */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="p-1 rounded text-indigo-600 hover:bg-indigo-50"
                              title="Edit payment"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePayment(p.payment_id, p.amount, p.discount)}
                              className="p-1 rounded text-rose-500 hover:bg-rose-50"
                              title="Delete payment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

      </div>

      {/* RECORD PAYMENT MODAL (ADD) — Lot-first workflow */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 border border-slate-100 animate-slide-up space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-black text-slate-800">Record Vendor Payment</h3>
              <button
                onClick={() => {
                  setIsNewModalOpen(false);
                  setFormError('');
                  resetLotForm();
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 bg-rose-50 border-l-4 border-rose-500 text-rose-800 rounded-r-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="text-sm font-medium">{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePayment} className="space-y-4">
              
              {/* ===== STEP 1: Searchable Lot Number Dropdown ===== */}
              <div className="relative">
                <label className="block text-xs font-bold text-indigo-600 uppercase mb-2 tracking-wider">① Select Lot Number</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={lotSearchText}
                    onChange={(e) => {
                      setLotSearchText(e.target.value);
                      setIsLotDropdownOpen(true);
                      setLotDropdownIndex(-1);
                      // If user clears or changes text, deselect
                      if (selectedLotRecord) {
                        setSelectedLotRecord(null);
                        setNewPayment(prev => ({ ...prev, vendor_id: '', history_id: '', amount: '', discount: '0', discount_reason: '' }));
                      }
                    }}
                    onFocus={() => setIsLotDropdownOpen(true)}
                    onKeyDown={(e) => {
                      const opts = getFilteredLotOptions();
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setLotDropdownIndex(prev => Math.min(prev + 1, opts.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setLotDropdownIndex(prev => Math.max(prev - 1, 0));
                      } else if (e.key === 'Enter' && lotDropdownIndex >= 0 && opts[lotDropdownIndex]) {
                        e.preventDefault();
                        handleLotSelect(opts[lotDropdownIndex]);
                      } else if (e.key === 'Escape') {
                        setIsLotDropdownOpen(false);
                      }
                    }}
                    placeholder="Type lot number, design, vendor or stage to search..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 text-sm font-semibold text-slate-700 bg-indigo-50/30 placeholder:text-slate-400"
                    autoComplete="off"
                  />
                </div>

                {/* Dropdown results */}
                {isLotDropdownOpen && !selectedLotRecord && (
                  <div className="absolute z-20 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-[220px] overflow-y-auto animate-fade-in">
                    {getFilteredLotOptions().length === 0 ? (
                      <div className="px-4 py-6 text-center text-slate-400 text-xs font-semibold">No matching lots found</div>
                    ) : (
                      getFilteredLotOptions().map((r, idx) => (
                        <button
                          key={r.history_id}
                          type="button"
                          onClick={() => handleLotSelect(r)}
                          onMouseEnter={() => setLotDropdownIndex(idx)}
                          className={`w-full text-left px-4 py-2.5 flex items-center justify-between border-b border-slate-50 last:border-0 transition-colors ${
                            idx === lotDropdownIndex ? 'bg-indigo-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800">
                              LOT-{r.lot_number} <span className="text-slate-400 font-normal">|</span> CH-{r.challan_number} <span className="text-slate-400 font-normal">|</span> <span className="text-indigo-600">{r.work_stage}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal mt-0.5">
                              {r.vendor_name} ({r.vendor_type})
                            </span>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              r.payment_status === 'Paid'
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                : r.payment_status === 'Partially Paid'
                                ? 'bg-amber-50 text-amber-600 border-amber-100'
                                : 'bg-rose-50 text-rose-600 border-rose-100'
                            }`}>
                              {r.payment_status}
                            </span>
                            <div className="text-[10px] font-bold text-slate-500 mt-0.5">₹{r.outstanding_amount.toLocaleString('en-IN')} due</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Click-away listener */}
                {isLotDropdownOpen && (
                  <div className="fixed inset-0 z-10" onClick={() => setIsLotDropdownOpen(false)} />
                )}
              </div>

              {/* ===== AUTO-DISPLAY: Read-only lot info after selection ===== */}
              {selectedLotRecord && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2.5 animate-fade-in">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">LOT DETAILS (AUTO-FILLED)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Lot Number:</span>
                      <span className="font-bold text-slate-700">LOT-{selectedLotRecord.lot_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Challan No:</span>
                      <span className="font-bold text-slate-700">CH-{selectedLotRecord.challan_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Current Stage:</span>
                      <span className="font-bold text-indigo-600">{selectedLotRecord.work_stage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Vendor Type:</span>
                      <span className="font-bold text-slate-700">{selectedLotRecord.vendor_type}</span>
                    </div>
                    <div className="col-span-2 flex justify-between">
                      <span className="text-slate-400 font-semibold">Vendor Name:</span>
                      <span className="font-bold text-slate-800">{selectedLotRecord.vendor_name}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-2 mt-1 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                      <div className="text-[9px] font-bold text-slate-400 uppercase">Work Cost</div>
                      <div className="font-black text-slate-800 text-sm">₹{selectedLotRecord.work_amount.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-100 text-center">
                      <div className="text-[9px] font-bold text-emerald-500 uppercase">Already Paid</div>
                      <div className="font-black text-emerald-600 text-sm">₹{selectedLotRecord.paid_amount.toLocaleString('en-IN')}</div>
                    </div>
                    <div className={`p-2 rounded-lg border text-center ${selectedLotRecord.outstanding_amount > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                      <div className={`text-[9px] font-bold uppercase ${selectedLotRecord.outstanding_amount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>Outstanding</div>
                      <div className={`font-black text-sm ${selectedLotRecord.outstanding_amount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>₹{selectedLotRecord.outstanding_amount.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== STEP 2: Paid Amount ===== */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Paid Amount (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={newPayment.amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-lg"
                />
                {/* Live overpayment warning */}
                {selectedLotRecord && (parseFloat(newPayment.amount) || 0) + (parseFloat(newPayment.discount) || 0) > selectedLotRecord.outstanding_amount && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1.5 animate-fade-in flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Paid amount cannot be greater than outstanding amount (₹{selectedLotRecord.outstanding_amount.toLocaleString('en-IN')}).
                  </p>
                )}
              </div>

              {/* ===== STEP 3: Discount ===== */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Discount (₹) <span className="text-slate-400 normal-case font-normal">— optional</span></label>
                <input
                  type="number"
                  step="any"
                  value={newPayment.discount}
                  onChange={(e) => handleDiscountChange(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold text-amber-600 bg-amber-50/20"
                />
              </div>

              {/* Discount Reason (conditional) */}
              {parseFloat(newPayment.discount) > 0 && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-bold text-amber-600 uppercase mb-2">Discount Reason</label>
                  <input
                    type="text"
                    required
                    value={newPayment.discount_reason}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, discount_reason: e.target.value }))}
                    placeholder="e.g. Rounding off / damaged fabrics balance adjustment..."
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  />
                </div>
              )}

              {/* ===== STEP 4: Payment Method ===== */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Method</label>
                <select
                  value={newPayment.payment_method}
                  onChange={(e) => setNewPayment(prev => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              {/* ===== STEP 5: Payment Date ===== */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Date</label>
                <input
                  type="date"
                  required
                  value={newPayment.payment_date}
                  onChange={(e) => setNewPayment(prev => ({ ...prev, payment_date: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 font-semibold text-sm"
                />
              </div>

              {/* ===== STEP 6: Remarks ===== */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Remarks</label>
                <input
                  type="text"
                  value={newPayment.remarks}
                  onChange={(e) => setNewPayment(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Txn ID, Cheque number, reference note, etc..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              {/* ===== STEP 7: Actions ===== */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsNewModalOpen(false); resetLotForm(); }}
                  className="px-5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || (selectedLotRecord && (parseFloat(newPayment.amount) || 0) + (parseFloat(newPayment.discount) || 0) > selectedLotRecord.outstanding_amount)}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all text-xs"
                >
                  {actionLoading ? 'Recording...' : 'Record Payment'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* EDIT PAYMENT/DISCOUNT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-100 animate-slide-up space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-black text-slate-800">Edit Payment Details</h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setFormError('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {formError && (
              <div className="p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-800 rounded-r-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="text-sm font-medium">{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditPayment} className="space-y-4">
              
              {/* Amounts edit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Paid Amount (₹)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingPayment.amount}
                    onChange={(e) => setEditingPayment(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Discount (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={editingPayment.discount}
                    onChange={(e) => setEditingPayment(prev => ({ ...prev, discount: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-amber-600 bg-amber-50/10 border-amber-100"
                  />
                </div>
              </div>

              {/* Discount Reason */}
              {parseFloat(editingPayment.discount) > 0 && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 text-amber-600 font-bold">Discount Reason</label>
                  <input
                    type="text"
                    required
                    value={editingPayment.discount_reason}
                    onChange={(e) => setEditingPayment(prev => ({ ...prev, discount_reason: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold"
                  />
                </div>
              )}

              {/* Method and Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Method</label>
                  <select
                    value={editingPayment.payment_method}
                    onChange={(e) => setEditingPayment(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 text-sm"
                  >
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={editingPayment.payment_date}
                    onChange={(e) => setEditingPayment(prev => ({ ...prev, payment_date: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 font-semibold text-xs"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Remarks</label>
                <input
                  type="text"
                  value={editingPayment.remarks}
                  onChange={(e) => setEditingPayment(prev => ({ ...prev, remarks: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all text-xs"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* PDF Document Viewer Modal */}
      <PdfViewerModal
        isOpen={pdfModal.isOpen}
        onClose={() => setPdfModal(prev => ({ ...prev, isOpen: false }))}
        pdfUrl={pdfModal.url}
        title={pdfModal.title}
        filename={pdfModal.filename}
      />

    </div>
  );
};

export default Payments;
