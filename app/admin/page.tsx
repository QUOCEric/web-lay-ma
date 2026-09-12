'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Bill {
  id: number;
  code: string;
  status: string;
  image_url?: string;
  type?: string;
  amount?: number;
  owner_name?: string;
}

interface BillHistoryItem {
  id: number;
  bill_id: number;
  code: string;
  type: string;
  image_url: string;
  created_at: string;
}

interface ParsedBill {
  code: string;
  owner_name: string;
  amount: number;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [bills, setBills] = useState<Bill[]>([]);
  const [billType, setBillType] = useState<string>('dien');

  const [historyList, setHistoryList] = useState<BillHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [importMode, setImportMode] = useState<'paste' | 'file'>('paste');
  const [batchText, setBatchText] = useState('');
  const [parsedBills, setParsedBills] = useState<ParsedBill[]>([]);
  const [newType, setNewType] = useState('dien');
  const [newPassword, setNewPassword] = useState('');

  const checkAuth = async () => {
    const savedAuth = localStorage.getItem('admin_authenticated');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await supabase.from('settings').select('value').eq('key', 'admin_password').single();
    const correctPassword = data?.value || 'admin123';

    if (passwordInput === correctPassword) {
      setIsAuthenticated(true);
      localStorage.setItem('admin_authenticated', 'true');
    } else {
      alert('Sai mật khẩu Admin!');
    }
  };

  const fetchBills = async () => {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('type', billType)
      .order('id', { ascending: true });

    if (!error && data) {
      setBills(data);
    }
  };

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('bill_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setHistoryList(data);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBills();
      fetchHistory();

      const channel = supabase
        .channel('admin_realtime_bills')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, () => {
          fetchBills();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bill_history' }, () => {
          fetchHistory();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAuthenticated, billType]);

  const parseRawText = (text: string) => {
    const lines = text.split('\n');
    const result: ParsedBill[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const parts = trimmed.split(/[\t,;|]+/);
      const code = parts[0] ? parts[0].trim() : '';
      const owner_name = parts[1] ? parts[1].trim() : 'Chưa cập nhật';
      const amountStr = parts[2] ? parts[2].trim().replace(/[^0-9]/g, '') : '0';
      const amount = parseInt(amountStr, 10) || 0;

      if (code && code.toLowerCase() !== 'mã đơn' && code.toLowerCase() !== 'ma don') {
        result.push({ code, owner_name, amount });
      }
    });

    setParsedBills(result);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBatchText(val);
    parseRawText(val);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setBatchText(content);
        parseRawText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveBills = async () => {
    if (parsedBills.length === 0) {
      alert('Không có dữ liệu đơn hàng hợp lệ nào để thêm!');
      return;
    }

    const newBillsData = parsedBills.map((b) => ({
      code: b.code,
      owner_name: b.owner_name || 'Khách hàng',
      amount: b.amount,
      type: newType,
      status: 'active'
    }));

    const { error } = await supabase.from('bills').insert(newBillsData);

    if (!error) {
      alert(`🎉 Thêm thành công ${newBillsData.length} đơn vào hệ thống!`);
      setBatchText('');
      setParsedBills([]);
      fetchBills();
    } else {
      alert('Lỗi thêm danh sách đơn: ' + error.message);
    }
  };

  const handleDeleteBill = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa mã này?')) return;
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (!error) fetchBills();
  };

  const handleApproveBill = async (id: number) => {
    const { error } = await supabase
      .from('bills')
      .update({ status: 'used' })
      .eq('id', id);

    if (!error) {
      alert('Đã duyệt đơn thành công!');
      fetchBills();
    } else {
      alert('Lỗi khi duyệt: ' + error.message);
    }
  };

  const handleRejectBill = async (id: number) => {
    if (!confirm('Xác nhận TỪ CHỐI bill này? Mã sẽ được mở lại trạng thái Sẵn Sàng.')) return;

    const { error } = await supabase
      .from('bills')
      .update({ status: 'active', image_url: null })
      .eq('id', id);

    if (!error) {
      alert('Đã từ chối bill và mở lại mã!');
      fetchBills();
    } else {
      alert('Lỗi khi từ chối: ' + error.message);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`Đã copy mã: ${code}`);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) return;

    const { error } = await supabase
      .from('settings')
      .update({ value: newPassword.trim() })
      .eq('key', 'admin_password');

    if (!error) {
      alert('Đã đổi mật khẩu Admin thành công!');
      setNewPassword('');
    } else {
      alert('Lỗi đổi mật khẩu: ' + error.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f3f4f6' }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: '#fff', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '320px' }}>
          <h3 style={{ marginTop: 0, textAlign: 'center', color: '#111827' }}>Đăng Nhập Admin</h3>
          <input
            type="password"
            placeholder="Mật khẩu Admin"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '16px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
          />
          <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            Đăng Nhập
          </button>
        </form>
      </div>
    );
  }

  const incompleteBills = bills.filter(b => b.status !== 'used');
  const completedBills = bills.filter(b => b.status === 'used');

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, color: '#111827' }}>⚙️ Quản Lý Hệ Thống Hóa Đơn</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{ padding: '8px 16px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {showHistory ? '🔙 Quay lại Quản Lý' : '📁 Xem Bằng Chứng / Lịch Sử Bill'}
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('admin_authenticated');
              setIsAuthenticated(false);
            }}
            style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Đăng Xuất
          </button>
        </div>
      </div>

      {showHistory ? (
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ marginTop: 0, color: '#111827' }}>📁 Lịch Sử Tất Cả Ảnh Bill Đã Gửi</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', marginTop: '16px' }}>
            {historyList.length === 0 ? (
              <p style={{ color: '#6b7280' }}>Chưa có lịch sử gửi bill nào.</p>
            ) : (
              historyList.map((item) => (
                <div key={item.id} style={{ border: '1px solid #ddd', padding: '12px', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', color: '#111827' }}>
                    <span>Mã: {item.code} ({item.type === 'dien' ? 'Điện' : 'Nước'})</span>
                    <button onClick={() => handleCopyCode(item.code)} style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc' }}>📋 Copy</button>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 8px 0' }}>
                    Thời gian: {new Date(item.created_at).toLocaleString('vi-VN')}
                  </div>
                  <a href={item.image_url} target="_blank" rel="noreferrer">
                    <img src={item.image_url} alt="Bill History" style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px' }} />
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2.8fr 1.2fr', gap: '20px', marginBottom: '32px' }}>
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #d1d5db', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#1f2937' }}>
                  📋 Nhập Danh Sách Đơn Hàng Loạt
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>Loại đơn:</span>
                  <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#f9fafb', fontWeight: 'bold' }}>
                    <option value="dien">⚡ Điện</option>
                    <option value="nuoc">💧 Nước</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setImportMode('paste')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: importMode === 'paste' ? '#2563eb' : '#f3f4f6',
                    color: importMode === 'paste' ? '#fff' : '#374151',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  📝 Cách 1: Copy & Dán từ Excel / Word / Text
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('file')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: importMode === 'file' ? '#2563eb' : '#f3f4f6',
                    color: importMode === 'file' ? '#fff' : '#374151',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  📁 Cách 2: Tải File (.csv, .txt)
                </button>
              </div>

              {importMode === 'paste' ? (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '6px' }}>
                    Mở Excel/Word, bôi đen danh sách rồi copy dán vào ô dưới (Thứ tự: <b>Mã đơn | Tên | Số tiền</b>):
                  </label>
                  <textarea
                    rows={5}
                    placeholder={`PA01020304 | Nguyễn Văn An | 350000\nPA01020305 | Trần Thị B | 520000`}
                    value={batchText}
                    onChange={handleTextChange}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '13px' }}
                  />
                </div>
              ) : (
                <div style={{ marginBottom: '16px', padding: '24px', border: '2px dashed #9ca3af', borderRadius: '8px', textAlign: 'center', backgroundColor: '#f9fafb' }}>
                  <input
                    type="file"
                    accept=".csv, .txt"
                    onChange={handleFileUpload}
                    style={{ fontSize: '13px' }}
                  />
                </div>
              )}

              {parsedBills.length > 0 && (
                <div style={{ marginTop: '16px', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#f3f4f6', padding: '8px 12px', fontSize: '13px', fontWeight: 'bold', color: '#1f2937' }}>
                    👀 Đã nhận diện được ({parsedBills.length}) đơn hợp lệ:
                  </div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                          <th style={{ padding: '6px 12px' }}>STT</th>
                          <th style={{ padding: '6px 12px' }}>Mã Đơn</th>
                          <th style={{ padding: '6px 12px' }}>Tên Khách Hàng</th>
                          <th style={{ padding: '6px 12px' }}>Số Tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedBills.map((b, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f9fafb' }}>
                            <td style={{ padding: '6px 12px', color: '#6b7280' }}>{idx + 1}</td>
                            <td style={{ padding: '6px 12px', fontWeight: 'bold' }}>{b.code}</td>
                            <td style={{ padding: '6px 12px' }}>{b.owner_name}</td>
                            <td style={{ padding: '6px 12px', color: '#16a34a', fontWeight: 'bold' }}>
                              {b.amount > 0 ? b.amount.toLocaleString('vi-VN') + ' đ' : '---'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveBills}
                disabled={parsedBills.length === 0}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: parsedBills.length > 0 ? '#16a34a' : '#9ca3af',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  cursor: parsedBills.length > 0 ? 'pointer' : 'not-allowed'
                }}
              >
                🚀 Thêm ({parsedBills.length}) Đơn Này Vào Hệ Thống
              </button>
            </div>

            <form onSubmit={handleChangePassword} style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #d1d5db', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ marginTop: 0, marginBottom: '16px', color: '#1f2937' }}>🔑 Đổi Mật Khẩu Admin</h4>
                <input
                  type="password"
                  placeholder="Mật khẩu mới..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
              <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#4b5563', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Lưu Mật Khẩu
              </button>
            </form>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
            <button
              onClick={() => setBillType('dien')}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: billType === 'dien' ? '#2563eb' : '#e5e7eb',
                color: billType === 'dien' ? '#ffffff' : '#374151',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              ⚡ Hóa Đơn Điện
            </button>
            <button
              onClick={() => setBillType('nuoc')}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: billType === 'nuoc' ? '#2563eb' : '#e5e7eb',
                color: billType === 'nuoc' ? '#ffffff' : '#374151',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              💧 Hóa Đơn Nước
            </button>
          </div>

          {/* KHU VỰC 1: ĐƠN CHƯA HOÀN THÀNH */}
          <h3 style={{ color: '#111827', borderBottom: '2px solid #2563eb', paddingBottom: '8px', marginBottom: '16px' }}>
            ⚡ Đơn Hàng Đang Xử Lý & Sẵn Sàng ({incompleteBills.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', marginBottom: '40px' }}>
            {incompleteBills.length === 0 ? (
              <p style={{ color: '#6b7280', gridColumn: '1 / -1' }}>Không có đơn hàng nào đang chờ xử lý.</p>
            ) : (
              incompleteBills.map((bill) => {
                const isActive = bill.status === 'active';
                const isPending = bill.status === 'pending';

                return (
                  <div
                    key={bill.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>
                            Mã: {bill.code}
                          </span>
                          <button
                            onClick={() => handleCopyCode(bill.code)}
                            title="Copy mã đơn"
                            style={{ padding: '2px 6px', fontSize: '11px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            📋 Copy
                          </button>
                        </div>
                        {isActive && <span style={{ fontSize: '12px', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>Sẵn sàng</span>}
                        {isPending && <span style={{ fontSize: '12px', color: '#b45309', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>Đang xử lý</span>}
                      </div>

                      {(bill.owner_name || bill.amount) && (
                        <div style={{ backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '8px' }}>
                          {bill.owner_name && <div>👤 <b>Khách hàng:</b> {bill.owner_name}</div>}
                          {bill.amount && bill.amount > 0 && <div>💵 <b>Số tiền:</b> {bill.amount.toLocaleString('vi-VN')} VNĐ</div>}
                        </div>
                      )}

                      {bill.image_url ? (
                        <div style={{ margin: '12px 0', textAlign: 'center' }}>
                          <a href={bill.image_url} target="_blank" rel="noreferrer">
                            <img
                              src={bill.image_url}
                              alt="Bill chuyển khoản"
                              style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #ddd' }}
                            />
                          </a>
                        </div>
                      ) : (
                        <div style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic', margin: '12px 0' }}>
                          Chưa có ảnh chuyển khoản
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                      {bill.image_url && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleApproveBill(bill.id)}
                            style={{ flex: 1, padding: '8px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                          >
                            ✓ Duyệt Bill
                          </button>
                          <button
                            onClick={() => handleRejectBill(bill.id)}
                            style={{ flex: 1, padding: '8px', backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                          >
                            ✕ Từ Chối
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => handleDeleteBill(bill.id)}
                        style={{ width: '100%', padding: '6px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        🗑️ Xóa Mã
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* KHU VỰC 2: ĐƠN ĐÃ HOÀN THÀNH (ĐÃ DUYỆT) */}
          <h3 style={{ color: '#111827', borderBottom: '2px solid #16a34a', paddingBottom: '8px', marginBottom: '16px' }}>
            ✅ Đơn Hàng Đã Hoàn Thành / Đã Duyệt ({completedBills.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {completedBills.length === 0 ? (
              <p style={{ color: '#6b7280', gridColumn: '1 / -1' }}>Chưa có đơn hàng nào được duyệt hoàn thành.</p>
            ) : (
              completedBills.map((bill) => (
                <div
                  key={bill.id}
                  style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>
                          Mã: {bill.code}
                        </span>
                        <button
                          onClick={() => handleCopyCode(bill.code)}
                          title="Copy mã đơn"
                          style={{ padding: '2px 6px', fontSize: '11px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          📋 Copy
                        </button>
                      </div>
                      <span style={{ fontSize: '12px', color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '4px' }}>Hoàn tất</span>
                    </div>

                    {(bill.owner_name || bill.amount) && (
                      <div style={{ backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '8px', border: '1px solid #e5e7eb' }}>
                        {bill.owner_name && <div>👤 <b>Khách hàng:</b> {bill.owner_name}</div>}
                        {bill.amount && bill.amount > 0 && <div>💵 <b>Số tiền:</b> {bill.amount.toLocaleString('vi-VN')} VNĐ</div>}
                      </div>
                    )}

                    {bill.image_url && (
                      <div style={{ margin: '12px 0', textAlign: 'center' }}>
                        <a href={bill.image_url} target="_blank" rel="noreferrer">
                          <img
                            src={bill.image_url}
                            alt="Bill chuyển khoản"
                            style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #ddd' }}
                          />
                        </a>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <button
                      onClick={() => handleDeleteBill(bill.id)}
                      style={{ width: '100%', padding: '6px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      🗑️ Xóa Mã Khỏi Hệ Thống
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}