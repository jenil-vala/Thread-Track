import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api, { API_URL } from '../services/api';
import {
  Layers,
  Search,
  SlidersHorizontal,
  PlusCircle,
  Eye,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  FileDown,
  Undo2,
  Calendar,
  XCircle,
  CheckCircle,
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

const Sarees = () => {
  const location = useLocation();
  
  // State variables
  const [sarees, setSarees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedSaree, setSelectedSaree] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingHistory, setEditingHistory] = useState(null);
  const [isEditHistoryOpen, setIsEditHistoryOpen] = useState(false);
  const [editHistoryForm, setEditHistoryForm] = useState({
    vendor_id: '',
    work_cost: '',
    remarks: ''
  });
  
  // Form options
  const [dyedVendors, setDyedVendors] = useState([]);
  const [stageVendors, setStageVendors] = useState([]);
  const [allVendors, setAllVendors] = useState([]);
  
  // New Saree Form fields
  const [newSaree, setNewSaree] = useState({
    lot_number: '',
    design_name: '',
    quantity: '',
    dyed_vendor_id: '',
    meter_per_side: '',
    per_meter_rate: '',
    remarks: ''
  });
  const [dyedFabricCost, setDyedFabricCost] = useState(0);

  // Send to Stage Form fields
  const [sendForm, setSendForm] = useState({
    stage_name: 'Embroidery',
    vendor_id: '',
    per_unit_rate: '',
    flat_cost: '',
    remarks: ''
  });
  const [estimatedCost, setEstimatedCost] = useState(0);

  // Receive Stage Form fields
  const [receiveForm, setReceiveForm] = useState({
    actual_cost: '',
    remarks: ''
  });

  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [isDyedOverride, setIsDyedOverride] = useState(false);
  const [pdfModal, setPdfModal] = useState({
    isOpen: false,
    url: '',
    title: '',
    filename: ''
  });

  // Trigger from Dashboard navigation
  useEffect(() => {
    if (location.state?.openNewModal) {
      setIsNewModalOpen(true);
      window.history.replaceState({}, document.title);
    }
    if (location.state?.filterStage) {
      setStageFilter(location.state.filterStage);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Fetch sarees
  const fetchSarees = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (stageFilter) params.stage = stageFilter;
      if (statusFilter) params.status = statusFilter;
      if (vendorFilter) params.vendorId = vendorFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      
      const res = await api.get('/sarees', { params });
      setSarees(res.data.sarees);
      setTotalCount(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSarees();
  }, [search, stageFilter, statusFilter, vendorFilter, startDate, endDate]);

  // Fetch initial vendors lists
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const dyedRes = await api.get('/vendors?type=Dyed');
        setDyedVendors(dyedRes.data);
        
        const allRes = await api.get('/vendors');
        setAllVendors(allRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch next lot number
  const loadNextLot = async () => {
    try {
      const res = await api.get('/sarees/next-lot');
      setNewSaree(prev => ({ ...prev, lot_number: res.data.nextLotNumber }));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isNewModalOpen) {
      loadNextLot();
    }
  }, [isNewModalOpen]);

  // Calculate dyed fabric cost: qty * meter_per_side * per_meter_rate
  useEffect(() => {
    if (!isDyedOverride) {
      const qty = parseFloat(newSaree.quantity || 0);
      const meters = parseFloat(newSaree.meter_per_side || 0);
      const rate = parseFloat(newSaree.per_meter_rate || 0);
      setDyedFabricCost(qty * meters * rate);
    }
  }, [newSaree.quantity, newSaree.meter_per_side, newSaree.per_meter_rate, isDyedOverride]);

  // Fetch vendors when stage name changes in send form
  useEffect(() => {
    const fetchStageVendors = async () => {
      if (!sendForm.stage_name) return;
      try {
        const res = await api.get(`/vendors?type=${sendForm.stage_name}`);
        setStageVendors(res.data);
        // Default to first vendor if available
        setSendForm(prev => ({ ...prev, vendor_id: res.data[0]?.vendor_id || '' }));
      } catch (err) {
        console.error(err);
      }
    };
    fetchStageVendors();
  }, [sendForm.stage_name]);

  // Calculate estimated work cost for send form
  useEffect(() => {
    const qty = parseFloat(selectedSaree?.quantity || 0);
    if (['Embroidery', 'Stitching', 'Diamond', 'Folding'].includes(sendForm.stage_name)) {
      const rate = parseFloat(sendForm.per_unit_rate || 0);
      setEstimatedCost(qty * rate);
    } else {
      setEstimatedCost(parseFloat(sendForm.flat_cost || 0));
    }
  }, [sendForm.stage_name, sendForm.per_unit_rate, sendForm.flat_cost, selectedSaree]);

  // Auto-select next stage based on selectedSaree current_stage
  useEffect(() => {
    if (selectedSaree) {
      const stageOrder = ['Dyed', 'Embroidery', 'Stitching', 'Diamond', 'Folding', 'Completed'];
      const currentIndex = stageOrder.indexOf(selectedSaree.current_stage);
      if (currentIndex !== -1 && currentIndex < stageOrder.length - 1) {
        const nextStage = stageOrder[currentIndex + 1];
        if (nextStage !== 'Completed') {
          setSendForm(prev => ({
            ...prev,
            stage_name: nextStage,
            vendor_id: '',
            per_unit_rate: '',
            flat_cost: '',
            remarks: ''
          }));
        }
      }
    }
  }, [selectedSaree]);

  // Open Saree Details
  const handleOpenDetails = async (sareeId) => {
    try {
      const res = await api.get(`/sarees/${sareeId}`);
      setSelectedSaree(res.data);
      
      // Initialize receive form actual cost with current pending work cost estimation
      const pendingRecord = res.data.history.find(h => h.received_date === null);
      if (pendingRecord) {
        setReceiveForm({
          actual_cost: pendingRecord.work_cost,
          remarks: ''
        });
      }
      
      setIsDetailOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshDetails = async () => {
    if (!selectedSaree) return;
    await handleOpenDetails(selectedSaree.saree_id);
    fetchSarees();
  };

  // Submit New Saree
  const handleCreateSaree = async (e) => {
    e.preventDefault();
    setFormError('');
    setActionLoading(true);

    const { lot_number, design_name, quantity, dyed_vendor_id } = newSaree;
    if (!design_name || !quantity || !dyed_vendor_id || dyedFabricCost <= 0) {
      setFormError('Please enter design name, quantity, dyed vendor, and make sure fabric rate is set.');
      setActionLoading(false);
      return;
    }

    try {
      await api.post('/sarees', {
        lot_number: lot_number ? parseInt(lot_number) : undefined,
        design_name,
        quantity: parseInt(quantity),
        dyed_vendor_id: parseInt(dyed_vendor_id),
        fabric_cost: dyedFabricCost,
        remarks: newSaree.remarks
      });

      // Clear form
      setNewSaree({
        lot_number: '',
        design_name: '',
        quantity: '',
        dyed_vendor_id: '',
        meter_per_side: '',
        per_meter_rate: '',
        remarks: ''
      });
      setIsDyedOverride(false);
      setIsNewModalOpen(false);
      fetchSarees();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create lot.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Send to Stage
  const handleSendToStage = async (e) => {
    e.preventDefault();
    setFormError('');
    setActionLoading(true);

    const { stage_name, vendor_id } = sendForm;
    if (!vendor_id) {
      setFormError('Please select a vendor.');
      setActionLoading(false);
      return;
    }

    try {
      const payload = {
        stage_name,
        vendor_id: parseInt(vendor_id),
        remarks: sendForm.remarks
      };
      if (['Embroidery', 'Stitching', 'Diamond', 'Folding'].includes(stage_name)) {
        payload.per_unit_rate = parseFloat(sendForm.per_unit_rate);
      } else {
        payload.work_cost = estimatedCost;
      }
      
      await api.post(`/sarees/${selectedSaree.saree_id}/send`, payload);

      setSendForm({
        stage_name: 'Embroidery',
        vendor_id: '',
        per_unit_rate: '',
        flat_cost: '',
        remarks: ''
      });
      await refreshDetails();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to send to stage.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Receive Stage
  const handleReceiveFromVendor = async (e) => {
    e.preventDefault();
    setFormError('');
    setActionLoading(true);

    try {
      await api.post(`/sarees/${selectedSaree.saree_id}/receive`, {
        actual_cost: parseFloat(receiveForm.actual_cost),
        remarks: receiveForm.remarks
      });

      setReceiveForm({
        actual_cost: '',
        remarks: ''
      });
      await refreshDetails();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to receive work.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditHistory = (record) => {
    setEditingHistory(record);
    setEditHistoryForm({
      vendor_id: record.vendor_id.toString(),
      work_cost: record.work_cost.toString(),
      remarks: record.remarks || ''
    });
    setIsEditHistoryOpen(true);
  };

  const handleUpdateHistory = async (e) => {
    e.preventDefault();
    setFormError('');
    setActionLoading(true);

    try {
      await api.put(`/sarees/history/${editingHistory.history_id}`, {
        vendor_id: parseInt(editHistoryForm.vendor_id),
        work_cost: parseFloat(editHistoryForm.work_cost),
        remarks: editHistoryForm.remarks
      });
      setIsEditHistoryOpen(false);
      setEditingHistory(null);
      await refreshDetails();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to update stage history.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteHistory = async (record) => {
    const isDyed = record.stage_name === 'Dyed';
    const msg = isDyed
      ? `WARNING: Deleting the initial Dyed stage will permanently delete the ENTIRE saree lot #${selectedSaree.lot_number} and all its subsequent history. Do you want to proceed?`
      : `Are you sure you want to delete the ${record.stage_name} stage record? This will revert the lot to its previous stage.`;
      
    if (!window.confirm(msg)) return;

    setActionLoading(true);
    try {
      const res = await api.delete(`/sarees/history/${record.history_id}`);
      if (res.data.deletedLot) {
        setIsDetailOpen(false);
        fetchSarees();
      } else {
        await refreshDetails();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete history stage.');
    } finally {
      setActionLoading(false);
    }
  };

  // Undo Latest History
  const handleRollback = async () => {
    if (!window.confirm('Are you sure you want to rollback the last history step? This will reset the stage status.')) return;
    setActionLoading(true);
    try {
      await api.post(`/sarees/${selectedSaree.saree_id}/rollback`);
      await refreshDetails();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to rollback.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStageBadge = (stage) => {
    const colors = {
      Dyed: 'bg-amber-100 text-amber-800 border-amber-200',
      Embroidery: 'bg-purple-100 text-purple-800 border-purple-200',
      Stitching: 'bg-blue-100 text-blue-800 border-blue-200',
      Diamond: 'bg-sky-100 text-sky-800 border-sky-200',
      Folding: 'bg-rose-100 text-rose-800 border-rose-200',
      Completed: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    };
    return colors[stage] || 'bg-slate-100 text-slate-800 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Search and Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-5 h-5" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Saree ID, Design, Lot, or Vendor Name..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium text-slate-700 bg-white"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white px-5 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-600/10 shrink-0"
          >
            <PlusCircle className="w-5 h-5" />
            <span>ADD NEW SAREE LOT</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold shrink-0">
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filters:</span>
        </div>

        {/* Stage Filter */}
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-slate-600 bg-slate-50"
        >
          <option value="">Any Stage</option>
          <option value="Dyed">Dyed Complete</option>
          <option value="Embroidery">Embroidery</option>
          <option value="Stitching">Stitching</option>
          <option value="Diamond">Diamond</option>
          <option value="Folding">Folding</option>
          <option value="Completed">Completed</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-slate-600 bg-slate-50"
        >
          <option value="">Any Status</option>
          <option value="In Process">In Process</option>
          <option value="Completed">Completed</option>
          <option value="Hold">Hold</option>
        </select>

        {/* Vendor Filter */}
        <select
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-slate-600 bg-slate-50 max-w-[200px]"
        >
          <option value="">Any Vendor</option>
          {allVendors.map(v => (
            <option key={v.vendor_id} value={v.vendor_id}>
              {v.vendor_name} ({v.vendor_type})
            </option>
          ))}
        </select>

        {/* Start Date */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase">From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-slate-600 bg-slate-50"
          />
        </div>

        {/* End Date */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase">To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-slate-600 bg-slate-50"
          />
        </div>

        {(stageFilter || statusFilter || vendorFilter || startDate || endDate || search) && (
          <button
            onClick={() => {
              setStageFilter('');
              setStatusFilter('');
              setVendorFilter('');
              setStartDate('');
              setEndDate('');
              setSearch('');
            }}
            className="text-xs font-semibold text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100/70 px-3 py-2 rounded-lg transition-all"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Saree List Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : sarees.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Layers className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-lg font-bold text-slate-700">No saree lots found</h3>
            <p className="text-slate-400 text-sm">Create a new lot or adjust filters to begin.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  <th className="px-6 py-4">Lot Number</th>
                  <th className="px-6 py-4">Design Name</th>
                  <th className="px-6 py-4">Qty</th>
                  <th className="px-6 py-4">Current Stage</th>
                  <th className="px-6 py-4">Current Location</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                {sarees.map((saree) => (
                  <tr key={saree.saree_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-indigo-600">Lot #{saree.lot_number}</td>
                    <td className="px-6 py-4">{saree.design_name}</td>
                    <td className="px-6 py-4">{saree.quantity} pcs</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full border text-xs font-bold ${getStageBadge(saree.current_stage)}`}>
                        {saree.current_stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {saree.current_vendor_name ? (
                        <div className="flex flex-col">
                          <span className="font-bold">{saree.current_vendor_name}</span>
                          <span className="text-xs text-slate-400">({saree.current_vendor_type})</span>
                        </div>
                      ) : saree.status === 'Completed' ? (
                        <span className="text-emerald-600 font-bold">Finished (In House)</span>
                      ) : (
                        <span className="text-slate-400 italic">In Workshop (In House)</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        saree.status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : saree.status === 'Hold'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-indigo-50 text-indigo-700'
                      }`}>
                        {saree.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenDetails(saree.saree_id)}
                        className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 active:scale-95 text-slate-700 px-3 py-2 rounded-lg transition-all text-xs font-bold"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Track / Move</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE LOT MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 border border-slate-100 animate-slide-up space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-900">Add New Saree Lot</h3>
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

            <form onSubmit={handleCreateSaree} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Lot Number</label>
                  <input
                    type="number"
                    value={newSaree.lot_number}
                    onChange={(e) => setNewSaree(prev => ({ ...prev, lot_number: e.target.value }))}
                    placeholder="Lot Number (auto-increment)"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Design Name/No</label>
                  <input
                    type="text"
                    required
                    value={newSaree.design_name}
                    onChange={(e) => setNewSaree(prev => ({ ...prev, design_name: e.target.value }))}
                    placeholder="Enter saree design name"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Quantity (Pcs)</label>
                  <input
                    type="number"
                    required
                    value={newSaree.quantity}
                    onChange={(e) => setNewSaree(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="Number of sarees in lot"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dyed Vendor</label>
                  <select
                    required
                    value={newSaree.dyed_vendor_id}
                    onChange={(e) => setNewSaree(prev => ({ ...prev, dyed_vendor_id: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Select Dyed Vendor</option>
                    {dyedVendors.map(v => (
                      <option key={v.vendor_id} value={v.vendor_id}>
                        {v.vendor_name} ({v.mobile})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dyed Fabric Cost parameters */}
              <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100 space-y-4">
                <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Dyed Fabric Cost Calculator</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2">Meter Per Side</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newSaree.meter_per_side}
                      onChange={(e) => setNewSaree(prev => ({ ...prev, meter_per_side: e.target.value }))}
                      placeholder="e.g. 5.5"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2">Per Meter Rate (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newSaree.per_meter_rate}
                      onChange={(e) => setNewSaree(prev => ({ ...prev, per_meter_rate: e.target.value }))}
                      placeholder="Rate per meter"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 border-t border-amber-200/50 text-sm font-bold text-amber-900">
                  <span>Formula: Qty * Meter * Rate</span>
                  <div className="flex items-center gap-2">
                    <span>Final Cost (Rs.):</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={dyedFabricCost}
                      onChange={(e) => {
                        setDyedFabricCost(parseFloat(e.target.value || 0));
                        setIsDyedOverride(true);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-amber-300 bg-white text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 w-32"
                    />
                    {isDyedOverride && (
                      <button
                        type="button"
                        onClick={() => setIsDyedOverride(false)}
                        className="text-xs font-semibold text-amber-700 hover:text-amber-950 underline ml-1 whitespace-nowrap"
                      >
                        Auto-Calc
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Remarks</label>
                <textarea
                  value={newSaree.remarks}
                  onChange={(e) => setNewSaree(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Additional description..."
                  rows="2"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-600/10 text-sm flex items-center gap-1.5"
                >
                  {actionLoading ? 'Saving...' : 'Save & Complete Dyed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRACK / DETAIL MODAL */}
      {isDetailOpen && selectedSaree && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto p-8 border border-slate-100 animate-slide-up space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Lot Details & Tracking</h3>
                <p className="text-sm font-semibold text-indigo-600">Lot #{selectedSaree.lot_number} — {selectedSaree.design_name}</p>
              </div>
              <button
                onClick={() => {
                  setIsDetailOpen(false);
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

            {/* Side-by-Side Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Saree Info & Timeline */}
              <div className="lg:col-span-5 space-y-6 border-r border-slate-100 pr-0 lg:pr-8">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lot Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm font-semibold text-slate-700">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase">Quantity</span>
                      <span className="text-slate-800 font-extrabold">{selectedSaree.quantity} Sarees</span>
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase">Current Stage</span>
                      <span className="text-slate-800 font-extrabold">{selectedSaree.current_stage}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase">Location</span>
                      <span className="text-slate-800 font-extrabold truncate block" title={selectedSaree.current_vendor_name || 'In Workshop'}>
                        {selectedSaree.current_vendor_name || 'In Workshop'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase">Status</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        selectedSaree.status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : selectedSaree.status === 'Hold'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-indigo-50 text-indigo-700'
                      }`}>
                        {selectedSaree.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    <span>Manufacturing History</span>
                  </h4>

                  <div className="relative border-l border-slate-200 ml-4 pl-6 space-y-6">
                    {selectedSaree.history.map((record) => (
                      <div key={record.history_id} className="relative">
                        {/* Timeline Bullet */}
                        <span className="absolute -left-[31px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 ring-4 ring-white">
                          <span className="h-2 w-2 rounded-full bg-indigo-600" />
                        </span>
                        
                        {/* Stage Detail Card */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all">
                          <div className="flex items-center justify-between">
                            <span className="text-base font-extrabold text-slate-800">{record.stage_name}</span>
                            <span className="text-xs text-slate-400 font-bold">{formatDateDMY(record.sent_date)}</span>
                          </div>
                          <div className="mt-1 text-sm font-semibold text-indigo-600">
                            {record.vendor_name} ({record.vendor_type})
                          </div>
                          <div className="mt-2 text-sm font-bold text-slate-700 flex justify-between items-center">
                            <span>Cost: ₹{parseFloat(record.work_cost).toLocaleString('en-IN')}</span>
                            <span className="text-xs text-slate-400 font-medium">
                              {record.received_date ? `Recd: ${formatDateDMY(record.received_date)}` : 'Pending'}
                            </span>
                          </div>
                          {record.remarks && (
                            <div className="mt-2 text-xs text-slate-400 font-medium italic border-t border-slate-100 pt-1.5">
                              Notes: {record.remarks}
                            </div>
                          )}
                          
                          {/* Document Slip / Edit / Delete buttons */}
                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                            <button
                              onClick={() => setPdfModal({
                                isOpen: true,
                                url: `/pdf/job-work-slip/${record.history_id}`,
                                title: `Job Work Slip — Lot #${selectedSaree.lot_number}`,
                                filename: `job_work_slip_lot_${selectedSaree.lot_number}_stage_${record.stage_name}.pdf`
                              })}
                              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-all font-bold"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                              <span>Slip PDF</span>
                            </button>

                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleOpenEditHistory(record)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteHistory(record)}
                                className="text-xs text-rose-500 hover:text-rose-700 font-bold transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Forms & Actions */}
              <div className="lg:col-span-7 space-y-6 flex flex-col justify-between">
                
                {/* Form area */}
                <div className="space-y-6">
                  {selectedSaree.status !== 'Completed' ? (
                    <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 space-y-4">
                      {selectedSaree.current_vendor_id ? (
                        // Active pending: Receive form
                        <form onSubmit={handleReceiveFromVendor} className="space-y-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-indigo-600" />
                            <h4 className="text-md font-bold text-slate-800">
                              Receive from Vendor ({selectedSaree.current_vendor_name})
                            </h4>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-2">
                                Actual Cost (₹)
                              </label>
                              <input
                                type="number"
                                step="any"
                                required
                                value={receiveForm.actual_cost}
                                onChange={(e) => setReceiveForm(prev => ({ ...prev, actual_cost: e.target.value }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-2">Remarks</label>
                              <input
                                type="text"
                                value={receiveForm.remarks}
                                onChange={(e) => setReceiveForm(prev => ({ ...prev, remarks: e.target.value }))}
                                placeholder="e.g. Received full quantity"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <button
                              type="submit"
                              disabled={actionLoading}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all text-sm flex items-center gap-1.5 active:scale-95"
                            >
                              {actionLoading ? 'Processing...' : 'Complete Work & Receive'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        // Back in workshop: Send to next stage form
                        <form onSubmit={handleSendToStage} className="space-y-4">
                          <div className="flex items-center gap-2">
                            <ArrowRight className="w-5 h-5 text-indigo-600 animate-pulse" />
                            <h4 className="text-md font-bold text-slate-800">Send Saree Lot to Next Stage</h4>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-2">Next Stage</label>
                              <select
                                value={sendForm.stage_name}
                                onChange={(e) => setSendForm(prev => ({ ...prev, stage_name: e.target.value }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none"
                              >
                                <option value="Embroidery">Embroidery</option>
                                <option value="Stitching">Stitching</option>
                                <option value="Diamond">Diamond</option>
                                <option value="Folding">Folding</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-2">Select Vendor</label>
                              <select
                                required
                                value={sendForm.vendor_id}
                                onChange={(e) => setSendForm(prev => ({ ...prev, vendor_id: e.target.value }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none"
                              >
                                <option value="">Choose Vendor</option>
                                {stageVendors.map(v => (
                                  <option key={v.vendor_id} value={v.vendor_id}>
                                    {v.vendor_name} ({v.mobile})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Dynamic Cost Input based on stage type */}
                            {['Embroidery', 'Stitching', 'Diamond', 'Folding'].includes(sendForm.stage_name) ? (
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-2">
                                  {sendForm.stage_name === 'Embroidery' ? 'Per-Side rate (₹)' : `Per Saree ${sendForm.stage_name} Cost (₹)`}
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  required
                                  value={sendForm.per_unit_rate}
                                  onChange={(e) => setSendForm(prev => ({ ...prev, per_unit_rate: e.target.value }))}
                                  placeholder={sendForm.stage_name === 'Embroidery' ? 'Rate per side' : `Rate per Saree`}
                                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            ) : (
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-2">
                                  Total Work Cost (₹)
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  required
                                  value={sendForm.flat_cost}
                                  onChange={(e) => setSendForm(prev => ({ ...prev, flat_cost: e.target.value }))}
                                  placeholder="Total labor amount"
                                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-slate-600 mb-2">Remarks</label>
                              <input
                                type="text"
                                value={sendForm.remarks}
                                onChange={(e) => setSendForm(prev => ({ ...prev, remarks: e.target.value }))}
                                placeholder="e.g. Urgent work slip details"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none"
                              />
                            </div>
                            <div className="text-right font-bold text-slate-800 text-sm mt-6">
                              {['Embroidery', 'Stitching', 'Diamond', 'Folding'].includes(sendForm.stage_name) && (
                                <span className="block text-[10px] text-slate-400 normal-case mb-1">
                                  Formula: Qty * Rate
                                </span>
                              )}
                              Estimated Cost: ₹{estimatedCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <button
                              type="submit"
                              disabled={actionLoading}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all text-sm flex items-center gap-1.5 active:scale-95"
                            >
                              {actionLoading ? 'Sending...' : 'Confirm Handoff & Send'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : (
                    <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 text-center space-y-2">
                      <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                      <h4 className="font-bold text-emerald-800 text-base">Manufacturing Cycle Completed</h4>
                      <p className="text-slate-500 text-sm">All stages of this saree lot have been completed. Finished goods are in the workshop.</p>
                    </div>
                  )}
                </div>

                {/* Secondary Action Panel */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lot Management Actions</h4>
                  <div className="flex flex-wrap gap-3">
                    {selectedSaree.history.length > 0 && (
                      <button
                        onClick={handleRollback}
                        disabled={actionLoading}
                        className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-800 px-4 py-2.5 rounded-xl transition-all text-xs font-bold border border-slate-200 active:scale-95 shadow-sm"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Undo Last Handoff</span>
                      </button>
                    )}

                    <button
                      onClick={async () => {
                        if (window.confirm('WARNING: Deleting this lot will permanently delete all associated workflow records. Continue?')) {
                          setActionLoading(true);
                          try {
                            await api.delete(`/sarees/${selectedSaree.saree_id}`);
                            setIsDetailOpen(false);
                            fetchSarees();
                          } catch (err) {
                            alert(err.response?.data?.error || 'Failed to delete saree.');
                          } finally {
                            setActionLoading(false);
                          }
                        }
                      }}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2.5 rounded-xl font-bold transition-all text-xs border border-rose-200/50 active:scale-95"
                    >
                      Delete Saree Lot
                    </button>

                    <button
                      onClick={() => {
                        setIsDetailOpen(false);
                        setFormError('');
                      }}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all text-xs shadow-md shadow-indigo-600/10 ml-auto active:scale-95"
                    >
                      Close Tracking
                    </button>
                  </div>
                </div>
                
              </div>
            </div>

          </div>
        </div>
      )}

      {/* EDIT WORKFLOW HISTORY RECORD MODAL */}
      {isEditHistoryOpen && editingHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-100 animate-slide-up space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Stage Record</h3>
                <p className="text-xs font-semibold text-slate-400 uppercase mt-0.5">Stage: {editingHistory.stage_name}</p>
              </div>
              <button
                onClick={() => {
                  setIsEditHistoryOpen(false);
                  setEditingHistory(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateHistory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select Vendor</label>
                <select
                  required
                  value={editHistoryForm.vendor_id}
                  onChange={(e) => setEditHistoryForm(prev => ({ ...prev, vendor_id: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Choose Vendor</option>
                  {allVendors
                    .filter(v => v.vendor_type.toLowerCase() === editingHistory.stage_name.toLowerCase())
                    .map(v => (
                      <option key={v.vendor_id} value={v.vendor_id}>
                        {v.vendor_name} ({v.mobile})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Work Cost (₹)</label>
                <input
                  type="number"
                  required
                  step="any"
                  value={editHistoryForm.work_cost}
                  onChange={(e) => setEditHistoryForm(prev => ({ ...prev, work_cost: e.target.value }))}
                  placeholder="Enter cost of work"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Remarks</label>
                <input
                  type="text"
                  value={editHistoryForm.remarks}
                  onChange={(e) => setEditHistoryForm(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Additional notes..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditHistoryOpen(false);
                    setEditingHistory(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all text-xs"
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

export default Sarees;
