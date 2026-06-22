import React, { useState, useEffect } from 'react';
import api, { API_URL } from '../services/api';
import {
  Users,
  Search,
  PlusCircle,
  Eye,
  FileDown,
  Phone,
  MapPin,
  FileText,
  IndianRupee,
  Calendar,
  XCircle,
  CheckCircle,
  Plus,
  AlertCircle,
  Edit,
  Trash2
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

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Filter states
  const [vendorFilter, setVendorFilter] = useState('');
  const [vendorTypeFilter, setVendorTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Edit Vendor Form
  const [editVendor, setEditVendor] = useState({
    vendor_id: '',
    vendor_name: '',
    vendor_type: 'Dyed',
    mobile: '',
    address: '',
    gst_number: '',
    notes: ''
  });

  // New Vendor Form
  const [newVendor, setNewVendor] = useState({
    vendor_name: '',
    vendor_type: 'Dyed',
    mobile: '',
    address: '',
    gst_number: '',
    notes: ''
  });

  // Direct Payment Form
  const [paymentForm, setPaymentForm] = useState({
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

  const fetchVendorsSummary = async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.get('/hisab', { params });
      setVendors(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendorsSummary();
  }, [startDate, endDate]);

  const handleOpenLedger = async (vendorId) => {
    try {
      const res = await api.get(`/hisab/vendors/${vendorId}`);
      setSelectedVendor(res.data);
      setIsLedgerOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshLedger = async () => {
    if (!selectedVendor) return;
    await handleOpenLedger(selectedVendor.vendor.vendor_id);
    fetchVendorsSummary();
  };

  // Submit New Vendor
  const handleCreateVendor = async (e) => {
    e.preventDefault();
    setFormError('');
    setActionLoading(true);

    const { vendor_name, vendor_type, mobile } = newVendor;
    if (!vendor_name || !vendor_type || !mobile) {
      setFormError('Please enter name, type, and mobile number.');
      setActionLoading(false);
      return;
    }

    try {
      await api.post('/vendors', newVendor);
      setNewVendor({
        vendor_name: '',
        vendor_type: 'Dyed',
        mobile: '',
        address: '',
        gst_number: '',
        notes: ''
      });
      setIsNewModalOpen(false);
      fetchVendorsSummary();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create vendor.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Direct Payment
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setFormError('');
    setActionLoading(true);

    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      setFormError('Please enter a valid payment amount.');
      setActionLoading(false);
      return;
    }

    try {
      await api.post('/payments', {
        vendor_id: selectedVendor.vendor.vendor_id,
        amount: parseFloat(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        remarks: paymentForm.remarks,
        payment_date: paymentForm.payment_date || undefined
      });

      setPaymentForm({
        amount: '',
        payment_method: 'UPI',
        remarks: '',
        payment_date: ''
      });
      setIsPaymentModalOpen(false);
      await refreshLedger();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to record payment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditModal = (vendor) => {
    setEditVendor({
      vendor_id: vendor.vendor_id,
      vendor_name: vendor.vendor_name,
      vendor_type: vendor.vendor_type,
      mobile: vendor.mobile,
      address: vendor.address || '',
      gst_number: vendor.gst_number || '',
      notes: vendor.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateVendor = async (e) => {
    e.preventDefault();
    setFormError('');
    setActionLoading(true);

    const { vendor_name, vendor_type, mobile } = editVendor;
    if (!vendor_name || !vendor_type || !mobile) {
      setFormError('Please enter name, type, and mobile number.');
      setActionLoading(false);
      return;
    }

    try {
      await api.put(`/vendors/${editVendor.vendor_id}`, editVendor);
      setIsEditModalOpen(false);
      fetchVendorsSummary();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to update vendor.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteVendor = async (vendorId, vendorName) => {
    if (!window.confirm(`Are you sure you want to delete vendor "${vendorName}"?`)) {
      return;
    }

    setActionLoading(true);
    try {
      await api.delete(`/vendors/${vendorId}`);
      fetchVendorsSummary();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete vendor.');
    } finally {
      setActionLoading(false);
    }
  };

  const getFilteredLedger = () => {
    if (!selectedVendor || !selectedVendor.ledger) return [];
    return selectedVendor.ledger.filter(item => {
      const itemDate = new Date(item.date);
      itemDate.setHours(0,0,0,0);
      
      let matchesStart = true;
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        matchesStart = itemDate >= start;
      }
      
      let matchesEnd = true;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(0,0,0,0);
        matchesEnd = itemDate <= end;
      }
      
      return matchesStart && matchesEnd;
    });
  };

  const filteredLedger = getFilteredLedger();

  const getFilteredLedgerSummary = () => {
    if (!selectedVendor) return { total_work: 0, total_paid: 0, pending_balance: 0 };
    const workItems = filteredLedger.filter(item => item.type === 'work');
    const paymentItems = filteredLedger.filter(item => item.type === 'payment');
    
    const total_work = workItems.reduce((sum, item) => sum + item.amount, 0);
    const total_paid = paymentItems.reduce((sum, item) => sum + item.amount, 0);
    const pending_balance = total_work - total_paid;

    return { total_work, total_paid, pending_balance };
  };

  const filteredSummary = getFilteredLedgerSummary();

  const filteredVendors = vendors.filter(v => {
    const matchesSearch = search ? (
      v.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
      v.vendor_type.toLowerCase().includes(search.toLowerCase()) ||
      v.mobile.includes(search)
    ) : true;

    const matchesVendor = vendorFilter ? v.vendor_id === parseInt(vendorFilter) : true;
    const matchesVendorType = vendorTypeFilter ? v.vendor_type === vendorTypeFilter : true;

    return matchesSearch && matchesVendor && matchesVendorType;
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-5 h-5" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor name, type, mobile..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium text-slate-700 bg-white"
          />
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white px-5 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-600/10 shrink-0"
        >
          <PlusCircle className="w-5 h-5" />
          <span>ADD NEW VENDOR</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-4 items-end animate-fade-in">
        <div className="flex-grow md:flex-1 min-w-[200px]">
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

        <div className="flex-grow md:flex-1 min-w-[150px]">
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

        <div className="flex-grow md:flex-1 min-w-[140px]">
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 bg-white"
          />
        </div>

        <div className="flex-grow md:flex-1 min-w-[140px]">
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 bg-white"
          />
        </div>

        <button
          onClick={() => {
            setVendorFilter('');
            setVendorTypeFilter('');
            setStartDate('');
            setEndDate('');
          }}
          className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all h-[38px] active:scale-95 whitespace-nowrap"
        >
          Reset Filters
        </button>
      </div>

      {/* Vendors Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Users className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-lg font-bold text-slate-700">No vendors found</h3>
            <p className="text-slate-400 text-sm">Add your job work partners to track outstanding ledgers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  <th className="px-6 py-4">Vendor Name</th>
                  <th className="px-6 py-4">Vendor Type</th>
                  <th className="px-6 py-4">Mobile</th>
                  <th className="px-6 py-4">Sarees Work Status</th>
                  <th className="px-6 py-4">Work Total (Completed)</th>
                  <th className="px-6 py-4">Paid Total</th>
                  <th className="px-6 py-4">Pending (Hisab)</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.vendor_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800 whitespace-nowrap">{vendor.vendor_name}</td>
                    <td className="px-6 py-4 text-indigo-600 whitespace-nowrap">{vendor.vendor_type}</td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{vendor.mobile}</td>
                    <td className="px-6 py-4 text-xs font-bold whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
                          {vendor.completed_sarees_count} completed
                        </span>
                        {vendor.pending_sarees_count > 0 && (
                          <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full w-fit">
                            {vendor.pending_sarees_count} pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{vendor.total_work.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{vendor.total_paid.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 font-bold whitespace-nowrap">
                      <span className={vendor.pending_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        ₹{vendor.pending_balance.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenLedger(vendor.vendor_id)}
                        className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 active:scale-95 text-slate-700 px-3 py-2 rounded-lg transition-all text-xs font-bold"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ledger (Hisab)</span>
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(vendor)}
                        className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 active:scale-95 text-indigo-700 px-3 py-2 rounded-lg transition-all text-xs font-bold"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteVendor(vendor.vendor_id, vendor.vendor_name)}
                        className="inline-flex items-center gap-1 bg-rose-50 border border-rose-100 hover:bg-rose-100 active:scale-95 text-rose-600 px-3 py-2 rounded-lg transition-all text-xs font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE VENDOR MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-8 border border-slate-100 animate-slide-up space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-900">Add New Vendor Partner</h3>
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

            <form onSubmit={handleCreateVendor} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Vendor Name</label>
                  <input
                    type="text"
                    required
                    value={newVendor.vendor_name}
                    onChange={(e) => setNewVendor(prev => ({ ...prev, vendor_name: e.target.value }))}
                    placeholder="Enter vendor shop name"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Vendor Type</label>
                  <select
                    required
                    value={newVendor.vendor_type}
                    onChange={(e) => setNewVendor(prev => ({ ...prev, vendor_type: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="Dyed">Dyed</option>
                    <option value="Embroidery">Embroidery</option>
                    <option value="Stitching">Stitching</option>
                    <option value="Diamond">Diamond</option>
                    <option value="Folding">Folding</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mobile Number</label>
                <input
                  type="tel"
                  required
                  value={newVendor.mobile}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, mobile: e.target.value }))}
                  placeholder="10-digit number"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={newVendor.gst_number}
                    onChange={(e) => setNewVendor(prev => ({ ...prev, gst_number: e.target.value }))}
                    placeholder="22AAAAA0000A1Z5"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Address</label>
                  <input
                    type="text"
                    value={newVendor.address}
                    onChange={(e) => setNewVendor(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Vendor shop address"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Notes</label>
                <textarea
                  value={newVendor.notes}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Payment details, terms, rates, etc."
                  rows="2"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                ></textarea>
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
                  {actionLoading ? 'Saving...' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VENDOR DETAILED LEDGER (HISAB) MODAL */}
      {isLedgerOpen && selectedVendor && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-8 border border-slate-100 animate-slide-up space-y-6">
            
            {/* Header section with contact detail cards */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-6">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">{selectedVendor.vendor.vendor_name}</h3>
                <div className="flex flex-wrap gap-4 mt-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span className="text-indigo-600">{selectedVendor.vendor.vendor_type} Vendor</span>
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {selectedVendor.vendor.mobile}</span>
                  {selectedVendor.vendor.address && (
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {selectedVendor.vendor.address}</span>
                  )}
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all text-xs shadow-md shadow-indigo-600/10 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Record Payment</span>
                </button>
                
                <button
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (startDate) params.append('startDate', startDate);
                    if (endDate) params.append('endDate', endDate);
                    const q = params.toString() ? `?${params.toString()}` : '';
                    setPdfModal({
                      isOpen: true,
                      url: `/pdf/vendor-invoice/${selectedVendor.vendor.vendor_id}${q}`,
                      title: `Vendor Hisab Statement — ${selectedVendor.vendor.vendor_name}`,
                      filename: `vendor_statement_${selectedVendor.vendor.vendor_name.replace(/\s+/g, '_')}.pdf`
                    });
                  }}
                  className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold transition-all text-xs border border-slate-200 active:scale-95 shadow-sm"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Statement PDF</span>
                </button>

                <button
                  onClick={() => {
                    setIsLedgerOpen(false);
                    setSelectedVendor(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all ml-2"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Vendor balance stats cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed Work Earnings</span>
                <p className="text-2xl font-black text-slate-800 mt-2">
                  ₹{filteredSummary.total_work.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Amount Paid</span>
                <p className="text-2xl font-black text-slate-800 mt-2">
                  ₹{filteredSummary.total_paid.toLocaleString('en-IN')}
                </p>
              </div>
              <div className={`p-5 rounded-2xl border ${filteredSummary.pending_balance > 0 ? 'bg-rose-50 border-rose-100 text-rose-900' : 'bg-emerald-50 border-emerald-100 text-emerald-900'}`}>
                <span className="text-xs font-bold uppercase tracking-wider opacity-70">Net Outstanding (Payable)</span>
                <p className="text-2xl font-black mt-2">
                  ₹{filteredSummary.pending_balance.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Detailed chronological ledger */}
            <div className="space-y-4">
              <h4 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <span>Account Statement Ledger</span>
              </h4>

              <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                {filteredLedger.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 font-medium">
                    No transactions recorded on this partner.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        <th className="px-6 py-3.5">Date</th>
                        <th className="px-6 py-3.5">Transaction Details</th>
                        <th className="px-6 py-3.5 text-right">Work (Cr)</th>
                        <th className="px-6 py-3.5 text-right">Paid (Dr)</th>
                        <th className="px-6 py-3.5 text-right">Running Balance</th>
                        <th className="px-6 py-3.5 text-right">Receipt / Slip</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {filteredLedger.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/20">
                          <td className="px-6 py-3.5 text-xs text-slate-400 whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>
                            {formatDateDMY(item.date)}
                          </td>
                          <td className="px-6 py-3.5 text-slate-800">
                            <div className="flex flex-col">
                              <span>{item.description}</span>
                              {item.remarks && <span className="text-xs text-slate-400 font-normal">Notes: {item.remarks}</span>}
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-right font-bold text-slate-700 whitespace-nowrap">
                            {item.type === 'work' ? `₹${item.amount.toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="px-6 py-3.5 text-right font-bold text-slate-700 whitespace-nowrap">
                            {item.type === 'payment' ? `₹${item.amount.toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="px-6 py-3.5 text-right font-bold text-indigo-600 whitespace-nowrap">
                            ₹{item.running_balance.toLocaleString('en-IN')}
                          </td>
                          <td className="px-6 py-3.5 text-right whitespace-nowrap">
                            {item.type === 'payment' ? (
                              <button
                                onClick={() => setPdfModal({
                                  isOpen: true,
                                  url: `/pdf/payment-receipt/${item.id.replace('payment_', '')}`,
                                  title: `Payment Receipt — PAY-${item.id.replace('payment_', '')}`,
                                  filename: `payment_receipt_${item.id}.pdf`
                                })}
                                className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-all font-bold"
                              >
                                <FileDown className="w-3 h-3" />
                                <span>Receipt</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setPdfModal({
                                  isOpen: true,
                                  url: `/pdf/job-work-slip/${item.id.replace('work_', '')}`,
                                  title: `Job Work Slip — Slip #${item.id.replace('work_', '')}`,
                                  filename: `job_work_slip_${item.id}.pdf`
                                })}
                                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-all font-bold"
                              >
                                <FileDown className="w-3 h-3" />
                                <span>Slip</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setIsLedgerOpen(false);
                  setSelectedVendor(null);
                }}
                className="px-5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-sm"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL (DIRECT OR FROM LEDGER) */}
      {isPaymentModalOpen && selectedVendor && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-100 animate-slide-up space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Record Vendor Payment</h3>
                <p className="text-xs font-semibold text-slate-400 uppercase mt-0.5">Pay to: {selectedVendor.vendor.vendor_name}</p>
              </div>
              <button
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setFormError('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-800 rounded-r-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold">{formError}</span>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Amount to Pay (₹)</label>
                <input
                  type="number"
                  required
                  step="any"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="e.g. 5000"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Method</label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_method: e.target.value }))}
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
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Remarks</label>
                <input
                  type="text"
                  value={paymentForm.remarks}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Cheque number or UPI transaction id..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all text-xs"
                >
                  {actionLoading ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* EDIT VENDOR MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-8 border border-slate-100 animate-slide-up space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-900">Edit Vendor Partner</h3>
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

            <form onSubmit={handleUpdateVendor} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Vendor Name</label>
                  <input
                    type="text"
                    required
                    value={editVendor.vendor_name}
                    onChange={(e) => setEditVendor(prev => ({ ...prev, vendor_name: e.target.value }))}
                    placeholder="Enter vendor shop name"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Vendor Type</label>
                  <select
                    required
                    value={editVendor.vendor_type}
                    onChange={(e) => setEditVendor(prev => ({ ...prev, vendor_type: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="Dyed">Dyed</option>
                    <option value="Embroidery">Embroidery</option>
                    <option value="Stitching">Stitching</option>
                    <option value="Diamond">Diamond</option>
                    <option value="Folding">Folding</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mobile Number</label>
                <input
                  type="tel"
                  required
                  value={editVendor.mobile}
                  onChange={(e) => setEditVendor(prev => ({ ...prev, mobile: e.target.value }))}
                  placeholder="10-digit number"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={editVendor.gst_number}
                    onChange={(e) => setEditVendor(prev => ({ ...prev, gst_number: e.target.value }))}
                    placeholder="22AAAAA0000A1Z5"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Address</label>
                  <input
                    type="text"
                    value={editVendor.address}
                    onChange={(e) => setEditVendor(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Vendor shop address"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Notes</label>
                <textarea
                  value={editVendor.notes}
                  onChange={(e) => setEditVendor(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Payment details, terms, rates, etc."
                  rows="2"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all text-sm"
                >
                  {actionLoading ? 'Saving...' : 'Update Vendor'}
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

export default Vendors;
