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
  const [newCode, setNewCode] = useState<string>('');
  const [newType, setNewType] = useState<string>('dien');

  // State đổi mật khẩu
  const [currentPass, setCurrentPass] = useState<string>('');
  const [newPass, setNewPass] = useState<string>('');
  const [confirmPass, setConfirmPass] = useState<string>('');
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Lấy mật khẩu hiện tại từ Supabase
  const getAdminPassword = async () => {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'admin_password')
      .single();

    return data?.value || '123456';
  };

  // Đăng nhập Admin
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

  // Đổi mật khẩu
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
      setMsg({ text: 'Mật khẩu mới nhập lại không khớp!', isError: true });
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

  // Chuyển đổi hiển thị trạng thái tiếng Việt
  const renderStatus = (status: string) => {
    if (status === 'active') return <span style={{ color: '#16a34a', fontWeight: 'bold' }}>Sẵn sàng</span>;
    if (status === 'pending') return <span style={{ color: '#b45309', fontWeight: 'bold' }}>Đang xử lý</span>;
    if (status === 'used') return <span style={{ color: '#dc2626', fontWeight: 'bold' }}>Đã xong</span>;
    return status;
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
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif', color: '#333' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontWeight: '500' }}>Trang Quản Trị Hệ Thống</h2>
        <button onClick={() => setIsAuthenticated(false)} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: '15px' }}>
          Đăng xuất
        </button>
      </div>

      {/* Form Thêm Đơn */}
      <form onSubmit={handleAddBill} style={{ display: 'flex', gap: '12px', marginBottom: '24px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Nhập mã hóa đơn..."
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          style={{ flex: 1, padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }}
        />
        <select 
          value={newType} 
          onChange={(e) => setNewType(e.target.value)} 
          style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '14px', cursor: 'pointer' }}
        >
          <option value="dien">⚡ Điện</option>
          <option value="nuoc">💧 Nước</option>
        </select>
        <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
          + Thêm Đơn
        </button>
      </form>

      {/* Bảng Quản Lý Đơn */}
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: '40px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', width: '50px' }}>ID</th>
            <th style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0' }}>Mã Đơn</th>
            <th style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', width: '100px' }}>Loại</th>
            <th style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', width: '120px' }}>Trạng Thái</th>
            <th style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', width: '100px' }}>Ảnh CK</th>
            <th style={{ padding: '12px 16px', width: '100px' }}>Hành Động</th>
          </tr>
        </thead>
        <tbody>
          {bills.map((bill) => {
            const imgUrl = bill.image_url || bill.image;
            return (
              <tr key={bill.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0' }}>{bill.id}</td>
                <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', fontWeight: 'bold' }}>{bill.code}</td>
                <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0' }}>
                  {bill.type === 'dien' ? '⚡ Điện' : '💧 Nước'}
                </td>
                <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0' }}>
                  {renderStatus(bill.status)}
                </td>
                <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0' }}>
                  {imgUrl ? (
                    <a href={imgUrl} target="_blank" rel="noreferrer" style={{ color: '#0070f3', fontWeight: 'bold' }}>
                      Xem ảnh
                    </a>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Chưa có</span>
                  )}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={() => handleDeleteBill(bill.id)} style={{ padding: '6px 12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Xóa
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Đổi Mật Khẩu Admin ở dưới cùng */}
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