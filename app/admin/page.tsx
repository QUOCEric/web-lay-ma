'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ADMIN_PASSWORD = '123'; 

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  
  const [billType, setBillType] = useState('dien');
  const [rawCodes, setRawCodes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setMessage('');
    } else {
      alert('Mật khẩu không chính xác!');
    }
  };

  const handleAddCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawCodes.trim()) {
      alert('Vui lòng nhập danh sách mã!');
      return;
    }

    setLoading(true);
    setMessage('');

    const codeList = rawCodes
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const payload = codeList.map((code) => ({
      code: code,
      type: billType,
      status: 'active'
    }));

    const { error } = await supabase.from('bills').insert(payload);

    setLoading(false);
    if (error) {
      setMessage(`Lỗi khi lưu mã: ${error.message}`);
    } else {
      setMessage(`Thêm thành công ${codeList.length} mã (${billType === 'dien' ? 'Mã Điện' : 'Mã Nước'})!`);
      setRawCodes('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: '400px', margin: '80px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', textAlign: 'center' }}>
        <h2>Đăng Nhập Quản Trị (Admin)</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
          <input
            type="password"
            placeholder="Nhập mật khẩu Admin"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            style={{ padding: '10px', fontSize: '16px' }}
          />
          <button type="submit" style={{ padding: '10px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Đăng nhập
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h2>Trang Nạp Mã Hóa Đơn Hàng Tháng</h2>
      
      <form onSubmit={handleAddCodes} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
        <div>
          <label style={{ fontWeight: 'bold' }}>Loại mã: </label>
          <select 
            value={billType} 
            onChange={(e) => setBillType(e.target.value)}
            style={{ padding: '8px', fontSize: '15px', marginLeft: '10px' }}
          >
            <option value="dien">Mã Điện</option>
            <option value="nuoc">Mã Nước</option>
          </select>
        </div>

        <div>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
            Danh sách mã (Mỗi mã nằm trên 1 dòng):
          </label>
          <textarea
            rows={10}
            placeholder={`PA01001\nPA01002\nPA01003`}
            value={rawCodes}
            onChange={(e) => setRawCodes(e.target.value)}
            style={{ width: '100%', padding: '10px', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            padding: '12px', 
            backgroundColor: loading ? '#ccc' : '#28a745', 
            color: '#fff', 
            fontSize: '16px', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: loading ? 'not-allowed' : 'pointer' 
          }}
        >
          {loading ? 'Đang cập nhật...' : 'Nạp Mã Vào Hệ Thống'}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: '20px', color: message.startsWith('Lỗi') ? 'red' : 'green', fontWeight: 'bold' }}>
          {message}
        </p>
      )}
    </div>
  );
}