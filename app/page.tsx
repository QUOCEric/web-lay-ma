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
  customer_name?: string;
}

export default function HomePage() {
  const [billType, setBillType] = useState<string>('dien');
  const [currentBill, setCurrentBill] = useState<Bill | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingBill, setLoadingBill] = useState(false);

  // Lấy mã đơn chưa sử dụng (status = 'active')
  const handleGetCode = async () => {
    setLoadingBill(true);
    setCurrentBill(null);

    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('type', billType)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (error) {
      alert('Có lỗi xảy ra khi lấy mã: ' + error.message);
    } else if (!data) {
      alert('Hiện tại đã hết mã khả dụng cho dịch vụ này. Vui lòng quay lại sau!');
    } else {
      // Đánh dấu mã này đang chờ xử lý
      await supabase
        .from('bills')
        .update({ status: 'pending' })
        .eq('id', data.id);

      setCurrentBill(data);
    }
    setLoadingBill(false);
  };

  // Upload bill chuyển khoản
  const handleUploadBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !currentBill) {
      alert('Vui lòng chọn ảnh chuyển khoản!');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload ảnh vào Storage bucket 'bills'
      const { error: uploadError } = await supabase.storage
        .from('bills')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      // Lấy URL công khai của ảnh
      const { data: publicUrlData } = supabase.storage
        .from('bills')
        .getPublicUrl(fileName);

      const imageUrl = publicUrlData.publicUrl;

      // Cập nhật URL ảnh và trạng thái bill
      const { error: updateError } = await supabase
        .from('bills')
        .update({
          image_url: imageUrl,
          status: 'pending'
        })
        .eq('id', currentBill.id);

      if (updateError) {
        throw updateError;
      }

      // Lưu lịch sử gửi bill
      await supabase.from('bill_history').insert({
        bill_id: currentBill.id,
        code: currentBill.code,
        type: billType,
        image_url: imageUrl
      });

      alert('🎉 Gửi bill chuyển khoản thành công! Vui lòng chờ Admin duyệt.');
      setCurrentBill(null);
      setFile(null);
    } catch (err: any) {
      alert('Lỗi upload bill: ' + (err.message || 'Không thể tải ảnh lên'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ color: '#111827', fontSize: '24px', marginBottom: '8px' }}>⚡ Hệ Thống Nhận Mã Hóa Đơn</h1>
        <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>
          Chọn loại dịch vụ và nhấn lấy mã để nhận thông tin thanh toán
        </p>
      </div>

      {/* CHỌN LOẠI HÓA ĐƠN */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => {
            setBillType('dien');
            setCurrentBill(null);
          }}
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
          ⚡ Hóa Đơn Điện
        </button>
        <button
          onClick={() => {
            setBillType('nuoc');
            setCurrentBill(null);
          }}
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
          💧 Hóa Đơn Nước
        </button>
      </div>

      {/* NÚT LẤY MÃ (KHI CHƯA LẤY) */}
      {!currentBill && (
        <button
          onClick={handleGetCode}
          disabled={loadingBill}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: '#16a34a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '16px',
            cursor: loadingBill ? 'not-allowed' : 'pointer'
          }}
        >
          {loadingBill ? '⏳ Đang lấy mã...' : `🚀 Bấm Để Lấy Mã (${billType === 'dien' ? 'Điện' : 'Nước'})`}
        </button>
      )}

      {/* KHUNG THÔNG TIN MÃ ĐƠN HÀNG ĐÃ LẤY */}
      {currentBill && (
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ textAlign: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '16px', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mã Đơn Hàng Của Bạn</span>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#2563eb', margin: '4px 0' }}>
              {currentBill.code}
            </div>
          </div>

          {/* HIỆN CHI TIẾT TÊN KHÁCH HÀNG & SỐ TIỀN BÊN DƯỚI */}
          <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
              <span style={{ color: '#6b7280' }}>Loại dịch vụ:</span>
              <span style={{ fontWeight: 'bold', color: '#111827' }}>
                {billType === 'dien' ? '⚡ Điện' : '💧 Nước'}
              </span>
            </div>

            {currentBill.customer_name && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                <span style={{ color: '#6b7280' }}>Tên khách hàng:</span>
                <span style={{ fontWeight: 'bold', color: '#111827' }}>{currentBill.customer_name}</span>
              </div>
            )}

            {currentBill.amount && currentBill.amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                <span style={{ color: '#6b7280' }}>Số tiền thanh toán:</span>
                <span style={{ fontWeight: '800', color: '#16a34a', fontSize: '18px' }}>
                  {currentBill.amount.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
            )}
          </div>

          {/* KHUNG TẢI BẰNG CHỨNG CHUYỂN KHOẢN */}
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