import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  FileText,
  FileDown,
  TrendingDown,
  AlertTriangle,
  Layers,
  ArrowRight,
  TrendingUp,
  Calendar,
  Filter
} from 'lucide-react';
import PdfViewerModal from '../components/PdfViewerModal';

const Reports = () => {
  const [outstandingData, setOutstandingData] = useState(null);
  const [productionData, setProductionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allVendors, setAllVendors] = useState([]);
  
  // Filters
  const [vendorFilter, setVendorFilter] = useState('');
  const [vendorTypeFilter, setVendorTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [pdfModal, setPdfModal] = useState({
    isOpen: false,
    url: '',
    title: '',
    filename: ''
  });

  const fetchVendors = async () => {
    try {
      const res = await api.get('/vendors');
      setAllVendors(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (vendorFilter) params.vendorId = vendorFilter;
      if (vendorTypeFilter) {
        params.vendorType = vendorTypeFilter;
        params.stage = vendorTypeFilter;
      }
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const outRes = await api.get('/reports/outstanding', { params });
      setOutstandingData(outRes.data);

      const prodRes = await api.get('/reports/production', { params });
      setProductionData(prodRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    fetchReportsData();
  }, [vendorFilter, vendorTypeFilter, startDate, endDate]);

  const getPdfParamsString = () => {
    const params = new URLSearchParams();
    if (vendorFilter) params.append('vendorId', vendorFilter);
    if (vendorTypeFilter) {
      params.append('vendorType', vendorTypeFilter);
      params.append('stage', vendorTypeFilter);
    }
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const str = params.toString();
    return str ? `?${str}` : '';
  };

  const vendors = outstandingData?.vendors || [];
  const totalOutstanding = outstandingData?.total_outstanding || 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Reports & Statements</h1>
        <p className="text-slate-500 mt-1">Export native statements and view filtered system ledgers</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-1.5 mb-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <label className="block text-xs font-bold text-slate-500 uppercase">Vendor Name</label>
          </div>
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
          >
            <option value="">All Vendors</option>
            {allVendors.map(v => (
              <option key={v.vendor_id} value={v.vendor_id}>{v.vendor_name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[150px]">
          <div className="flex items-center gap-1.5 mb-2">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <label className="block text-xs font-bold text-slate-500 uppercase">Vendor Type / Stage</label>
          </div>
          <select
            value={vendorTypeFilter}
            onChange={(e) => setVendorTypeFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
          >
            <option value="">All Stages</option>
            <option value="Dyed">Dyed</option>
            <option value="Embroidery">Embroidery</option>
            <option value="Stitching">Stitching</option>
            <option value="Diamond">Diamond</option>
            <option value="Folding">Folding</option>
          </select>
        </div>

        <div className="flex-1 min-w-[140px]">
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <label className="block text-xs font-bold text-slate-500 uppercase">Start Date</label>
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"
          />
        </div>

        <div className="flex-1 min-w-[140px]">
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <label className="block text-xs font-bold text-slate-500 uppercase">End Date</label>
          </div>
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

      {/* Quick Download PDFs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group">
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-base">Production History Statement</h4>
            <p className="text-xs text-slate-400 font-medium">Download complete manufacturing log of all lots</p>
          </div>
          <button
            onClick={() => setPdfModal({
              isOpen: true,
              url: `/pdf/production-report${getPdfParamsString()}`,
              title: 'Production History Status Report',
              filename: 'production_report.pdf'
            })}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-bold transition-all text-xs shadow-md shadow-indigo-600/10 active:scale-95"
          >
            <FileDown className="w-4 h-4" />
            <span>Export to PDF</span>
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group">
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-base">Outstandings Ledger Statement</h4>
            <p className="text-xs text-slate-400 font-medium">Download report of all unpaid vendor balances</p>
          </div>
          <button
            onClick={() => setPdfModal({
              isOpen: true,
              url: `/pdf/outstanding-report${getPdfParamsString()}`,
              title: 'Outstanding Liabilities Ledger',
              filename: 'outstanding_liabilities_report.pdf'
            })}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-4 py-3 rounded-xl font-bold transition-all text-xs shadow-md active:scale-95 border border-slate-700"
          >
            <FileDown className="w-4 h-4" />
            <span>Export to PDF</span>
          </button>
        </div>
      </div>

      {/* Liabilities Report (Hisab outstanding) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h3 className="text-lg font-bold text-slate-800">Outstanding Liabilities (Unpaid Work)</h3>
          </div>
          <span className="text-sm font-extrabold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1 rounded-xl whitespace-nowrap">
            Total Due: ₹{totalOutstanding.toLocaleString('en-IN')}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
            {vendors.length === 0 ? (
              <div className="text-center py-8 text-slate-400 font-medium text-sm">
                All clear! No outstanding balances with any vendors.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      <th className="px-6 py-3">Vendor Name</th>
                      <th className="px-6 py-3">Vendor Type</th>
                      <th className="px-6 py-3 text-right">Work Completed (Cr)</th>
                      <th className="px-6 py-3 text-right">Total Paid (Dr)</th>
                      <th className="px-6 py-3 text-right">Outstanding Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {vendors.map(v => (
                      <tr key={v.vendor_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 font-bold text-slate-800 whitespace-nowrap">{v.vendor_name}</td>
                        <td className="px-6 py-3 text-indigo-600 whitespace-nowrap">{v.vendor_type}</td>
                        <td className="px-6 py-3 text-right whitespace-nowrap">₹{v.total_work.toLocaleString('en-IN')}</td>
                        <td className="px-6 py-3 text-right whitespace-nowrap">₹{v.total_paid.toLocaleString('en-IN')}</td>
                        <td className="px-6 py-3 text-right text-rose-600 font-extrabold whitespace-nowrap">₹{v.pending_balance.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Production Stage Summary */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-800">Production Saree Lots Register</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
            {productionData.length === 0 ? (
              <div className="text-center py-8 text-slate-400 font-medium text-sm">
                No saree lots found in the system.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      <th className="px-6 py-3">Lot No</th>
                      <th className="px-6 py-3">Design Name</th>
                      <th className="px-6 py-3">Quantity</th>
                      <th className="px-6 py-3">Current Stage</th>
                      <th className="px-6 py-3">Current Location</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {productionData.map(s => (
                      <tr key={s.saree_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 text-indigo-600 font-bold whitespace-nowrap">Lot #{s.lot_number}</td>
                        <td className="px-6 py-3">{s.design_name}</td>
                        <td className="px-6 py-3 whitespace-nowrap">{s.quantity} pcs</td>
                        <td className="px-6 py-3 whitespace-nowrap">{s.current_stage}</td>
                        <td className="px-6 py-3 text-xs text-slate-500 font-normal whitespace-nowrap">
                          {s.current_vendor_name ? `${s.current_vendor_name} (${s.current_vendor_type})` : 'In Workshop'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            s.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

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

export default Reports;
