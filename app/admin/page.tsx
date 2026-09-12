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
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: '360px', backgroundColor: '#ffffff', padding: '28px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginTop: 0, textAlign: 'center' }}>Đăng Nhập Admin</h2>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Mật khẩu..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '14px', fontSize: '14px', boxSizing: 'border-box' }}
            />
            <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
              Xác Nhận
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '30px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Quản Lý Admin</h1>
          <button onClick={() => setIsAuthenticated(false)} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#64748b', fontSize: '12px', cursor: 'pointer' }}>
            Đăng xuất
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', justifyContent: 'center', maxWidth: '300px', margin: '0 auto 20px auto', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '10px' }}>
          <button
            onClick={() => setBillType('dien')}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              backgroundColor: billType === 'dien' ? '#2563eb' : 'transparent',
              color: billType === 'dien' ? '#ffffff' : '#64748b',
            }}
          >
            ⚡ Tiền Điện
          </button>
          <button
            onClick={() => setBillType('nuoc')}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              backgroundColor: billType === 'nuoc' ? '#2563eb' : 'transparent',
              color: billType === 'nuoc' ? '#ffffff' : '#64748b',
            }}
          >
            💧 Tiền Nước
          </button>
        </div>

        {/* Import Box */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', marginTop: 0, marginBottom: '8px' }}>➕ Nạp Thêm Mã Mới</h3>
          <textarea
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Cú pháp: Mã | Tên Chủ Hộ | Số Tiền"
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box', marginBottom: '8px', outline: 'none' }}
          />
          <button
            onClick={handleImport}
            disabled={loading}
            style={{ padding: '6px 14px', backgroundColor: '#059669', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}
          >
            {loading ? 'Đang nạp...' : 'Nạp Vào Hệ Thống'}
          </button>
        </div>

        {/* Admin Cards Grid */}
        {bills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#94a3b8' }}>
            Không có dữ liệu.
          </div>
        ) : (
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
                    borderRadius: '10px',
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '15px', color: '#0f172a', fontFamily: 'monospace' }}>{bill.code}</strong>

                      {isActive && <span style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>Sẵn Sàng</span>}
                      {isPending && <span style={{ backgroundColor: '#fefce8', color: '#854d0e', border: '1px solid #fef08a', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>Đang Xử Lý</span>}
                      {isUsed && <span style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>Đã Thanh Toán</span>}
                    </div>

                    <div style={{ fontSize: '12px', color: '#475569', marginBottom: '12px' }}>
                      <div>Chủ hộ: <strong>{bill.owner_name}</strong></div>
                      <div>Số tiền: <strong style={{ color: '#2563eb' }}>{bill.amount.toLocaleString('vi-VN')} VNĐ</strong></div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                    <div>
                      {bill.bill_image ? (
                        <button
                          onClick={() => setPreviewImage(bill.bill_image || null)}
                          style={{ border: 'none', backgroundColor: '#eff6ff', color: '#2563eb', padding: '4px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '11px', cursor: 'pointer' }}
                        >
                          🔍 Xem Bill
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Chưa có bill</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {isPending && (
                        <>
                          <button
                            onClick={() => handleApprove(bill.id)}
                            style={{ padding: '4px 8px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '4px', fontWeight: '600', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Duyệt
                          </button>
                          <button
                            onClick={() => handleCancel(bill.id)}
                            style={{ padding: '4px 8px', backgroundColor: '#eab308', color: '#ffffff', border: 'none', borderRadius: '4px', fontWeight: '600', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Hủy
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(bill.id)}
                        style={{ padding: '4px 8px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', fontWeight: '600', fontSize: '11px', cursor: 'pointer' }}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Popup Preview Image */}
        {previewImage && (
          <div
            onClick={() => setPreviewImage(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 9999,
              padding: '20px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }} onClick={(e) => e.stopPropagation()}>
              <img src={previewImage} alt="Bill" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '8px', display: 'block', margin: '0 auto' }} />
              <button
                onClick={() => setPreviewImage(null)}
                style={{
                  marginTop: '12px',
                  padding: '6px 16px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '12px',
                  display: 'block',
                  margin: '12px auto 0 auto',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}