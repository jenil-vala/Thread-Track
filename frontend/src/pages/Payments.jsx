import React, { useState, useEffect } from 'react';
import api, { API_URL } from '../services/api';
import {
  IndianRupee,
  Search,
  PlusCircle,
  FileDown,
  Trash2,
  Calendar,
  User,
  XCircle,
  AlertCircle
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
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  
  // Filter states
  const [vendorFilter, setVendorFilter] = useState('');
  const [vendorTypeFilter, setVendorTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [vendors, setVendors] = useState([]);
  const [newPayment, setNewPayment] = useState({
    vendor_id: '',
    amount: '',
    payment_method: 'UPI',
    remarks: '',
    payment_date: ''
  });

  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pdfModal, setPdfModal] = useState({
    isOpen: false,
    url: '',
    title: '',
    filename: ''
  });

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments');
      setPayments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await api.get('/hisab');
      setVendors(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchVendors();
  }, []);

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    setFormError('');
    setActionLoading(true);

    const { vendor_id, amount, payment_method } = newPayment;
    if (!vendor_id || !amount || parseFloat(amount) <= 0) {
      setFormError('Please select a vendor and specify a valid amount.');
      setActionLoading(false);
      return;
    }

    try {
      await api.post('/payments', {
        vendor_id: parseInt(vendor_id),
        amount: parseFloat(amount),
        payment_method,
        remarks: newPayment.remarks,
        payment_date: newPayment.payment_date || undefined
      });

      setNewPayment({
        vendor_id: '',
        amount: '',
        payment_method: 'UPI',
        remarks: '',
        payment_date: ''
      });
      setIsNewModalOpen(false);
      fetchPayments();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to record payment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId, amount, vendorName) => {
    if (!window.confirm(`Are you sure you want to delete the payment of ₹${amount} made to ${vendorName}? This will increase their outstanding balance.`)) return;

    try {
      await api.delete(`/payments/${paymentId}`);
      fetchPayments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete payment.');
    }
  };

  const getPdfParamsString = () => {
    const params = new URLSearchParams();
    if (vendorFilter) params.append('vendorId', vendorFilter);
    if (vendorTypeFilter) params.append('vendorType', vendorTypeFilter);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const str = params.toString();
    return str ? `?${str}` : '';
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = search ? (
      p.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
      p.payment_method.toLowerCase().includes(search.toLowerCase()) ||
      p.amount.toString().includes(search)
    ) : true;

    const matchesVendor = vendorFilter ? p.vendor_id === parseInt(vendorFilter) : true;
    const matchesVendorType = vendorTypeFilter ? p.vendor_type === vendorTypeFilter : true;

    const paymentDate = new Date(p.payment_date);
    paymentDate.setHours(0,0,0,0);
    
    let matchesStartDate = true;
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0,0,0,0);
      matchesStartDate = paymentDate >= start;
    }
    
    let matchesEndDate = true;
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(0,0,0,0);
      matchesEndDate = paymentDate <= end;
    }

    return matchesSearch && matchesVendor && matchesVendorType && matchesStartDate && matchesEndDate;
  });

  return (
    <div className="space-y-6">
      {/* Header and search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-5 h-5" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payments by vendor name, method, amount..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium text-slate-700 bg-white"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setPdfModal({
              isOpen: true,
              url: `/pdf/payments-report${getPdfParamsString()}`,
              title: 'Payments Ledger Report',
              filename: 'payments_report.pdf'
            })}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-xl font-bold transition-all text-xs border border-slate-200 active:scale-95 shadow-sm h-[46px]"
          >
            <FileDown className="w-4 h-4" />
            <span>Export to PDF</span>
          </button>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white px-5 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-600/10 shrink-0"
          >
            <PlusCircle className="w-5 h-5" />
            <span>RECORD PAYMENT</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Vendor Name</label>
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
          >
            <option value="">All Vendors</option>
            {vendors.map(v => (
              <option key={v.vendor_id} value={v.vendor_id}>{v.vendor_name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Vendor Type</label>
          <select
            value={vendorTypeFilter}
            onChange={(e) => setVendorTypeFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
          >
            <option value="">All Types</option>
            <option value="Dyed">Dyed</option>
            <option value="Embroidery">Embroidery</option>
            <option value="Stitching">Stitching</option>
            <option value="Diamond">Diamond</option>
            <option value="Folding">Folding</option>
          </select>
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"
          />
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"
          />
        </div>

        {(vendorFilter || vendorTypeFilter || startDate || endDate) && (
          <button
            onClick={() => {
              setVendorFilter('');
              setVendorTypeFilter('');
              setStartDate('');
              setEndDate('');
            }}
            className="text-xs font-semibold text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100/70 px-4 py-2.5 rounded-xl transition-all h-[38px] active:scale-95 border border-rose-100"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <IndianRupee className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-lg font-bold text-slate-700">No payment logs found</h3>
            <p className="text-slate-400 text-sm">Add a payment to reduce outstanding balance on vendor ledgers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  <th className="px-6 py-4">Receipt ID</th>
                  <th className="px-6 py-4">Vendor Partner</th>
                  <th className="px-6 py-4">Payment Date</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Amount Paid</th>
                  <th className="px-6 py-4">Remarks</th>
                  <th className="px-6 py-4">Recorded By</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                {filteredPayments.map((p) => (
                  <tr key={p.payment_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-indigo-600 font-bold whitespace-nowrap">PAY-{p.payment_id}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span>{p.vendor_name}</span>
                        <span className="text-xs text-slate-400 font-normal">({p.vendor_type})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-normal text-slate-500 whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>
                      {formatDateDMY(p.payment_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-slate-100 rounded-full border text-xs font-bold text-slate-700">
                        {p.payment_method}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-800 whitespace-nowrap">₹{parseFloat(p.amount).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-normal max-w-[150px] truncate" title={p.remarks}>
                      {p.remarks || '-'}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-normal whitespace-nowrap">
                      {p.creator_name || 'System'}
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2 mt-1 whitespace-nowrap">
                      <button
                        onClick={() => setPdfModal({
                          isOpen: true,
                          url: `/pdf/payment-receipt/${p.payment_id}`,
                          title: `Payment Receipt — PAY-${p.payment_id}`,
                          filename: `payment_receipt_PAY_${p.payment_id}_${p.vendor_name}.pdf`
                        })}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-all font-bold"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                      </button>
                      <button
                        onClick={() => handleDeletePayment(p.payment_id, p.amount, p.vendor_name)}
                        className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-95 border border-transparent hover:border-rose-100"
                        title="Delete payment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECORD PAYMENT MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-100 animate-slide-up space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-900">Record Vendor Payment</h3>
              <button
                onClick={() => {
                  setIsNewModalOpen(false);
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

            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select Vendor</label>
                <select
                  required
                  value={newPayment.vendor_id}
                  onChange={(e) => setNewPayment(prev => ({ ...prev, vendor_id: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Vendor Partner</option>
                  {vendors.map(v => (
                    <option key={v.vendor_id} value={v.vendor_id}>
                      {v.vendor_name} ({v.vendor_type}) - Outstanding: ₹{v.pending_balance.toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
                {newPayment.vendor_id && (() => {
                  const selectedVendorObj = vendors.find(v => v.vendor_id === parseInt(newPayment.vendor_id));
                  if (!selectedVendorObj) return null;
                  return (
                    <div className="mt-2 text-xs font-bold text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center animate-fade-in">
                      <span>Outstanding Balance:</span>
                      <span className={selectedVendorObj.pending_balance > 0 ? "text-rose-600 font-extrabold" : "text-emerald-600 font-extrabold"}>
                        ₹{selectedVendorObj.pending_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Amount (₹)</label>
                <input
                  type="number"
                  required
                  step="any"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="Enter amount paid"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Method</label>
                  <select
                    value={newPayment.payment_method}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="UPI">UPI / GPay</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Date</label>
                  <input
                    type="date"
                    value={newPayment.payment_date}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, payment_date: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Remarks</label>
                <input
                  type="text"
                  value={newPayment.remarks}
                  onChange={(e) => setNewPayment(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="UPI transaction reference, check note, etc..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all text-sm"
                >
                  {actionLoading ? 'Recording...' : 'Record Payment'}
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
