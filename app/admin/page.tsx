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
  const [activeTab, setActiveTab] = useState<'bills' | 'settings'>('bills');

  // Trạng thái cho Cài đặt đổi mật khẩu
  const [currentPass, setCurrentPass] = useState<string>('');
  const [newPass, setNewPass] = useState<string>('');
  const [confirmPass, setConfirmPass] = useState<string>('');
  const [settingsMsg, setSettingsMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Quản lý đơn
  const [bills, setBills] = useState<Bill[]>([]);
  const [newCode, setNewCode] = useState<string>('');
  const [newType, setNewType] = useState<string>('dien');

  // Lấy mật khẩu Admin hiện tại từ Supabase (Mặc định: '123456' nếu chưa cài)
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
      setSettingsMsg({ text: 'Mật khẩu không đúng!', isError: true });
    }
  };

  // Đổi mật khẩu Admin
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMsg(null);

    const actualPass = await getAdminPassword();

    if (currentPass !== actualPass) {
      setSettingsMsg({ text: 'Mật khẩu hiện tại không đúng!', isError: true });
      return;
    }

    if (newPass.length < 6) {
      setSettingsMsg({ text: 'Mật khẩu mới phải có ít nhất 6 ký tự!', isError: true });
      return;
    }

    if (newPass !== confirmPass) {
      setSettingsMsg({ text: 'Mật khẩu mới nhập lại không khớp!', isError: true });
      return;
    }

    // Cập nhật hoặc Thêm mới mật khẩu vào bảng settings
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'admin_password', value: newPass }, { onConflict: 'key' });

    if (error) {
      setSettingsMsg({ text: 'Lỗi lưu mật khẩu: ' + error.message, isError: true });
    } else {
      setSettingsMsg({ text: 'Đổi mật khẩu thành công!', isError: false });
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
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

  // Nếu chưa Đăng nhập
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
          {settingsMsg && (
            <div style={{ color: settingsMsg.isError ? 'red' : 'green', fontSize: '14px', textAlign: 'center' }}>
              {settingsMsg.text}
            </div>
          )}
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

      {/* Menu Chuyển Tab */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '2px solid #eee', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('bills')}
          style={{
            padding: '8px 16px',
            border: 'none',
            backgroundColor: activeTab === 'bills' ? '#0070f3' : '#e0e0e0',
            color: activeTab === 'bills' ? '#fff' : '#000',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          📋 Quản Lý Đơn
        </button>
        <button
          onClick={() => { setActiveTab('settings'); setSettingsMsg(null); }}
          style={{
            padding: '8px 16px',
            border: 'none',
            backgroundColor: activeTab === 'settings' ? '#0070f3' : '#e0e0e0',
            color: activeTab === 'settings' ? '#fff' : '#000',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ⚙️ Cài Đặt Mật Khẩu
        </button>
      </div>

      {/* TAB 1: QUẢN LÝ ĐƠN */}
      {activeTab === 'bills' && (
        <div>
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
      )}

      {/* TAB 2: CÀI ĐẶT MẬT KHẨU */}
      {activeTab === 'settings' && (
        <div style={{ maxWidth: '400px', backgroundColor: '#f9f9f9', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Đổi Mật Khẩu Admin</h3>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="password"
              placeholder="Mật khẩu hiện tại"
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <input
              type="password"
              placeholder="Mật khẩu mới"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <input
              type="password"
              placeholder="Nhập lại mật khẩu mới"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />

            {settingsMsg && (
              <div style={{ color: settingsMsg.isError ? 'red' : 'green', fontSize: '14px' }}>
                {settingsMsg.text}
              </div>
            )}

            <button type="submit" style={{ padding: '10px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              Lưu Mật Khẩu Mới
            </button>
          </form>
        </div>
      )}
    </div>
  );
}