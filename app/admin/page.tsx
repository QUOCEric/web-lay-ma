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
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [bills, setBills] = useState<Bill[]>([]);
  const [billType, setBillType] = useState<string>('dien');

  // Thêm bill mới
  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState('dien');

  // Đổi mật khẩu
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

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBills();

      const channel = supabase
        .channel('admin_realtime_bills')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, () => {
          fetchBills();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAuthenticated, billType]);

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;

    const { error } = await supabase.from('bills').insert([
      { code: newCode.trim(), type: newType, status: 'active' }
    ]);

    if (!error) {
      setNewCode('');
      fetchBills();
      alert('Thêm mã thành công!');
    } else {
      alert('Lỗi thêm mã: ' + error.message);
    }
  };

  const handleDeleteBill = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa mã này?')) return;
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (!error) fetchBills();
  };

  // Nút DUYỆT BILL
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

  // Nút HỦY / TỪ CHỐI BILL GIẢ
  const handleRejectBill = async (id: number) => {
    if (!confirm('Xác nhận TỪ CHỐI bill này? Mã sẽ được đưa về trạng thái Sẵn sàng để người khác lấy.')) return;

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
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, color: '#111827' }}>⚙️ Quản Lý Hệ Thống Hóa Đơn</h2>
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

      {/* Khung Thêm Mã & Đổi Mật Khẩu */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        <form onSubmit={handleAddBill} style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h4 style={{ marginTop: 0, marginBottom: '12px' }}>➕ Thêm Mã Mới</h4>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <option value="dien">Điện</option>
              <option value="nuoc">Nước</option>
            </select>
            <input
              type="text"
              placeholder="Nhập mã hóa đơn..."
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
          </div>
          <button type="submit" style={{ width: '100%', padding: '8px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            Thêm Mã
          </button>
        </form>

        <form onSubmit={handleChangePassword} style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h4 style={{ marginTop: 0, marginBottom: '12px' }}>🔑 Đổi Mật Khẩu Admin</h4>
          <input
            type="password"
            placeholder="Mật khẩu mới..."
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
          />
          <button type="submit" style={{ width: '100%', padding: '8px', backgroundColor: '#4b5563', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            Lưu Mật Khẩu
          </button>
        </form>
      </div>

      {/* Tabs Chuyển Loại Hóa Đơn */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => setBillType('dien')}
          style={{
            padding: '10px 20px',
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
            padding: '10px 20px',
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

      {/* Danh Sách Hóa Đơn Dạng Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
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

                {/* Hiển thị ảnh chuyển khoản nếu có */}
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

              {/* Các nút hành động cho Admin */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {/* Nút Duyệt / Từ chối khi người dùng đã gửi bill */}
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
    </div>
  );
}