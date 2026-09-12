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
  customer_name?: string;
}

interface BillHistoryItem {
  id: number;
  bill_id: number;
  code: string;
  type: string;
  image_url: string;
  created_at: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [bills, setBills] = useState<Bill[]>([]);
  const [billType, setBillType] = useState<string>('dien');

  const [historyList, setHistoryList] = useState<BillHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Form thêm đơn hàng mới
  const [newCode, setNewCode] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newAmount, setNewAmount] = useState('');
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

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) {
      alert('Vui lòng nhập Mã Hóa Đơn!');
      return;
    }

    const { error } = await supabase.from('bills').insert([
      {
        code: newCode.trim(),
        customer_name: newCustomerName.trim(),
        amount: parseFloat(newAmount) || 0,
        type: newType,
        status: 'active'
      }
    ]);

    if (!error) {
      setNewCode('');
      setNewCustomerName('');
      setNewAmount('');
      fetchBills();
      alert('Thêm đơn thành công!');
    } else {
      alert('Lỗi thêm mã: ' + error.message);
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
                  <div style={{ fontWeight: 'bold', color: '#111827' }}>Mã: {item.code} ({item.type === 'dien' ? 'Điện' : 'Nước'})</div>
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
          {/* KHUNG THÊM ĐƠN RỘNG RÃI & RÕ RÀNG CÁC CỘT */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '32px' }}>
            <form onSubmit={handleAddBill} style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '10px', border: '1px solid #d1d5db', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <h4 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ➕ Thêm Đơn Hóa Đơn Mới
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '4px' }}>Loại Hóa Đơn</label>
                  <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff' }}>
                    <option value="dien">⚡ Điện</option>
                    <option value="nuoc">💧 Nước</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '4px' }}>Cột 1: Mã Hóa Đơn (*)</label>
                  <input
                    type="text"
                    placeholder="VD: PA0102030404"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '4px' }}>Cột 2: Tên Khách Hàng</label>
                  <input
                    type="text"
                    placeholder="VD: Nguyễn Văn A"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '4px' }}>Cột 3: Số Tiền (VNĐ)</label>
                  <input
                    type="number"
                    placeholder="VD: 500000"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>
                Thêm Đơn Vào Hệ Thống
              </button>
            </form>

            <form onSubmit={handleChangePassword} style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '10px', border: '1px solid #d1d5db', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {bills.map((bill) => {
              const isActive = bill.status === 'active';
              const isPending = bill.status === 'pending';
              const isUsed = bill.status === 'used';

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
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>
                        Mã: {bill.code}
                      </span>
                      {isActive && <span style={{ fontSize: '12px', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>Sẵn sàng</span>}
                      {isPending && <span style={{ fontSize: '12px', color: '#b45309', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>Đang xử lý</span>}
                      {isUsed && <span style={{ fontSize: '12px', color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '4px' }}>Hoàn tất</span>}
                    </div>

                    {(bill.customer_name || bill.amount) && (
                      <div style={{ backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '8px' }}>
                        {bill.customer_name && <div>👤 <b>Khách hàng:</b> {bill.customer_name}</div>}
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
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Bấm vào ảnh để xem kích thước lớn</div>
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
                        {!isUsed && (
                          <button
                            onClick={() => handleApproveBill(bill.id)}
                            style={{ flex: 1, padding: '8px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                          >
                            ✓ Duyệt Bill
                          </button>
                        )}
                        <button
                          onClick={() => handleRejectBill(bill.id)}
                          style={{ flex: 1, padding: '8px', backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                        >
                          ✕ Từ Chối (Giả)
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
            })}
          </div>
        </>
      )}
    </div>
  );
}