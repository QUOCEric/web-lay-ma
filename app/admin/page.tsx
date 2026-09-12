'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Bill {
  id: number;
  code: string;
  owner_name: string;
  amount: number;
  type: string;
  status: 'active' | 'pending' | 'used';
  bill_image?: string;
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [billType, setBillType] = useState<'dien' | 'nuoc'>('dien');
  const [inputText, setInputText] = useState('');
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchBills = async () => {
    const { data } = await supabase
      .from('bills')
      .select('*')
      .eq('type', billType)
      .order('id', { ascending: false });
    if (data) setBills(data);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchBills();
    }
  }, [isAuthenticated, billType]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '123') {
      setIsAuthenticated(true);
    } else {
      alert('Mật khẩu không đúng!');
    }
  };

  const handleImport = async () => {
    if (!inputText.trim()) return;
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
          status: 'active',
        });
      }
    }

    const { error } = await supabase.from('bills').insert(newBills);
    setLoading(false);

    if (error) {
      alert('Lỗi: ' + error.message);
    } else {
      alert('Nạp mã thành công!');
      setInputText('');
      fetchBills();
    }
  };

  const handleApprove = async (id: number) => {
    await supabase.from('bills').update({ status: 'used' }).eq('id', id);
    fetchBills();
  };

  const handleCancel = async (id: number) => {
    await supabase.from('bills').update({ status: 'active', bill_image: null }).eq('id', id);
    fetchBills();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Bạn có chắc chắn muốn xóa mã này khỏi hệ thống?')) {
      await supabase.from('bills').delete().eq('id', id);
      fetchBills();
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
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#1e293b' }}>Trang Quản Lý Admin</h1>

      {/* Chuyển tab Điện / Nước */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setBillType('dien')}
          style={{
            padding: '10px 20px',
            backgroundColor: billType === 'dien' ? '#2563eb' : '#e2e8f0',
            color: billType === 'dien' ? '#fff' : '#0f172a',
            border: 'none',
            borderRadius: '5px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Tiền Điện
        </button>
        <button
          onClick={() => setBillType('nuoc')}
          style={{
            padding: '10px 20px',
            backgroundColor: billType === 'nuoc' ? '#2563eb' : '#e2e8f0',
            color: billType === 'nuoc' ? '#fff' : '#0f172a',
            border: 'none',
            borderRadius: '5px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Tiền Nước
        </button>
      </div>

      {/* Khung nạp mã */}
      <div style={{ border: '1px solid #cbd5e1', padding: '15px', borderRadius: '8px', marginBottom: '30px', backgroundColor: '#f8fafc' }}>
        <h3 style={{ marginTop: 0 }}>Nạp Thêm Mã Mới</h3>
        <textarea
          rows={4}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="PA01020304 | Nguyễn Văn A | 250000"
          style={{ width: '100%', padding: '10px', display: 'block', marginBottom: '10px', boxSizing: 'border-box' }}
        />
        <button onClick={handleImport} disabled={loading} style={{ padding: '10px 20px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          {loading ? 'Đang nạp...' : 'Nạp Mã Vào Hệ Thống'}
        </button>
      </div>

      {/* Danh sách */}
      <h3>Danh Sách Mã ({billType === 'dien' ? 'Tiền Điện' : 'Tiền Nước'})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {bills.length === 0 ? (
          <p style={{ color: '#64748b' }}>Không có mã nào.</p>
        ) : (
          bills.map((bill) => (
            <div
              key={bill.id}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '15px',
                backgroundColor: bill.status === 'used' ? '#fef2f2' : bill.status === 'pending' ? '#fffbeb' : '#f0fdf4',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <strong>Mã:</strong> {bill.code} <br />
                  <strong>Chủ Hóa Đơn:</strong> {bill.owner_name} <br />
                  <strong>Số Tiền:</strong> {bill.amount.toLocaleString('vi-VN')} VNĐ
                </div>

                <div>
                  {bill.status === 'active' && (
                    <span style={{ backgroundColor: '#22c55e', color: '#fff', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                      Sẵn Sàng
                    </span>
                  )}
                  {bill.status === 'pending' && (
                    <span style={{ backgroundColor: '#eab308', color: '#fff', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                      Đang Xử Lý
                    </span>
                  )}
                  {bill.status === 'used' && (
                    <span style={{ backgroundColor: '#ef4444', color: '#fff', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                      Đã Thanh Toán
                    </span>
                  )}
                </div>
              </div>

              {/* Thao tác Admin */}
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {bill.bill_image ? (
                    <button
                      onClick={() => setPreviewImage(bill.bill_image || null)}
                      style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      🔍 Xem Ảnh Bill Chuyển Khoản
                    </button>
                  ) : (
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>Chưa có ảnh bill</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {bill.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(bill.id)}
                        style={{ padding: '6px 12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                      >
                        Duyệt Đơn
                      </button>
                      <button
                        onClick={() => handleCancel(bill.id)}
                        style={{ padding: '6px 12px', backgroundColor: '#eab308', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                      >
                        Hủy (Về Sẵn Sàng)
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(bill.id)}
                    style={{ padding: '6px 12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                  >
                    Xóa Mã
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Popup Xem Ảnh trực tiếp */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '20px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }} onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="Bill chuyển khoản" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '8px', display: 'block', margin: '0 auto' }} />
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                marginTop: '15px',
                padding: '10px 20px',
                backgroundColor: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'block',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              Đóng Xem Ảnh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}