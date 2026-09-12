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
  image?: string;
  type?: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [bills, setBills] = useState<Bill[]>([]);
  const [billType, setBillType] = useState<string>('dien');
  const [newCode, setNewCode] = useState<string>('');

  // State đổi mật khẩu
  const [currentPass, setCurrentPass] = useState<string>('');
  const [newPass, setNewPass] = useState<string>('');
  const [confirmPass, setConfirmPass] = useState<string>('');
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const getAdminPassword = async () => {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'admin_password')
      .single();

    return data?.value || '123456';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = await getAdminPassword();
    if (passwordInput === correctPassword) {
      setIsAuthenticated(true);
      fetchBills();
    } else {
      alert('Mật khẩu không đúng!');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const actualPass = await getAdminPassword();

    if (currentPass !== actualPass) {
      setMsg({ text: 'Mật khẩu hiện tại không đúng!', isError: true });
      return;
    }
    if (newPass.length < 6) {
      setMsg({ text: 'Mật khẩu mới phải từ 6 ký tự trở lên!', isError: true });
      return;
    }
    if (newPass !== confirmPass) {
      setMsg({ text: 'Mật khẩu mới không khớp!', isError: true });
      return;
    }

    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'admin_password', value: newPass }, { onConflict: 'key' });

    if (!error) {
      setMsg({ text: 'Đổi mật khẩu thành công!', isError: false });
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } else {
      setMsg({ text: 'Lỗi: ' + error.message, isError: true });
    }
  };

  const fetchBills = async () => {
    const { data } = await supabase.from('bills').select('*').order('id', { ascending: false });
    if (data) setBills(data);
  };

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;

    const { error } = await supabase
      .from('bills')
      .insert([{ code: newCode.trim(), type: billType, status: 'active' }]);

    if (!error) {
      setNewCode('');
      fetchBills();
    }
  };

  const handleDeleteBill = async (id: number) => {
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (!error) fetchBills();
  };

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '40px', maxWidth: '400px', margin: '80px auto', fontFamily: 'sans-serif', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Đăng Nhập Quản Trị</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="password"
            placeholder="Nhập mật khẩu Admin"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button type="submit" style={{ padding: '10px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Vào Trang Quản Trị
          </button>
        </form>
      </div>
    );
  }

  const filteredBills = bills.filter((b) => (b.type || 'dien') === billType);

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontWeight: '500' }}>Trang Quản Trị Hệ Thống</h2>
        <button onClick={() => setIsAuthenticated(false)} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: '15px' }}>
          Đăng xuất
        </button>
      </div>

      {/* Thanh Chọn Tab giống Người dùng */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => setBillType('dien')}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: billType === 'dien' ? '#2563eb' : '#e5e7eb',
            color: billType === 'dien' ? '#ffffff' : '#374151',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          ⚡ Hóa Đơn Điện
        </button>
        <button
          onClick={() => setBillType('nuoc')}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: billType === 'nuoc' ? '#2563eb' : '#e5e7eb',
            color: billType === 'nuoc' ? '#ffffff' : '#374151',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          💧 Hóa Đơn Nước
        </button>
      </div>

      {/* Form Thêm Đơn */}
      <form onSubmit={handleAddBill} style={{ display: 'flex', gap: '12px', marginBottom: '24px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
        <input
          type="text"
          placeholder={`Nhập mã hóa đơn ${billType === 'dien' ? 'điện' : 'nước'}...`}
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          style={{ flex: 1, padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px' }}
        />
        <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          + Thêm Đơn
        </button>
      </form>

      {/* Danh sách Thẻ (Grid) giống hệt trang Người Dùng */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '40px' }}>
        {filteredBills.map((bill) => {
          const imgUrl = bill.image_url || bill.image;
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
                width: 'calc(33.333% - 11px)',
                minWidth: '280px',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#111827' }}>
                  Mã: {bill.code}
                </span>

                {bill.status === 'active' && (
                  <span style={{ fontSize: '12px', color: '#16a34a', backgroundColor: '#dcfce7', padding: '3px 8px', borderRadius: '4px' }}>
                    Sẵn sàng
                  </span>
                )}
                {bill.status === 'pending' && (
                  <span style={{ fontSize: '12px', color: '#b45309', backgroundColor: '#fef3c7', padding: '3px 8px', borderRadius: '4px' }}>
                    Đang xử lý
                  </span>
                )}
                {bill.status === 'used' && (
                  <span style={{ fontSize: '12px', color: '#dc2626', backgroundColor: '#fee2e2', padding: '3px 8px', borderRadius: '4px' }}>
                    Hoàn tất
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
                <div>
                  {imgUrl ? (
                    <a href={imgUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: '13px', fontWeight: '600' }}>
                      🖼️ Xem ảnh CK
                    </a>
                  ) : (
                    <span style={{ fontSize: '13px', color: '#9ca3af' }}>Chưa có ảnh</span>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteBill(bill.id)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Đổi Mật Khẩu */}
      <div style={{ maxWidth: '400px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>⚙️ Cài Đặt - Đổi Mật Khẩu Admin</h3>
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="password"
            placeholder="Mật khẩu hiện tại"
            value={currentPass}
            onChange={(e) => setCurrentPass(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input
            type="password"
            placeholder="Mật khẩu mới"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input
            type="password"
            placeholder="Nhập lại mật khẩu mới"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
          />

          {msg && (
            <div style={{ color: msg.isError ? 'red' : 'green', fontSize: '13px' }}>
              {msg.text}
            </div>
          )}

          <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cập Nhật Mật Khẩu
          </button>
        </form>
      </div>
    </div>
  );
}