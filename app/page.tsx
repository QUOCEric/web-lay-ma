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
  amount?: number;
  owner_name?: string;
  billing_month?: string;
  is_valid?: boolean;
}

export default function HomePage() {
  const [billType, setBillType] = useState<string>('dien');
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchAvailableBills = async () => {
    setLoading(true);
    // Chỉ lấy mã active và bắt buộc là mã sống (is_valid = true)
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('type', billType)
      .eq('status', 'active')
      .eq('is_valid', true)
      .order('id', { ascending: true });

    if (!error && data) {
      setBills(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAvailableBills();
    setSelectedBill(null);

    const channel = supabase
      .channel('client_realtime_bills')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, () => {
        fetchAvailableBills();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [billType]);

  const handleSelectBill = async (bill: Bill) => {
    await supabase
      .from('bills')
      .update({ status: 'pending' })
      .eq('id', bill.id);

    setSelectedBill(bill);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`Đã copy mã: ${code}`);
  };

  const handleUploadBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedBill) {
      alert('Vui lòng chọn ảnh chuyển khoản!');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('bills')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('bills')
        .getPublicUrl(fileName);

      const imageUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('bills')
        .update({
          image_url: imageUrl,
          status: 'pending'
        })
        .eq('id', selectedBill.id);

      if (updateError) throw updateError;

      await supabase.from('bill_history').insert({
        bill_id: selectedBill.id,
        code: selectedBill.code,
        type: billType,
        image_url: imageUrl
      });

      alert('🎉 Gửi bill chuyển khoản thành công!');
      setSelectedBill(null);
      setFile(null);
      fetchAvailableBills();
    } catch (err: any) {
      alert('Lỗi upload bill: ' + (err.message || 'Không thể tải ảnh lên'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ color: '#111827', fontSize: '24px', marginBottom: '8px' }}>⚡ Hệ Thống Nhận Mã Hóa Đơn</h1>
        <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>
          Chọn dịch vụ và nhấp chọn đơn hàng bạn muốn thanh toán bên dưới
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px auto' }}>
        <button
          onClick={() => setBillType('dien')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: billType === 'dien' ? '#2563eb' : '#f3f4f6',
            color: billType === 'dien' ? '#ffffff' : '#374151',
            fontWeight: 'bold',
            fontSize: '15px',
            cursor: 'pointer'
          }}
        >
          ⚡ Điện
        </button>
        <button
          onClick={() => setBillType('nuoc')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: billType === 'nuoc' ? '#2563eb' : '#f3f4f6',
            color: billType === 'nuoc' ? '#ffffff' : '#374151',
            fontWeight: 'bold',
            fontSize: '15px',
            cursor: 'pointer'
          }}
        >
          💧 Nước
        </button>
        <button
          onClick={() => setBillType('internet')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: billType === 'internet' ? '#2563eb' : '#f3f4f6',
            color: billType === 'internet' ? '#ffffff' : '#374151',
            fontWeight: 'bold',
            fontSize: '15px',
            cursor: 'pointer'
          }}
        >
          🌐 Internet
        </button>
      </div>

      {!selectedBill ? (
        <div>
          <h3 style={{ fontSize: '16px', color: '#374151', marginBottom: '16px', textAlign: 'center' }}>
            Danh sách mã đơn đang có sẵn:
          </h3>

          {loading ? (
            <p style={{ textAlign: 'center', color: '#6b7280' }}>⏳ Đang tải danh sách mã...</p>
          ) : bills.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#ef4444', fontWeight: 'bold' }}>
              Hiện tại đã hết mã khả dụng cho dịch vụ này. Vui lòng quay lại sau!
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px'
              }}
            >
              {bills.map((bill) => (
                <div
                  key={bill.id}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '2px solid #2563eb',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    textAlign: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Mã Đơn</div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb' }}>{bill.code}</span>
                      <button
                        onClick={() => handleCopyCode(bill.code)}
                        title="Copy mã đơn"
                        style={{ padding: '2px 6px', fontSize: '11px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        📋
                      </button>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', fontSize: '13px', textAlign: 'left', marginBottom: '12px' }}>
                      {bill.owner_name && (
                        <div style={{ marginBottom: '4px' }}>👤 {bill.owner_name}</div>
                      )}
                      {bill.amount && bill.amount > 0 ? (
                        <div style={{ color: '#16a34a', fontWeight: 'bold' }}>
                          💵 {bill.amount.toLocaleString('vi-VN')} VNĐ
                        </div>
                      ) : (
                        <div style={{ color: '#9ca3af' }}>💵 Chưa có giá</div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectBill(bill)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    👉 Chọn Mã Này
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <button
            onClick={() => {
              setSelectedBill(null);
              fetchAvailableBills();
            }}
            style={{ padding: '6px 12px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}
          >
            ← Chọn mã khác
          </button>

          <div style={{ textAlign: 'center', paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: '13px', color: '#6b7280', textTransform: 'uppercase' }}>Mã Đơn Đã Chọn</span>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
              <span style={{ fontSize: '28px', fontWeight: '800', color: '#2563eb' }}>{selectedBill.code}</span>
              <button
                onClick={() => handleCopyCode(selectedBill.code)}
                style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                📋 Copy
              </button>
            </div>

            {(selectedBill.owner_name || (selectedBill.amount && selectedBill.amount > 0)) && (
              <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '14px', textAlign: 'left' }}>
                {selectedBill.owner_name && <div>👤 <b>Khách hàng:</b> {selectedBill.owner_name}</div>}
                {selectedBill.amount && selectedBill.amount > 0 && <div>💵 <b>Số tiền:</b> {selectedBill.amount.toLocaleString('vi-VN')} VNĐ</div>}
              </div>
            )}
          </div>

          <form onSubmit={handleUploadBill}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>
              📸 Tải Ảnh Chuyển Khoản Bill
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ width: '100%', padding: '8px', marginBottom: '16px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
            />

            <button
              type="submit"
              disabled={uploading || !file}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: file ? '#2563eb' : '#9ca3af',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '15px',
                cursor: file ? 'pointer' : 'not-allowed'
              }}
            >
              {uploading ? '⏳ Đang tải bill...' : '📤 Xác Nhận Gửi Bill'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}