'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const PROVIDERS = [
  { id: 'evn_bac', name: 'EVN Miền Bắc (cskh.npc.com.vn)', url: 'https://cskh.npc.com.vn/' },
  { id: 'evn_trung', name: 'EVN Miền Trung (cskh.cpc.vn)', url: 'https://cskh.cpc.vn/' },
  { id: 'evn_nam', name: 'EVN Miền Nam (cskh.evnspc.vn)', url: 'https://cskh.evnspc.vn/' },
  { id: 'evn_hanoi', name: 'EVN Hà Nội (evnhanoi.vn)', url: 'https://cskh.evnhanoi.vn/' },
  { id: 'evn_hcm', name: 'EVN TP.HCM (cskh.evnhcmc.vn)', url: 'https://cskh.evnhcmc.vn/' },
  { id: 'cap_nuoc', name: 'Cấp Nước (Tùy chọn)', url: '#' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'bills' | 'quick_lookup' | 'settings'>('bills');
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const currentMonthDefault = new Date().toISOString().slice(0, 7);
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState(currentMonthDefault);
  
  const [rawImportText, setRawImportText] = useState('');
  const [importReport, setImportReport] = useState<string | null>(null);

  const [lookupCode, setLookupCode] = useState('');
  const [lastSelectedProvider, setLastSelectedProvider] = useState<string>('evn_bac');
  const [checkedProviders, setCheckedProviders] = useState<Record<string, boolean>>({});

  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [selectedBillForError, setSelectedBillForError] = useState<any>(null);
  const [errorReason, setErrorReason] = useState('Đã thanh toán trước');
  const [toastMessage, setToastMessage] = useState<{ text: string; undoData?: any } | null>(null);

  useEffect(() => {
    const savedProvider = localStorage.getItem('last_provider');
    if (savedProvider) setLastSelectedProvider(savedProvider);
    fetchBills();
  }, [selectedBillingPeriod]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab === 'quick_lookup' && e.altKey) {
        const index = parseInt(e.key) - 1;
        if (PROVIDERS[index]) {
          e.preventDefault();
          handleQuickLookupAction(PROVIDERS[index]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, lookupCode]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const fetchBills = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('billing_period', selectedBillingPeriod)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setBills(data);
    }
    setLoading(false);
  };

  const handleBulkImport = async () => {
    if (!rawImportText.trim()) return;
    setLoading(true);

    const lines = rawImportText
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    const uniqueCodesInText = Array.from(new Set(lines));
    const duplicateInTextCount = lines.length - uniqueCodesInText.length;

    const { data: existingBills } = await supabase
      .from('bills')
      .select('code')
      .eq('billing_period', selectedBillingPeriod);

    const existingCodesSet = new Set(existingBills?.map(b => b.code) || []);

    const finalCodesToInsert = uniqueCodesInText.filter(code => !existingCodesSet.has(code));
    const duplicateInDbCount = uniqueCodesInText.length - finalCodesToInsert.length;

    if (finalCodesToInsert.length === 0) {
      setImportReport(`⚠️ Không có mã nào được thêm. Tất cả ${lines.length} mã đều bị trùng lặp.`);
      setLoading(false);
      return;
    }

    const payload = finalCodesToInsert.map(code => ({
      code: code,
      owner_name: 'Chưa cập nhật',
      billing_period: selectedBillingPeriod,
      status: 'pending',
      amount: 0
    }));

    const { error } = await supabase.from('bills').insert(payload);

    if (error) {
      alert('Lỗi khi nạp dữ liệu: ' + error.message);
    } else {
      setImportReport(`✅ Đã nạp thành công ${finalCodesToInsert.length} mã. (Loại bỏ ${duplicateInTextCount} trùng thô, ${duplicateInDbCount} trùng DB).`);
      setRawImportText('');
      fetchBills();
    }
    setLoading(false);
  };

  const handleQuickLookupAction = (provider: typeof PROVIDERS[0]) => {
    if (!lookupCode.trim()) {
      alert('Vui lòng nhập mã cần tra cứu!');
      return;
    }
    navigator.clipboard.writeText(lookupCode.trim());
    setLastSelectedProvider(provider.id);
    localStorage.setItem('last_provider', provider.id);
    setCheckedProviders(prev => ({ ...prev, [provider.id]: true }));

    if (provider.url !== '#') {
      window.open(provider.url, '_blank');
    }
  };

  const openErrorModal = (bill: any) => {
    setSelectedBillForError(bill);
    setErrorModalOpen(true);
  };

  const confirmMarkAsError = async () => {
    if (!selectedBillForError) return;
    const previousStatus = selectedBillForError.status;
    const billId = selectedBillForError.id;

    const { error } = await supabase
      .from('bills')
      .update({ status: 'error', error_reason: errorReason })
      .eq('id', billId);

    if (!error) {
      setErrorModalOpen(false);
      fetchBills();
      setToastMessage({
        text: `Đã đánh dấu lỗi (${errorReason}) cho mã ${selectedBillForError.code}.`,
        undoData: { id: billId, status: previousStatus }
      });
    }
  };

  const handleUndo = async () => {
    if (!toastMessage?.undoData) return;
    const { id, status } = toastMessage.undoData;

    const { error } = await supabase
      .from('bills')
      .update({ status: status || 'pending', error_reason: null })
      .eq('id', id);

    if (!error) {
      setToastMessage(null);
      fetchBills();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Quản Lý Hóa Đơn Admin</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Kỳ cước:</label>
          <input 
            type="month" 
            value={selectedBillingPeriod}
            onChange={(e) => setSelectedBillingPeriod(e.target.value)}
            className="border p-2 rounded text-sm"
          />
        </div>
      </div>

      <div className="flex gap-4 border-b mb-6">
        <button onClick={() => setActiveTab('bills')} className={`pb-2 font-medium ${activeTab === 'bills' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>Quản Lý Hóa Đơn</button>
        <button onClick={() => setActiveTab('quick_lookup')} className={`pb-2 font-medium ${activeTab === 'quick_lookup' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>⚡ Tra Cứu Nhanh</button>
      </div>

      {activeTab === 'bills' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-4 rounded border shadow-sm">
            <h2 className="font-semibold mb-2">Nạp Hàng Loạt</h2>
            <textarea
              rows={6}
              value={rawImportText}
              onChange={(e) => setRawImportText(e.target.value)}
              placeholder="Dán mã vào đây..."
              className="w-full border p-2 rounded mb-3 text-sm font-mono"
            />
            <button onClick={handleBulkImport} disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium">
              {loading ? 'Đang xử lý...' : 'Nạp Dữ Liệu'}
            </button>
            {importReport && <div className="mt-3 p-2 bg-blue-50 text-xs text-blue-800 rounded">{importReport}</div>}
          </div>

          <div className="lg:col-span-2 bg-white p-4 rounded border shadow-sm">
            <h2 className="font-semibold mb-3">Danh Sách Tháng {selectedBillingPeriod} ({bills.length})</h2>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="p-2">Mã Khách Hàng</th>
                    <th className="p-2">Trạng Thái</th>
                    <th className="p-2 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map(bill => (
                    <tr key={bill.id} className="border-b">
                      <td className="p-2 font-mono">{bill.code}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${bill.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>
                          {bill.status || 'pending'} {bill.error_reason ? `(${bill.error_reason})` : ''}
                        </span>
                      </td>
                      <td className="p-2 text-right space-x-2">
                        <button onClick={() => { setLookupCode(bill.code); setActiveTab('quick_lookup'); }} className="text-blue-600 text-xs">Tra cứu</button>
                        <button onClick={() => openErrorModal(bill)} className="text-red-600 text-xs">Báo lỗi</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'quick_lookup' && (
        <div className="bg-white p-6 rounded border shadow-sm max-w-2xl mx-auto">
          <h2 className="text-lg font-bold mb-4">Tra Cứu Nhanh 1 Chạm</h2>
          <input 
            type="text" 
            value={lookupCode} 
            onChange={(e) => setLookupCode(e.target.value)} 
            placeholder="Nhập mã cần tra cứu..."
            className="w-full border p-3 rounded mb-4 font-mono text-lg"
          />
          <div className="grid grid-cols-2 gap-3">
            {PROVIDERS.map((p, idx) => (
              <button key={p.id} onClick={() => handleQuickLookupAction(p)} className="p-3 border rounded text-left hover:bg-gray-50 flex justify-between items-center">
                <div>
                  <div className="text-xs text-gray-400">Alt+{idx+1}</div>
                  <div className="font-medium text-sm">{p.name}</div>
                </div>
                {checkedProviders[p.id] && <span className="text-green-600 text-xs">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {errorModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white p-5 rounded max-w-sm w-full">
            <h3 className="font-bold mb-3">Chọn lý do lỗi</h3>
            {['Đã thanh toán trước', 'Sai mã', 'Mã không tồn tại'].map(r => (
              <label key={r} className="block text-sm mb-2 cursor-pointer">
                <input type="radio" name="err" value={r} checked={errorReason === r} onChange={(e) => setErrorReason(e.target.value)} /> {r}
              </label>
            ))}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setErrorModalOpen(false)} className="px-3 py-1 border rounded text-sm">Hủy</button>
              <button onClick={confirmMarkAsError} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded shadow-lg flex items-center gap-3 text-sm">
          <span>{toastMessage.text}</span>
          <button onClick={handleUndo} className="bg-blue-600 px-2 py-1 rounded text-xs">Hoàn tác</button>
        </div>
      )}
    </div>
  );
}