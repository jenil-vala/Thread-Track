import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Layers,
  Users,
  IndianRupee,
  Activity,
  ArrowRight,
  TrendingUp,
  PlusCircle,
  Eye
} from 'lucide-react';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [sareesList, setSareesList] = useState([]);
  const [selectedStage, setSelectedStage] = useState('All');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const res = await api.get('/reports/dashboard');
        setData(res.data);

        const sareesRes = await api.get('/sarees');
        setSareesList(sareesRes.data.sarees);
      } catch (err) {
        console.error('Error fetching dashboard stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { summary, pipeline } = data || {
    summary: { total_sarees_lots: 0, total_sarees_quantity: 0, total_outstanding_payable: 0, total_vendors: 0 },
    pipeline: { Dyed: { count: 0, qty: 0 }, Embroidery: { count: 0, qty: 0 }, Stitching: { count: 0, qty: 0 }, Diamond: { count: 0, qty: 0 }, Folding: { count: 0, qty: 0 }, Completed: { count: 0, qty: 0 } }
  };

  const statCards = [
    {
      title: 'Total Saree Lots',
      value: summary.total_sarees_lots,
      subtitle: `${summary.total_sarees_quantity} Sarees total`,
      icon: Layers,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
      action: () => navigate('/sarees')
    },
    {
      title: 'Total Manufacturing Cost',
      value: `₹${(summary.total_manufacturing_cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      subtitle: 'Cumulative cost',
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      action: () => navigate('/reports')
    },
    {
      title: 'Outstanding Payable',
      value: `₹${summary.total_outstanding_payable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      subtitle: 'Pending vendor balances',
      icon: IndianRupee,
      color: 'text-rose-600 bg-rose-50 border-rose-100',
      action: () => navigate('/vendors')
    }
  ];

  // Pipeline order
  const stages = [
    { key: 'Dyed', label: 'Dyed', color: 'from-amber-400 to-amber-500' },
    { key: 'Embroidery', label: 'Embroidery', color: 'from-purple-500 to-purple-600' },
    { key: 'Stitching', label: 'Stitching', color: 'from-blue-500 to-blue-600' },
    { key: 'Diamond', label: 'Diamond', color: 'from-sky-400 to-sky-500' },
    { key: 'Folding', label: 'Folding', color: 'from-rose-400 to-rose-500' },
    { key: 'Completed', label: 'Completed', color: 'from-emerald-500 to-emerald-600' }
  ];

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

  const filteredLots = selectedStage === 'All'
    ? sareesList
    : sareesList.filter(s => s.current_stage === selectedStage);

  return (
    <div className="space-y-10">
      {/* Action shortcuts */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Overview</h1>
          <p className="text-slate-500 mt-1">Real-time status of your manufacturing house</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sarees', { state: { openNewModal: true } })}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white px-5 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-600/10"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Add Saree Lot</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              onClick={card.action}
              className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-between group"
            >
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{card.title}</p>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">{card.value}</h3>
                <p className="text-xs text-slate-500 font-medium">{card.subtitle}</p>
              </div>
              <div className={`p-4 rounded-2xl border ${card.color}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Pipeline Progression View */}
      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600 animate-pulse" />
            <h3 className="text-lg font-bold text-slate-800">Manufacturing Pipeline</h3>
          </div>
          <div className="flex items-center gap-2">
            {selectedStage !== 'All' && (
              <button
                onClick={() => setSelectedStage('All')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg transition-all"
              >
                Clear Filter (Show All)
              </button>
            )}
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Active Production
            </span>
          </div>
        </div>

        {/* Pipeline Diagram */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
          {stages.map((stage, idx) => {
            const countObj = pipeline[stage.key] || { count: 0, qty: 0 };
            const isSelected = selectedStage === stage.key;
            return (
              <div key={stage.key} className="relative flex flex-col items-center">
                {/* Stage Box */}
                <div
                  onClick={() => setSelectedStage(prev => prev === stage.key ? 'All' : stage.key)}
                  className={`w-full p-5 rounded-2xl border text-center cursor-pointer transition-all duration-200 group active:scale-[0.98] ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-600/10 shadow-md scale-[1.02]'
                      : 'bg-slate-50 hover:bg-slate-100/80 border-slate-100 shadow-sm'
                  }`}
                >
                  <div className={`w-12 h-1.5 rounded-full mx-auto mb-3 bg-gradient-to-r ${stage.color}`}></div>
                  <h4 className="font-bold text-slate-800 text-sm">{stage.label}</h4>
                  <div className="mt-3 space-y-1">
                    <p className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {countObj.count}
                    </p>
                    <p className="text-xs text-slate-400 font-medium">
                      {countObj.qty} Sarees
                    </p>
                  </div>
                </div>

                {/* Arrow to Next Stage */}
                {idx < stages.length - 1 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-4 -translate-y-1/2 z-10 text-slate-300 pointer-events-none">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Filtered Saree Lots Data View */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Lots in Stage: <span className="text-indigo-600">{selectedStage === 'All' ? 'All Pipeline Stages' : selectedStage}</span>
            </h4>
            <span className="text-xs text-slate-400 font-semibold">Lots count: {filteredLots.length}</span>
          </div>

          <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
            {filteredLots.length === 0 ? (
              <div className="text-center py-10 text-slate-400 font-medium text-xs">
                No active lots currently found in {selectedStage === 'All' ? 'the pipeline' : `the ${selectedStage} stage`}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      <th className="px-6 py-3">Lot No</th>
                      <th className="px-6 py-3">Design Name</th>
                      <th className="px-6 py-3">Quantity</th>
                      <th className="px-6 py-3">Stage</th>
                      <th className="px-6 py-3">Location / Vendor</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {filteredLots.map(s => (
                      <tr key={s.saree_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 text-indigo-600 font-bold whitespace-nowrap">Lot #{s.lot_number}</td>
                        <td className="px-6 py-3">{s.design_name}</td>
                        <td className="px-6 py-3 whitespace-nowrap">{s.quantity} pcs</td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded border text-xs font-bold ${getStageBadge(s.current_stage)}`}>
                            {s.current_stage}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-600 font-medium">
                          {s.current_vendor_name ? (
                            <span>{s.current_vendor_name} <span className="text-xs text-slate-400 font-normal">({s.current_vendor_type})</span></span>
                          ) : (
                            <span className="text-slate-400 italic">In Workshop</span>
                          )}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            s.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : s.status === 'Hold'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => navigate('/sarees', { state: { filterStage: s.current_stage } })}
                            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 active:scale-95 text-slate-700 px-2.5 py-1.5 rounded-lg transition-all text-xs font-bold border border-slate-200"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Track</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
