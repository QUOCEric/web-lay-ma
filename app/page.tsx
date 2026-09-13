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
  is_valid?: boolean;
}

export default function HomePage() {
  const [billType, setBillType] = useState<string>('dien');
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);

  // Lưu ID của dòng đang mở khung chọn file gửi bill
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchAvailableBills = async () => {
    setLoading(true);
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
    setUploadingId(null);
    setFile(null);

    const channel = supabase
      .channel('client_table_realtime')
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

  // Khách bấm thao tác gửi bill -> Khóa đơn tạm thời thành 'processing'
  const handleStartUpload = async (bill: Bill) => {
    const { error } = await supabase
      .from('bills')
      .update({ status: 'processing' })
      .eq('id', bill.id);

    if (error) {
      alert('Đơn này đang được người khác thao tác, vui lòng chọn đơn khác!');
      fetchAvailableBills();
      return;
    }

    navigator.clipboard.writeText(bill.code);
    setUploadingId(bill.id);
    setFile(null);
  };

  const handleCancelUpload = async (billId: number) => {
    await supabase
      .from('bills')
      .update({ status: 'active' })
      .eq('id', billId);

    setUploadingId(null);
    setFile(null);
    fetchAvailableBills();
  };

  const handleSubmitBill = async (bill: Bill) => {
    if (!file) {
      alert('Vui lòng chọn ảnh bill chuyển khoản!');
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

      // Cập nhật bill sang trạng thái pending (chờ admin duyệt)
      const { error: updateError } = await supabase
        .from('bills')
        .update({
          image_url: imageUrl,
          status: 'pending'
        })
        .eq('id', bill.id);

      if (updateError) throw updateError;

      // Lưu lịch sử
      await supabase.from('bill_history').insert({
        bill_id: bill.id,
        code: bill.code,
        type: billType,
        image_url: imageUrl
      });

      alert('🎉 Gửi bill thành công! Vui lòng chờ Admin duyệt.');
      setUploadingId(null);
      setFile(null);
      fetchAvailableBills();
    } catch (err: any) {
      alert('Lỗi: ' + (err.message || 'Không thể tải ảnh lên'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '30px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ color: '#111827', fontSize: '24px', marginBottom: '8px' }}>⚡ Tra Cứu & Thanh Toán Hóa Đơn</h1>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Chọn dịch vụ và thực hiện tải ảnh bill trực tiếp trên danh sách bên dưới</p>
      </div>

      {/* Nút chọn loại dịch vụ */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px auto' }}>
        {['dien', 'nuoc', 'internet'].map((type) => (
          <button
            key={type}
            onClick={() => setBillType(type)}
            style={{
              flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
              backgroundColor: billType === type ? '#2563eb' : '#ffffff',
              color: billType === type ? '#ffffff' : '#374151',
              fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              textTransform: 'uppercase'
            }}
          >
            {type === 'dien' ? '⚡ Điện' : type === 'nuoc' ? '💧 Nước' : '🌐 Internet'}
          </button>
        ))}
      </div>

      {/* Bảng danh sách mã */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f3f4f6' }}>
          <h3 style={{ fontSize: '16px', color: '#1f2937', margin: 0 }}>
            📦 Quản Lý Kho Mã Dịch Vụ ({billType.toUpperCase()})
          </h3>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>Tổng số: {bills.length} mã</span>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>⏳ Đang tải dữ liệu...</p>
        ) : bills.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#ef4444', fontWeight: 'bold', padding: '30px' }}>
            Hiện tại không có mã hóa đơn nào.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px' }}>ID</th>
                  <th style={{ padding: '12px' }}>Mã Hóa Đơn</th>
                  <th style={{ padding: '12px' }}>Khách Hàng</th>
                  <th style={{ padding: '12px' }}>Số Tiền</th>
                  <th style={{ padding: '12px' }}>Trạng Thái</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Hành Động Gửi Bill</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => {
                  const isProcessingByOthers = bill.status === 'processing' && uploadingId !== bill.id;
                  const isUploadingThis = uploadingId === bill.id;

                  return (
                    <tr key={bill.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: isProcessingByOthers ? 0.6 : 1 }}>
                      <td style={{ padding: '12px', color: '#64748b' }}>#{bill.id}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#0f172a' }}>
                        {bill.code}{' '}
                        <button
                          onClick={() => handleCopyCode(bill.code)}
                          style={{ marginLeft: '6px', padding: '2px 6px', fontSize: '11px', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc' }}
                        >
                          📋
                        </button>
                      </td>
                      <td style={{ padding: '12px', color: '#334155' }}>{bill.owner_name || 'Chưa có'}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#0d9488' }}>
                        {bill.amount ? `${bill.amount.toLocaleString('vi-VN')} đ` : '0 đ'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                          backgroundColor: bill.status === 'active' ? '#dcfce7' : bill.status === 'processing' ? '#fef3c7' : bill.status === 'pending' ? '#ffedd5' : '#d1fae5',
                          color: bill.status === 'active' ? '#166534' : bill.status === 'processing' ? '#b45309' : bill.status === 'pending' ? '#c2410c' : '#065f46'
                        }}>
                          {bill.status === 'active' && 'Sẵn sàng'}
                          {bill.status === 'processing' && (isUploadingThis ? 'Đang thao tác...' : 'Đang có người xử lý 🔒')}
                          {bill.status === 'pending' && 'Đã gửi Bill chờ duyệt ⏳'}
                          {bill.status === 'used' && 'Đã hoàn thành ✅'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {bill.status === 'used' ? (
                          <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '13px' }}>Đã hoàn tất</span>
                        ) : bill.status === 'pending' ? (
                          <span style={{ color: '#ea580c', fontSize: '13px' }}>Chờ Admin duyệt</span>
                        ) : isProcessingByOthers ? (
                          <span style={{ color: '#9ca3af', fontSize: '13px' }}>Đang bị khóa</span>
                        ) : isUploadingThis ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => setFile(e.target.files?.[0] || null)}
                              style={{ fontSize: '11px', width: '180px' }}
                            />
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => handleSubmitBill(bill)}
                                disabled={uploading || !file}
                                style={{ padding: '4px 8px', backgroundColor: file ? '#16a34a' : '#9ca3af', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                {uploading ? 'Đang gửi...' : 'Gửi'}
                              </button>
                              <button
                                onClick={() => handleCancelUpload(bill.id)}
                                style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartUpload(bill)}
                            style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            📤 Gửi Bill
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}