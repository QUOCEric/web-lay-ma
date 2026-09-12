'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [billType, setBillType] = useState<'dien' | 'nuoc'>('dien');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '123') {
      setIsAuthenticated(true);
    } else {
      alert('Mật khẩu không đúng!');
    }
  };

  const handleImport = async () => {
    if (!inputText.trim()) {
      alert('Vui lòng nhập dữ liệu!');
      return;
    }

    setLoading(true);
    const lines = inputText.trim().split('\n');
    const newBills = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length >= 3) {
        newBills.push({
          code: parts[0],
          owner_name: parts[1],
          amount: parseFloat(parts[2]) || 0,
          type: billType,
          status: 'active', // Ép buộc trạng thái luôn là Sẵn Sàng khi mới nạp
        });
      }
    }

    if (newBills.length === 0) {
      alert('Định dạng dữ liệu không đúng! Ví dụ: Mã | Tên | Số tiền');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('bills').insert(newBills);
    setLoading(false);

    if (error) {
      alert('Lỗi khi nạp mã: ' + error.message);
    } else {
      alert(`Thành công! Đã thêm ${newBills.length} mã hóa đơn.`);
      setInputText('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '40px', maxWidth: '400px', margin: '0 auto', fontFamily: 'sans-serif' }}>
        <h2>Đăng Nhập Admin</h2>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Nhập mật khẩu..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box' }}
          />
          <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Đăng Nhập
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>Trang Quản Lý Admin - Nạp Mã Hóa Đơn</h2>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Loại hóa đơn:</label>
        <select
          value={billType}
          onChange={(e) => setBillType(e.target.value as 'dien' | 'nuoc')}
          style={{ padding: '8px', fontSize: '14px' }}
        >
          <option value="dien">Tiền Điện</option>
          <option value="nuoc">Tiền Nước</option>
        </select>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
          Nhập danh sách mã (Định dạng: Mã | Tên Chủ Mã | Số Tiền):
        </label>
        <textarea
          rows={10}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`PA01020304 | Nguyễn Văn A | 250000\nPA01020305 | Trần Thị B | 180000`}
          style={{ width: '100%', padding: '10px', fontFamily: 'monospace', boxSizing: 'border-box' }}
        />
      </div>

      <button
        onClick={handleImport}
        disabled={loading}
        style={{
          padding: '12px 20px',
          backgroundColor: '#059669',
          color: '#fff',
          border: 'none',
          fontWeight: 'bold',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        {loading ? 'Đang nạp...' : 'Nạp Mã Vào Hệ Thống'}
      </button>
    </div>
  );
}