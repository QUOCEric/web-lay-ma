'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [billType, setBillType] = useState<'dien' | 'nuoc'>('dien');
  const [rawText, setRawText] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '123') {
      setAuthenticated(true);
    } else {
      alert('Mật khẩu không đúng!');
    }
  };

  const handleImport = async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    setMessage('');

    const lines = rawText.split('\n').filter((l) => l.trim() !== '');
    const records = lines.map((line) => {
      const parts = line.split('|').map((item) => item.trim());
      return {
        code: parts[0] || '',
        owner_name: parts[1] || 'Chưa cập nhật',
        amount: parseFloat(parts[2]) || 0,
        type: billType,
        status: 'active',
      };
    }).filter((r) => r.code !== '');

    if (records.length === 0) {
      setMessage('Không tìm thấy dữ liệu hợp lệ!');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('bills').insert(records);
    setLoading(false);

    if (error) {
      setMessage(`Lỗi: ${error.message}`);
    } else {
      setMessage(`Thành công! Đã thêm ${records.length} mã hóa đơn.`);
      setRawText('');
    }
  };

  if (!authenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <form onSubmit={handleLogin} style={{ padding: '30px', border: '1px solid #ccc', borderRadius: '8px', textAlign: 'center' }}>
          <h2>Quản Trị Hệ Thống</h2>
          <input
            type="password"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '10px', width: '100%', marginBottom: '15px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Đăng Nhập
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: '30px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>Trang Nhập Mã Hóa Đơn</h2>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ marginRight: '15px', fontWeight: 'bold' }}>Loại hóa đơn:</label>
        <select value={billType} onChange={(e) => setBillType(e.target.value as 'dien' | 'nuoc')} style={{ padding: '8px', borderRadius: '4px' }}>
          <option value="dien">Tiền Điện</option>
          <option value="nuoc">Tiền Nước</option>
        </select>
      </div>

      <p style={{ fontSize: '13px', color: '#666' }}>
        Nhập theo định dạng mỗi dòng: <strong>Mã | Tên Chủ Mã | Số Tiền</strong><br />
        Ví dụ: <i>PA01020304 | Nguyen Van A | 250000</i>
      </p>

      <textarea
        rows={8}
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="PA01020304 | Nguyen Van A | 250000&#10;PA01020305 | Tran Thi B | 180000"
        style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '15px' }}
      />

      <button
        onClick={handleImport}
        disabled={loading}
        style={{ padding: '12px 24px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
      >
        {loading ? 'Đang nạp...' : 'Nạp Mã Vào Hệ Thống'}
      </button>

      {message && <p style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e0f2fe', borderRadius: '4px' }}>{message}</p>}
    </div>
  );
}