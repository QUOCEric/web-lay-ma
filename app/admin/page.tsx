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

export default function HomePage() {
  const [billType, setBillType] = useState<'dien' | 'nuoc'>('dien');
  const [bills, setBills] = useState<Bill[]>([]);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [fileMap, setFileMap] = useState<{ [key: number]: File }>({});

  const fetchBills = async () => {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('type', billType)
      .order('id', { ascending: true });

    if (!error && data) {
      setBills(data);
    }
  };

  useEffect(() => {
    fetchBills();
    // Bật Realtime để cập nhật khi Admin duyệt hoặc có người bấm Copy
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, () => {
        fetchBills();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [billType]);

  // Xử lý khi nhấn Copy -> Chuyển sang Đang Xử Lý (pending)
  const handleCopy = async (bill: Bill) => {
    if (bill.status !== 'active') return;

    // Sao chép mã
    navigator.clipboard.writeText(bill.code);

    // Cập nhật trạng thái CSDL thành 'pending'
    const { error } = await supabase
      .from('bills')
      .update({ status: 'pending' })
      .eq('id', bill.id);

    if (error) {
      alert('Lỗi cập nhật trạng thái: ' + error.message);
    } else {
      alert(`Đã copy mã ${bill.code}! Trạng thái chuyển sang Đang Xử Lý.`);
      fetchBills();
    }
  };

  // Upload ảnh bill thanh toán
  const handleUploadBill = async (billId: number) => {
    const file = fileMap[billId];
    if (!file) {
      alert('Vui lòng chọn ảnh bill thanh toán trước!');
      return;
    }

    setUploadingId(billId);

    // Upload vào Supabase Storage bucket "bills"
    const fileExt = file.name.split('.').pop();
    const fileName = `${billId}_${Date.now()}.${fileExt}`;
    const { data: storageData, error: storageError } = await supabase.storage
      .from('bills')
      .upload(fileName, file);

    let imageUrl = '';
    if (!storageError && storageData) {
      const { data: urlData } = supabase.storage.from('bills').getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    } else {
      // Nếu chưa cài Storage, chuyển ảnh thành Base64 để lưu thẳng CSDL
      imageUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    // Cập nhật link ảnh vào CSDL
    const { error: updateError } = await supabase
      .from('bills')
      .update({ bill_image: imageUrl })
      .eq('id', billId);

    setUploadingId(null);

    if (updateError) {
      alert('Lỗi khi gửi bill: ' + updateError.message);
    } else {
      alert('Đã gửi ảnh bill thành công! Vui lòng chờ Admin kiểm tra và duyệt.');
      fetchBills();
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#1e293b' }}>Hệ Thống Lấy Mã Hóa Đơn</h1>

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {bills.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#64748b' }}>Chưa có mã nào trong hệ thống.</p>
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

                {/* Hiển thị trạng thái màu tương ứng */}
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

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
                <button
                  onClick={() => handleCopy(bill)}
                  disabled={bill.status !== 'active'}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: bill.status === 'active' ? '#2563eb' : '#94a3b8',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    cursor: bill.status === 'active' ? 'pointer' : 'not-allowed',
                  }}
                >
                  {bill.status === 'active' ? 'Copy Mã' : 'Không Thể Copy'}
                </button>

                {/* Nếu đang xử lý thì mở chỗ gửi bill */}
                {bill.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setFileMap({ ...fileMap, [bill.id]: e.target.files[0] });
                        }
                      }}
                      style={{ fontSize: '12px' }}
                    />
                    <button
                      onClick={() => handleUploadBill(bill.id)}
                      disabled={uploadingId === bill.id}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      {uploadingId === bill.id ? 'Đang gửi...' : 'Gửi Bill Thanh Toán'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}