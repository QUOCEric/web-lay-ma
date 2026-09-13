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
  const [loading, setLoading] = useState(false);

  // Lưu ID của đơn đang được người này thao tác gửi bill
  const [activeActionBillId, setActiveActionBillId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchAvailableBills = async () => {
    setLoading(true);
    // Lấy tất cả các đơn hợp lệ (is_valid = true) theo loại dịch vụ
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('type', billType)
      .eq('is_valid', true)
      .order('id', { ascending: true });

    if (!error && data) {
      setBills(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAvailableBills();
    setActiveActionBillId(null);
    setFile(null);

    // Lắng nghe realtime từ Supabase để tự động cập nhật khi Admin duyệt/xóa/thêm hoặc người khác khóa đơn
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

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`Đã copy mã: ${code}`);
  };

  // Bước 1: Khách bấm "Chọn & Khóa đơn" để bắt đầu thanh toán/gửi bill
  const handleLockAndStart = async (bill: Bill) => {
    // Cập nhật trạng thái trong CSDL thành 'processing' để khóa đơn tránh người khác cướp đơn
    const { error } = await supabase
      .from('bills')
      .update({ status: 'processing' })
      .eq('id', bill.id);

    if (error) {
      alert('Đơn này có thể đã được người khác thao tác, vui lòng chọn đơn khác!');
      fetchAvailableBills();
      return;
    }

    navigator.clipboard.writeText(bill.code);
    setActiveActionBillId(bill.id);
    setFile(null);
  };

  // Khách bấm hủy thao tác (mở khóa lại đơn về trạng thái active)
  const handleCancelAction = async (billId: number) => {
    const { error } = await supabase
      .from('bills')
      .update({ status: 'active' })
      .eq('id', billId);

    if (!error) {
      setActiveActionBillId(null);
      setFile(null);
      fetchAvailableBills();
    }
  };

  // Bước 2: Khách gửi ảnh bill chuyển khoản lên để admin duyệt
  const handleUploadBillSubmit = async (bill: Bill) => {
    if (!file) {
      alert('Vui lòng chọn ảnh chụp biên lai chuyển khoản!');
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

      // Cập nhật URL ảnh và đổi trạng thái thành 'pending' (chờ admin duyệt)
      const { error: updateError } = await supabase
        .from('bills')
        .update({
          image_url: imageUrl,
          status: 'pending'
        })
        .eq('id', bill.id);

      if (updateError) throw updateError;

      // Lưu vết vào bảng lịch sử
      await supabase.from('bill_history').insert({
        bill_id: bill.id,
        code: bill.code,
        type: billType,
        image_url: imageUrl
      });

      alert('🎉 Gửi bill thành công! Vui lòng chờ Admin kiểm tra và duyệt đơn.');
      setActiveActionBillId(null);
      setFile(null);
      fetchAvailableBills();
    } catch (err: any) {
      alert('Lỗi upload bill: ' + (err.message || 'Không thể tải ảnh lên'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ color: '#111827', fontSize: '24px', marginBottom: '8px' }}>⚡ Tra Cứu & Thanh Toán Hóa Đơn</h1>
        <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>
          Danh sách hóa đơn được cập nhật tự động theo thời gian thực
        </p>
      </div>

      {/* Bộ lọc dịch vụ */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px auto' }}>
        <button
          onClick={() => setBillType('dien')}
          style={{
            flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
            backgroundColor: billType === 'dien' ? '#2563eb' : '#f3f4f6',
            color: billType === 'dien' ? '#ffffff' : '#374151',
            fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          ⚡ Điện
        </button>
        <button
          onClick={() => setBillType('nuoc')}
          style={{
            flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
            backgroundColor: billType === 'nuoc' ? '#2563eb' : '#f3f4f6',
            color: billType === 'nuoc' ? '#ffffff' : '#374151',
            fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          💧 Nước
        </button>
        <button
          onClick={() => setBillType('internet')}
          style={{
            flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
            backgroundColor: billType === 'internet' ? '#2563eb' : '#f3f4f6',
            color: billType === 'internet' ? '#ffffff' : '#374151',
            fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          🌐 Internet
        </button>
      </div>

      <h3 style={{ fontSize: '16px', color: '#374151', marginBottom: '16px' }}>
        📋 Danh sách hóa đơn ({bills.length}):
      </h3>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#6b7280' }}>⏳ Đang tải dữ liệu...</p>
      ) : bills.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#ef4444', fontWeight: 'bold', padding: '30px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          Hiện tại chưa có mã hóa đơn nào trong hệ thống.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {bills.map((bill) => {
            const isProcessingByOthers = bill.status === 'processing' && activeActionBillId !== bill.id;
            const isProcessingByMe = activeActionBillId === bill.id;

            return (
              <div
                key={bill.id}
                style={{
                  backgroundColor: '#ffffff',
                  border: isProcessingByMe ? '2px solid #2563eb' : bill.status === 'pending' ? '2px solid #f59e0b' : '1px solid #d1d5db',
                  borderRadius: '10px',
                  padding: '16px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  opacity: isProcessingByOthers ? 0.7 : 1
                }}
              >
                {/* Thông tin hiển thị đầy đủ của đơn */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>ID: #{bill.id}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                        backgroundColor:
                          bill.status === 'active' ? '#dcfce7' :
                          bill.status === 'processing' ? '#fef3c7' :
                          bill.status === 'pending' ? '#ffedd5' : '#d1fae5',
                        color:
                          bill.status === 'active' ? '#166534' :
                          bill.status === 'processing' ? '#b45309' :
                          bill.status === 'pending' ? '#c2410c' : '#065f46'
                      }}
                    >
                      {bill.status === 'active' && 'Sẵn sàng'}
                      {bill.status === 'processing' && (isProcessingByMe ? 'Đang thao tác của bạn' : 'Đang có người xử lý 🔒')}
                      {bill.status === 'pending' && 'Đã gửi bill chờ duyệt ⏳'}
                      {bill.status === 'used' && 'Đã hoàn thành ✅'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>{bill.code}</span>
                    <button
                      onClick={() => handleCopyCode(bill.code)}
                      style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      📋 Copy Mã
                    </button>
                  </div>

                  <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', marginBottom: '12px', fontSize: '14px' }}>
                    <div style={{ marginBottom: '4px' }}>👤 <b>Khách hàng:</b> {bill.owner_name || 'Chưa cập nhật'}</div>
                    <div style={{ color: '#0f766e', fontWeight: 'bold' }}>
                      💵 <b>Số tiền:</b> {bill.amount ? `${bill.amount.toLocaleString('vi-VN')} đ` : '0 đ'}
                    </div>
                  </div>
                </div>

                {/* Khu vực tương tác dựa trên trạng thái đơn */}
                <div>
                  {bill.status === 'used' ? (
                    <div style={{ textAlign: 'center', color: '#16a34a', fontWeight: 'bold', fontSize: '13px', padding: '8px', backgroundColor: '#f0fdf4', borderRadius: '6px' }}>
                      ✅ Đơn đã được Admin duyệt hoàn tất
                    </div>
                  ) : bill.status === 'pending' ? (
                    <div style={{ textAlign: 'center', color: '#ea580c', fontSize: '13px', padding: '8px', backgroundColor: '#fff7ed', borderRadius: '6px' }}>
                      ⏳ Đã gửi bill, đang chờ Admin xét duyệt...
                    </div>
                  ) : isProcessingByOthers ? (
                    <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '8px', fontStyle: 'italic' }}>
                      🔒 Đang được người khác thao tác
                    </div>
                  ) : isProcessingByMe ? (
                    /* Form tải ảnh bill khi chính mình đang khóa đơn này */
                    <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#1e3a8a' }}>
                        📸 Tải ảnh bill chuyển khoản:
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        style={{ width: '100%', fontSize: '11px', marginBottom: '8px' }}
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleUploadBillSubmit(bill)}
                          disabled={uploading || !file}
                          style={{
                            flex: 1, padding: '6px',
                            backgroundColor: file ? '#16a34a' : '#9ca3af',
                            color: '#fff', border: 'none', borderRadius: '4px',
                            fontWeight: 'bold', fontSize: '12px',
                            cursor: file ? 'pointer' : 'not-allowed'
                          }}
                        >
                          {uploading ? 'Đang gửi...' : '📤 Xác nhận Gửi'}
                        </button>
                        <button
                          onClick={() => handleCancelAction(bill.id)}
                          style={{
                            padding: '6px 10px', backgroundColor: '#ef4444',
                            color: '#fff', border: 'none', borderRadius: '4px',
                            fontSize: '12px', cursor: 'pointer'
                          }}
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Nút ban đầu để khóa đơn và mở khung gửi bill */
                    <button
                      onClick={() => handleLockAndStart(bill)}
                      style={{
                        width: '100%', padding: '10px',
                        backgroundColor: '#2563eb', color: '#ffffff',
                        border: 'none', borderRadius: '6px',
                        fontWeight: 'bold', fontSize: '13px', cursor: 'pointer'
                      }}
                    >
                      👉 Chọn & Gửi Bill Thanh Toán
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}