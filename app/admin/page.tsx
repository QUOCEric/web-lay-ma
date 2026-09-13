'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Khởi tạo Supabase client (Thay bằng cấu hình thực tế của bạn)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Danh sách các nhà cung cấp cho tab "Tra cứu nhanh"
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
  
  // State Quản lý hóa đơn & Kỳ cước
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const currentMonthDefault = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState(currentMonthDefault);
  
  // State Bulk Import
  const [rawImportText, setRawImportText] = useState('');
  const [importReport, setImportReport] = useState<string | null>(null);

  // State Tra cứu nhanh
  const [lookupCode, setLookupCode] = useState('');
  const [lastSelectedProvider, setLastSelectedProvider] = useState<string>('evn_bac');
  const [checkedProviders, setCheckedProviders] = useState<Record<string, boolean>>({});

  // State Modal Lỗi & Undo
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [selectedBillForError, setSelectedBillForError] = useState<any>(null);
  const [errorReason, setErrorReason] = useState('Đã thanh toán trước');
  const [toastMessage, setToastMessage] = useState<{ text: string; undoData?: any } | null>(null);

  // Load localStorage cho tra cứu nhanh
  useEffect(() => {
    const savedProvider = localStorage.getItem('last_provider');
    if (savedProvider) setLastSelectedProvider(savedProvider);
    fetchBills();
  }, [selectedBillingPeriod]);

  // Phím tắt bàn phím cho Tra cứu nhanh (Alt + 1, 2, 3...)
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

  // Tự động ẩn Toast sau 4 giây
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

  // Xử lý nạp dữ liệu hàng loạt thông minh (Bulk Import + Lọc trùng)
  const handleBulkImport = async () => {
    if (!rawImportText.trim()) return;
    setLoading(true);

    // 1. Tách dòng, loại bỏ khoảng trắng thừa (trim) và lọc bỏ dòng trống
    const lines = rawImportText
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    // 2. Lọc bỏ mã trùng lặp ngay trong danh sách vừa dán thô (dùng Set)
    const uniqueCodesInText = Array.from(new Set(lines));
    const duplicateInTextCount = lines.length - uniqueCodesInText.length;

    // 3. Kiểm tra trùng với database trong kỳ cước hiện tại
    const { data: existingBills } = await supabase
      .from('bills')
      .select('customer_code')
      .eq('billing_period', selectedBillingPeriod);

    const existingCodesSet = new Set(existingBills?.map(b => b.customer_code) || []);

    const finalCodesToInsert = uniqueCodesInText.filter(code => !existingCodesSet.has(code));
    const duplicateInDbCount = uniqueCodesInText.length - finalCodesToInsert.length;

    if (finalCodesToInsert.length === 0) {
      setImportReport(`⚠️ Không có mã nào được thêm. Tất cả ${lines.length} mã đều bị trùng lặp trong danh sách hoặc đã tồn tại ở kỳ cước ${selectedBillingPeriod}.`);
      setLoading(false);
      return;
    }

    // Tiến hành insert vào Supabase
    const payload = finalCodesToInsert.map(code => ({
      customer_code: code,
      billing_period: selectedBillingPeriod,
      status: 'pending',
      amount: 0
    }));

    const { error } = await supabase.from('bills').insert(payload);

    if (error) {
      alert('Lỗi khi nạp dữ liệu: ' + error.message);
    } else {
      setImportReport(`✅ Đã nạp thành công ${finalCodesToInsert.length} mã. (Loại bỏ ${duplicateInTextCount} mã trùng trong bản sao, ${duplicateInDbCount} mã đã có sẵn trên hệ thống tháng này).`);
      setRawImportText('');
      fetchBills();
    }
    setLoading(false);
  };

  // Thao tác 1 chạm trong Tab Tra cứu nhanh
  const handleQuickLookupAction = (provider: typeof PROVIDERS[0]) => {
    if (!lookupCode.trim()) {
      alert('Vui lòng nhập hoặc dán mã cần tra cứu trước!');
      return;
    }

    // 1. Copy mã vào bộ nhớ tạm (Clipboard)
    navigator.clipboard.writeText(lookupCode.trim());

    // 2. Lưu lại lựa chọn gần nhất
    setLastSelectedProvider(provider.id);
    localStorage.setItem('last_provider', provider.id);

    // 3. Đánh dấu khu vực này đã được kiểm tra
    setCheckedProviders(prev => ({ ...prev, [provider.id]: true }));

    // 4. Mở tab mới dẫn tới cổng tra cứu
    if (provider.url !== '#') {
      window.open(provider.url, '_blank');
    }
  };

  // Đánh dấu lỗi / Đã thanh toán trước (Mở Modal chọn lý do)
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
      // Hiển thị thông báo có nút Hoàn tác (Undo)
      setToastMessage({
        text: `Đã đánh dấu lỗi (${errorReason}) cho mã ${selectedBillForError.customer_code}.`,
        undoData: { id: billId, status: previousStatus }
      });
    } else {
      alert('Lỗi cập nhật: ' + error.message);
    }
  };

  // Tính năng Hoàn tác (Undo) trạng thái
  const handleUndo = async () => {
    if (!toastMessage?.undoData) return;
    const { id, status } = toastMessage.undoData;

    const { error } = await supabase
      .from('bills')
      .update({ status: status, error_reason: null })
      .eq('id', id);

    if (!error) {
      setToastMessage(null);
      fetchBills();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-800">
      <div className="max-w-7xl mx-auto">
        
        {/* Header & Chọn Kỳ Cước Tháng */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản Lý Hóa Đơn Admin</h1>
            <p className="text-sm text-gray-500">Hệ thống phân định tự động theo chu kỳ tháng cước.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Kỳ cước tháng:</label>
            <input 
              type="month" 
              value={selectedBillingPeriod}
              onChange={(e) => setSelectedBillingPeriod(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('bills')}
            className={`py-3 px-6 font-semibold text-sm border-b-2 transition-all ${
              activeTab === 'bills' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Quản Lý & Nạp Hóa Đơn
          </button>
          <button
            onClick={() => setActiveTab('quick_lookup')}
            className={`py-3 px-6 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'quick_lookup' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ⚡ Tra Cứu Nhanh 1 Chạm
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-6 font-semibold text-sm border-b-2 transition-all ${
              activeTab === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Cài Đặt & Hệ Thống
          </button>
        </div>

        {/* TAB 1: QUẢN LÝ & NẠP HÓA ĐƠN */}
        {activeTab === 'bills' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cột Trái: Bulk Import thông minh */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <h2 className="text-lg font-semibold mb-2">Nạp Dữ Liệu Hàng Loạt (Bulk Import)</h2>
              <p className="text-xs text-gray-500 mb-3">Dán danh sách mã khách hàng vào đây. Hệ thống sẽ tự động cắt khoảng trắng và lọc bỏ mã trùng lặp.</p>
              
              <textarea
                rows={8}
                value={rawImportText}
                onChange={(e) => setRawImportText(e.target.value)}
                placeholder="PE0123456&#10;PE0789101&#10;..."
                className="w-full border rounded-lg p-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none mb-3 resize-none"
              />

              <button
                onClick={handleBulkImport}
                disabled={loading}
                className="w-full bg-blue-600 text-white font-medium py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? 'Đang xử lý...' : 'Kiểm tra & Nạp vào hệ thống'}
              </button>

              {importReport && (
                <div className="mt-4 p-3 bg-blue-50 text-blue-800 text-xs rounded-lg border border-blue-100 whitespace-pre-line">
                  {importReport}
                </div>
              )}
            </div>

            {/* Cột Phải: Danh sách hóa đơn trong tháng */}
            <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Danh Sách Hóa Đơn (Tháng {selectedBillingPeriod})</h2>
                <span className="text-sm bg-gray-100 px-3 py-1 rounded-full text-gray-600">Tổng: {bills.length}</span>
              </div>

              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="p-3">Mã Khách Hàng</th>
                      <th className="p-3">Trạng Thái</th>
                      <th className="p-3">Số Tiền</th>
                      <th className="p-3 text-right">Thao Tác Nhanh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-gray-400">Không có hóa đơn nào trong kỳ cước này.</td>
                      </tr>
                    ) : (
                      bills.map((bill) => (
                        <tr key={bill.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-mono font-medium">{bill.customer_code}</td>
                          <td className="p-3">
                            {bill.status === 'pending' && <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded text-xs">Đang chờ</span>}
                            {bill.status === 'paid' && <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs">Đã đóng</span>}
                            {bill.status === 'error' && <span className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs" title={bill.error_reason}>Lỗi ({bill.error_reason || 'Khác'})</span>}
                          </td>
                          <td className="p-3">{bill.amount ? bill.amount.toLocaleString() + ' đ' : '---'}</td>
                          <td className="p-3 text-right space-x-2">
                            <button
                              onClick={() => {
                                setLookupCode(bill.customer_code);
                                setActiveTab('quick_lookup');
                              }}
                              className="text-blue-600 hover:underline text-xs bg-blue-50 px-2 py-1 rounded"
                            >
                              Tra cứu
                            </button>
                            <button
                              onClick={() => openErrorModal(bill)}
                              className="text-red-600 hover:underline text-xs bg-red-50 px-2 py-1 rounded"
                            >
                              Đánh dấu lỗi
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TRA CỨU NHANH (QUICK LOOKUP) */}
        {activeTab === 'quick_lookup' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-3xl mx-auto">
            <h2 className="text-xl font-bold mb-2">Trung Tâm Tra Cứu Nhanh 1 Chạm</h2>
            <p className="text-sm text-gray-500 mb-6">
              Nhập hoặc dán mã hóa đơn bên dưới. Khi bấm vào các khu vực, mã sẽ tự động copy vào bộ nhớ tạm và mở trang tra cứu tương ứng (Phím tắt: <kbd className="bg-gray-100 px-1.5 py-0.5 rounded border">Alt + số</kbd>).
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Mã Hóa Đơn / Khách Hàng Tập Trung:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value)}
                  placeholder="Dán mã vào đây (ví dụ: PA01001234567)..."
                  className="flex-1 border rounded-lg px-4 py-3 font-mono text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  onClick={() => setLookupCode('')}
                  className="px-4 border rounded-lg text-gray-500 hover:bg-gray-100 text-sm"
                >
                  Xóa
                </button>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-700 mb-3">Chọn Khu Vực Tra Cứu Nhanh:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PROVIDERS.map((provider, index) => {
                const isLastUsed = lastSelectedProvider === provider.id;
                const isChecked = checkedProviders[provider.id];

                return (
                  <button
                    key={provider.id}
                    onClick={() => handleQuickLookupAction(provider)}
                    className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                      isLastUsed 
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        <span className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">Alt+{index + 1}</span>
                        {provider.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {isLastUsed ? '🌟 Vừa tra cứu gần đây' : 'Click để copy & mở web'}
                      </div>
                    </div>
                    {isChecked && (
                      <span className="text-green-600 bg-green-100 text-xs px-2 py-1 rounded-full font-medium">✓ Đã check</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: CÀI ĐẶT */}
        {activeTab === 'settings' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-xl mx-auto">
            <h2 className="text-xl font-bold mb-4">Cài Đặt Hệ Thống</h2>
            <p className="text-sm text-gray-500 mb-4">Quản lý mật khẩu quản trị và cấu hình đồng bộ nâng cao.</p>
            {/* Khu vực cài đặt mật khẩu hoặc cấu hình khác */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Đổi Mật Khẩu Admin</label>
                <input type="password" placeholder="Mật khẩu mới" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        )}

      </div>

      {/* MODAL CHỌN LÝ DO LỖI / ĐÃ THANH TOÁN TRƯỚC */}
      {errorModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg">
            <h3 className="text-lg font-bold mb-2">Đánh Dấu Lỗi Mã: {selectedBillForError?.customer_code}</h3>
            <p className="text-sm text-gray-500 mb-4">Vui lòng chọn nguyên nhân để ẩn hoặc vô hiệu hóa mã này:</p>
            
            <div className="space-y-2 mb-4">
              {['Đã thanh toán trước', 'Sai mã khách hàng', 'Mã không tồn tại', 'Hệ thống nhà mạng lỗi'].map((reason) => (
                <label key={reason} className="flex items-center gap-3 p-2 rounded border hover:bg-gray-50 cursor-pointer text-sm">
                  <input 
                    type="radio" 
                    name="errorReason" 
                    value={reason} 
                    checked={errorReason === reason} 
                    onChange={(e) => setErrorReason(e.target.value)} 
                  />
                  {reason}
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setErrorModalOpen(false)} 
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100"
              >
                Hủy
              </button>
              <button 
                onClick={confirmMarkAsError} 
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                Xác Nhận Lỗi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION VỚI TÍNH NĂNG HOÀN TÁC (UNDO) */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-4 z-50 text-sm animate-bounce">
          <span>{toastMessage.text}</span>
          {toastMessage.undoData && (
            <button 
              onClick={handleUndo} 
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-medium transition"
            >
              Hoàn tác (Undo)
            </button>
          )}
        </div>
      )}
    </div>
  );
}