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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [bills, setBills] = useState<Bill[]>([]);
  const [newCode, setNewCode] = useState<string>('');
  const [newType, setNewType] = useState<string>('dien');

  // Đăng nhập Admin
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '123456') {
      setIsAuthenticated(true);
      fetchBills();
    } else {
      alert('Mật khẩu không đúng!');
    }
  };

  // Tải danh sách đơn
  const fetchBills = async () => {
    const { data } = await supabase.from('bills').select('*').order('id', { ascending: false });
    if (data) setBills(data);
  };

  // Thêm đơn mới
  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;

    const { error } = await supabase
      .from('bills')
      .insert([{ code: newCode.trim(), type: newType, status: 'active' }]);

    if (!error) {
      setNewCode('');
      fetchBills();
    }
  };

  // Xóa đơn
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

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>Trang Quản Trị Hệ Thống</h1>
        <button onClick={() => setIsAuthenticated(false)} style={{ padding: '6px 12px', cursor: 'pointer' }}>
          Đăng xuất
        </button>
      </div>

      <form onSubmit={handleAddBill} style={{ display: 'flex', gap: '12px', marginBottom: '24px', backgroundColor: '#f9f9f9', padding: '16px', borderRadius: '8px' }}>
        <input
          type="text"
          placeholder="Nhập mã hóa đơn..."
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ padding: '8px', borderRadius: '4px' }}>
          <option value="dien">⚡ Điện</option>
          <option value="nuoc">💧 Nước</option>
        </select>
        <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          + Thêm Đơn
        </button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9' }}>
            <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>ID</th>
            <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Mã Đơn</th>
            <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Loại</th>
            <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Trạng Thái</th>
            <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Ảnh CK</th>
            <th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>Hành Động</th>
          </tr>
        </thead>
        <tbody>
          {bills.map((bill) => (
            <tr key={bill.id}>
              <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{bill.id}</td>
              <td style={{ padding: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>{bill.code}</td>
              <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{bill.type === 'dien' ? '⚡ Điện' : '💧 Nước'}</td>
              <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>{bill.status}</td>
              <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>
                {bill.image_url ? (
                  <a href={bill.image_url} target="_blank" rel="noreferrer" style={{ color: '#0070f3' }}>
                    Xem ảnh
                  </a>
                ) : (
                  'Chưa có'
                )}
              </td>
              <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>
                <button onClick={() => handleDeleteBill(bill.id)} style={{ padding: '4px 8px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Xóa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}