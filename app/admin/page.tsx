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
  billing_month?: string;
  is_valid?: boolean;
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
  const [billingMonth, setBillingMonth] = useState<string>('09/2026');

  const [historyList, setHistoryList] = useState<BillHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

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
const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setBatchText(text);
        if (typeof parseRawText === 'function') {
          parseRawText(text);
        }
      }
    };
    reader.readAsText(uploadedFile);
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

  const playNotificationSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play();
    } catch (e) {
      console.log('Trình duyệt chặn phát âm thanh');
    }
  };

  const fetchBills = async () => {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('type', billType)
      .eq('billing_month', billingMonth)
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, (payload) => {
          playNotificationSound();
          if (payload.new && (payload.new as any).status === 'pending') {
            alert(`🔔 Có đơn hàng mới gửi bill: Mã ${(payload.new as any).code}!`);
          }
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
  }, [isAuthenticated, billType, billingMonth]);

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

  const handleSaveBills = async () => {
    if (parsedBills.length === 0) {
      alert('Không có dữ liệu hợp lệ!');
      return;
    }

    const newBillsData = parsedBills.map((b) => ({
      code: b.code,
      owner_name: b.owner_name,
      amount: b.amount,
      type: newType,
      status: 'active',
      billing_month: billingMonth,
      is_valid: true
    }));

    const { error } = await supabase.from('bills').insert(newBillsData);

    if (!error) {
      alert(`🎉 Đã thêm thành công ${newBillsData.length} đơn vào kỳ ${billingMonth}!`);
      setBatchText('');
      setParsedBills([]);
      fetchBills();
    } else {
      alert('Lỗi: ' + error.message);
    }
  };

  const handleDeleteBill = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa mã này?')) return;
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (!error) fetchBills();
  };

  const handleToggleValid = async (id: number, currentStatus: boolean) => {
    await supabase.from('bills').update({ is_valid: !currentStatus }).eq('id', id);
    fetchBills();
  };

  const handleApproveBill = async (id: number) => {
    const { error } = await supabase.from('bills').update({ status: 'used' }).eq('id', id);
    if (!error) {
      alert('Đã duyệt đơn thành công!');
      fetchBills();
    }
  };

  const handleRejectBill = async (id: number) => {
    if (!confirm('Từ chối bill này (Nghi ngờ bill giả)?')) return;
    const { error } = await supabase.from('bills').update({ status: 'active', image_url: null }).eq('id', id);
    if (!error) {
      alert('Đã từ chối và mở lại mã!');
      fetchBills();
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`Đã copy mã: ${code}`);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) return;

    const { error } = await supabase.from('settings').update({ value: newPassword.trim() }).eq('key', 'admin_password');
    if (!error) {
      alert('Đổi mật khẩu thành công!');
      setNewPassword('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f3f4f6' }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: '#fff', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '300px' }}>
          <h3 style={{ marginTop: 0, textAlign: 'center' }}>Đăng Nhập Admin</h3>
          <input
            type="password"
            placeholder="Mật khẩu"
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

  const activeBills = bills.filter(b => b.status !== 'used');
  const usedBills = bills.filter(b => b.status === 'used');

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, color: '#111827' }}>⚙️ Trang Quản Trị Hệ Thống</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{ padding: '8px 16px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {showHistory ? '🔙 Quay lại Quản lý' : '📁 Lịch sử gửi Bill'}
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
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ marginTop: 0 }}>📁 Lịch sử toàn bộ ảnh bill khách gửi</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginTop: '16px' }}>
            {historyList.length === 0 ? (
              <p style={{ color: '#6b7280' }}>Chưa có lịch sử nào.</p>
            ) : (
              historyList.map((item) => (
                <div key={item.id} style={{ border: '1px solid #ddd', padding: '10px', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '4px' }}>
                    <span>{item.code} ({item.type})</span>
                    <button onClick={() => handleCopyCode(item.code)} style={{ fontSize: '11px', cursor: 'pointer' }}>📋</button>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>{new Date(item.created_at).toLocaleString('vi-VN')}</div>
                  <a href={item.image_url} target="_blank" rel="noreferrer">
                    <img src={item.image_url} alt="Bill" style={{ width: '100%', height: '130px', objectFit: 'cover', borderRadius: '4px' }} />
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
              <h3 style={{ marginTop: 0, fontSize: '16px', color: '#374151' }}>📥 Nạp Danh Sách Hóa Đơn Hàng Loạt</h3>
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Dịch vụ:</label>
                  <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                    <option value="dien">⚡ Điện</option>
                    <option value="nuoc">💧 Nước</option>
                    <option value="internet">🌐 Internet</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Kỳ tháng:</label>
                  <input
                    type="text"
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(e.target.value)}
                    placeholder="VD: 09/2026"
                    style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
<div style={{ marginBottom: '10px' }}>
  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Tải file (CSV/TXT):</label>
  <input
    type="file"
    accept=".csv, .txt"
    onChange={handleFileUpload}
    style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#f9fafb' }}
  />
</div>
              <textarea
                rows={3}
                placeholder={`Mã | Tên khách | Số tiền\nPA12345 | Nguyễn Văn A | 250000`}
                value={batchText}
                onChange={handleTextChange}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '12px' }}
              />
              <button
                type="button"
                onClick={handleSaveBills}
                style={{ width: '100%', marginTop: '8px', padding: '8px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                🚀 Thêm ({parsedBills.length}) Đơn Vào Hệ Thống
              </button>
            </div>

            <form onSubmit={handleChangePassword} style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #d1d5db', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ marginTop: 0, fontSize: '16px', color: '#374151' }}>🔑 Đổi Mật Khẩu</h3>
                <input
                  type="password"
                  placeholder="Mật khẩu mới..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
              <button type="submit" style={{ width: '100%', padding: '8px', backgroundColor: '#4b5563', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                Lưu Mật Khẩu
              </button>
            </form>
          </div>

          {/* Thanh chọn loại dịch vụ và kỳ xem */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setBillType('dien')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: billType === 'dien' ? '#2563eb' : '#e2e8f0', color: billType === 'dien' ? '#fff' : '#334155', fontWeight: 'bold', cursor: 'pointer' }}>⚡ Điện</button>
              <button onClick={() => setBillType('nuoc')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: billType === 'nuoc' ? '#2563eb' : '#e2e8f0', color: billType === 'nuoc' ? '#fff' : '#334155', fontWeight: 'bold', cursor: 'pointer' }}>💧 Nước</button>
              <button onClick={() => setBillType('internet')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: billType === 'internet' ? '#2563eb' : '#e2e8f0', color: billType === 'internet' ? '#fff' : '#334155', fontWeight: 'bold', cursor: 'pointer' }}>🌐 Internet</button>
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', marginRight: '6px' }}>Kỳ xem:</span>
              <input
                type="text"
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '90px', fontWeight: 'bold' }}
              />
            </div>
          </div>
{/* 📦 BẢNG QUẢN LÝ KHO MÃ VÀ BẬT/TẮT SỐNG CHẾT */}
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #d1d5db', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>📦 Quản Lý Kho Mã Dịch Vụ ({billType.toUpperCase()})</h3>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>Tổng số: {bills.length} mã</span>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>Mã Đơn</th>
                    <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>Tên Khách</th>
                    <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>Số Tiền</th>
                    <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>Kỳ Tháng</th>
                    <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>Trạng Thái Sống/Chết</th>
                    <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Không có mã nào trong kho kỳ này.</td>
                    </tr>
                  ) : (
                    bills.map((bill) => (
                      <tr key={bill.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#2563eb' }}>{bill.code}</td>
                        <td style={{ padding: '10px' }}>{bill.owner_name}</td>
                        <td style={{ padding: '10px', color: '#16a34a', fontWeight: 'bold' }}>{bill.amount?.toLocaleString('vi-VN')} đ</td>
                        <td style={{ padding: '10px' }}>{bill.billing_month}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleToggleValid(bill.id, bill.is_valid ?? true)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              border: 'none',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              backgroundColor: bill.is_valid !== false ? '#dcfce7' : '#fee2e2',
                              color: bill.is_valid !== false ? '#16a34a' : '#dc2626'
                            }}
                          >
                            {bill.is_valid !== false ? '✅ Đang Sống' : '❌ Đã Tắt (Chết)'}
                          </button>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleDeleteBill(bill.id)}
                            style={{ padding: '4px 8px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            🗑️ Xóa
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <h3 style={{ fontSize: '16px', color: '#111827', borderBottom: '2px solid #2563eb', paddingBottom: '4px', marginBottom: '16px' }}>
            ⏳ Đơn Hàng Đang Xử Lý & Chờ Duyệt ({activeBills.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {activeBills.length === 0 ? (
              <p style={{ color: '#6b7280', gridColumn: '1 / -1' }}>Không có đơn nào.</p>
            ) : (
              activeBills.map((bill) => (
                <div key={bill.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#2563eb' }}>{bill.code}</span>
                    <button
                      onClick={() => handleToggleValid(bill.id, bill.is_valid ?? true)}
                      style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: bill.is_valid !== false ? '#dcfce7' : '#fee2e2', color: bill.is_valid !== false ? '#16a34a' : '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      {bill.is_valid !== false ? '✅ Mã Sống' : '❌ Mã Lỗi/Chết'}
                    </button>
                  </div>

                  <div style={{ fontSize: '13px', backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', marginBottom: '8px' }}>
                    <div>👤 {bill.owner_name}</div>
                    <div style={{ color: '#16a34a', fontWeight: 'bold' }}>💵 {bill.amount?.toLocaleString('vi-VN')} VNĐ</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>📅 Kỳ: {bill.billing_month}</div>
                  </div>

                  {bill.image_url ? (
                    <div style={{ margin: '8px 0', textAlign: 'center' }}>
                      <a href={bill.image_url} target="_blank" rel="noreferrer">
                        <img src={bill.image_url} alt="Bill" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd' }} />
                      </a>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic', margin: '8px 0' }}>Chưa nộp bill</div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                    {bill.image_url && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleApproveBill(bill.id)} style={{ flex: 1, padding: '6px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>✓ Duyệt</button>
                        <button onClick={() => handleRejectBill(bill.id)} style={{ flex: 1, padding: '6px', backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>✕ Từ Chối</button>
                      </div>
                    )}
                    <button onClick={() => handleDeleteBill(bill.id)} style={{ width: '100%', padding: '4px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>🗑️ Xóa</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <h3 style={{ fontSize: '16px', color: '#111827', borderBottom: '2px solid #16a34a', paddingBottom: '4px', marginBottom: '16px' }}>
            ✅ Đơn Hàng Đã Hoàn Thành ({usedBills.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {usedBills.map((bill) => (
              <div key={bill.id} style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 'bold' }}>{bill.code}</span>
                  <span style={{ fontSize: '11px', color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>Đã đóng</span>
                </div>
                <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                  👤 {bill.owner_name} - <b>{bill.amount?.toLocaleString('vi-VN')} đ</b>
                </div>
                {bill.image_url && (
                  <a href={bill.image_url} target="_blank" rel="noreferrer">
                    <img src={bill.image_url} alt="Bill" style={{ width: '100%', maxHeight: '90px', objectFit: 'cover', borderRadius: '4px', marginBottom: '8px' }} />
                  </a>
                )}
                <button onClick={() => handleDeleteBill(bill.id)} style={{ width: '100%', padding: '4px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>🗑️ Xóa</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}