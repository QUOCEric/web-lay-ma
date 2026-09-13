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

  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [selectedBillForCheck, setSelectedBillForCheck] = useState<Bill | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('bac');

  const handleOpenCheckSystem = (bill: Bill) => {
    setSelectedBillForCheck(bill);
    setIsCheckModalOpen(true);
  };

  const checkAuth = async () => {
    const savedAuth = localStorage.getItem('admin_authenticated');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
  };

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setBatchText(text);
        parseRawText(text);
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

  const getCheckUrl = () => {
    if (!selectedBillForCheck) return '#';
    const type = selectedBillForCheck.type;

    // Tự động copy mã vào bộ nhớ tạm luôn khi bấm mở link
    navigator.clipboard.writeText(selectedBillForCheck.code);

    if (type === 'dien') {
      if (selectedRegion === 'bac') return 'https://cskh.npc.com.vn';
      if (selectedRegion === 'trung') return 'https://cskh.cpc.vn';
      return 'https://cskh.hcmpc.com.vn'; // Nam
    } else if (type === 'nuoc') {
      if (selectedRegion === 'bac') return 'https://cskh.hawaco.vn';
      if (selectedRegion === 'trung') return 'https://cskh.huevacowater.vn';
      return 'https://cskh.sawaco.com.vn'; // Nam
    } else {
      return 'https://viettel.vn';
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

          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #d1d5db', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>📦 Quản Lý Kho Mã Dịch Vụ ({billType.toUpperCase()})</h3>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>Tổng số: {bills.length} mã</span>
            </div>

            {bills.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>Chưa có mã hóa đơn nào trong kỳ này.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '10px' }}>ID</th>
                      <th style={{ padding: '10px' }}>Mã Hóa Đơn</th>
                      <th style={{ padding: '10px' }}>Khách Hàng</th>
                      <th style={{ padding: '10px' }}>Số Tiền</th>
                      <th style={{ padding: '10px' }}>Trạng Thái</th>
                      <th style={{ padding: '10px' }}>Ảnh Bill</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Hiển Thị (Khách Thấy)</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Hành Động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((bill) => (
                      <tr key={bill.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: bill.status === 'pending' ? '#fef3c7' : 'transparent' }}>
                        <td style={{ padding: '10px' }}>#{bill.id}</td>
                        <td style={{ padding: '10px', fontWeight: 'bold' }}>
                          {bill.code}
                          <button onClick={() => handleCopyCode(bill.code)} style={{ marginLeft: '6px', fontSize: '10px', cursor: 'pointer' }}>📋</button>
                        </td>
                        <td style={{ padding: '10px' }}>{bill.owner_name || 'Chưa cập nhật'}</td>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#0f766e' }}>
                          {bill.amount ? `${bill.amount.toLocaleString('vi-VN')} đ` : '0 đ'}
                        </td>
                        <td style={{ padding: '10px' }}>
                          {bill.status === 'active' && <span style={{ color: '#2563eb', fontWeight: 'bold' }}>Sẵn sàng</span>}
                          {bill.status === 'processing' && <span style={{ color: '#d97706', fontWeight: 'bold' }}>Đang xử lý</span>}
                          {bill.status === 'pending' && <span style={{ color: '#ea580c', fontWeight: 'bold' }}>Đã gửi bill ⏳</span>}
                          {bill.status === 'used' && <span style={{ color: '#16a34a', fontWeight: 'bold' }}>Đã hoàn thành ✅</span>}
                        </td>
                        <td style={{ padding: '10px' }}>
                          {bill.image_url ? (
                            <a href={bill.image_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                              Xem ảnh 🖼️
                            </a>
                          ) : (
                            <span style={{ color: '#9ca3af' }}>Không có</span>
                          )}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleToggleValid(bill.id, bill.is_valid ?? true)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: 'none',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              backgroundColor: bill.is_valid ? '#dcfce7' : '#fee2e2',
                              color: bill.is_valid ? '#166534' : '#991b1b',
                            }}
                          >
                            {bill.is_valid ? '🟢 Đang bật' : '🔴 Đã tắt'}
                          </button>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleOpenCheckSystem(bill)}
                              style={{ padding: '4px 8px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                            >
                              Check Web
                            </button>

                            {bill.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApproveBill(bill.id)}
                                  style={{ padding: '4px 8px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                >
                                  Duyệt
                                </button>
                                <button
                                  onClick={() => handleRejectBill(bill.id)}
                                  style={{ padding: '4px 8px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                >
                                  Từ chối
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteBill(bill.id)}
                              style={{ padding: '4px 8px', backgroundColor: '#6b7280', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {isCheckModalOpen && selectedBillForCheck && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', width: '480px', maxWidth: '90%', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>
                🔍 Tra Cứu Nhanh Hóa Đơn
              </h3>
              <button 
                onClick={() => setIsCheckModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold', color: '#6b7280' }}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '13px' }}><b>Khách hàng:</b> {selectedBillForCheck.owner_name}</p>
              <p style={{ margin: '0 0 6px 0', fontSize: '13px' }}><b>Số tiền:</b> <span style={{ color: '#0f766e', fontWeight: 'bold' }}>{selectedBillForCheck.amount?.toLocaleString('vi-VN')} đ</span></p>
              <p style={{ margin: '0 0 6px 0', fontSize: '13px' }}><b>Kỳ tháng:</b> {selectedBillForCheck.billing_month}</p>
              <p style={{ margin: '0', fontSize: '13px' }}><b>Loại:</b> {selectedBillForCheck.type?.toUpperCase()}</p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px', color: '#374151' }}>Chọn khu vực tra cứu:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button"
                  onClick={() => setSelectedRegion('bac')}
                  style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: '4px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: selectedRegion === 'bac' ? '#2563eb' : '#e2e8f0', color: selectedRegion === 'bac' ? '#fff' : '#334155' }}
                >
                  Miền Bắc
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedRegion('trung')}
                  style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: '4px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: selectedRegion === 'trung' ? '#2563eb' : '#e2e8f0', color: selectedRegion === 'trung' ? '#fff' : '#334155' }}
                >
                  Miền Trung
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedRegion('nam')}
                  style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: '4px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: selectedRegion === 'nam' ? '#2563eb' : '#e2e8f0', color: selectedRegion === 'nam' ? '#fff' : '#334155' }}
                >
                  Miền Nam
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px', color: '#374151' }}>Mã hóa đơn (Click để copy):</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  readOnly 
                  value={selectedBillForCheck.code} 
                  style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontWeight: 'bold', color: '#2563eb' }} 
                />
                <button 
                  onClick={() => handleCopyCode(selectedBillForCheck.code)} 
                  style={{ padding: '0 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                >
                  Copy
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => setIsCheckModalOpen(false)}
                  style={{ flex: 1, padding: '10px', backgroundColor: '#e5e7eb', color: '#334155', borderRadius: '6px', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
                >
                  Đóng
                </button>
                <a 
                  href={getCheckUrl()} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ flex: 1, padding: '10px', backgroundColor: '#16a34a', color: '#fff', textAlign: 'center', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  🌐 Mở Web & Tự Động Copy Mã
                </a>
              </div>
              <p style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', margin: '4px 0 0 0' }}>
                💡 Khi bấm nút trên, mã <b style={{color: '#2563eb'}}>{selectedBillForCheck.code}</b> đã được copy sẵn. Sang web bạn chỉ cần ấn <b>Ctrl + V</b> là xong!
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}