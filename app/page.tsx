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

  const handleCopy = async (bill: Bill) => {
    if (bill.status !== 'active') return;

    navigator.clipboard.writeText(bill.code);

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

  const handleUploadBill = async (billId: number) => {
    const file = fileMap[billId];
    if (!file) {
      alert('Vui lòng chọn ảnh bill thanh toán trước!');
      return;
    }

    setUploadingId(billId);

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
      imageUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    const { error: updateError } = await supabase
      .from('bills')
      .update({ bill_image: imageUrl })
      .eq('id', billId);

    setUploadingId(null);

    if (updateError) {
      alert('Lỗi khi gửi bill: ' + updateError.message);
    } else {
      alert('Đã gửi ảnh bill thành công! Vui lòng chờ Admin kiểm duyệt.');
      fetchBills();
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '30px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>
            Hệ Thống Lấy Mã Hóa Đơn
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Chọn hóa đơn cần lấy mã và tải ảnh xác nhận thanh toán
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', justifyContent: 'center', maxWidth: '300px', margin: '0 auto 24px auto', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '10px' }}>
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

        {/* Cards Grid: Xếp hàng ngang */}
        {bills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#94a3b8' }}>
            Không có mã nào sẵn sàng.
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
                    borderRadius: '12px',
                    padding: '16px',
                    border: '1px solid',
                    borderColor: isUsed ? '#fecaca' : isPending ? '#fef08a' : '#e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', fontFamily: 'monospace' }}>
                        {bill.code}
                      </span>

                      {/* Status Badge */}
                      {isActive && (
                        <span style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                          Sẵn Sàng
                        </span>
                      )}
                      {isPending && (
                        <span style={{ backgroundColor: '#fefce8', color: '#854d0e', border: '1px solid #fef08a', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                          Đang Xử Lý
                        </span>
                      )}
                      {isUsed && (
                        <span style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                          Đã Thanh Toán
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '13px', color: '#475569', marginBottom: '12px', lineHeight: '1.5' }}>
                      <div>Chủ Hóa Đơn: <strong>{bill.owner_name}</strong></div>
                      <div>Số Tiền: <strong style={{ color: '#2563eb' }}>{bill.amount.toLocaleString('vi-VN')} VNĐ</strong></div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                    {isActive && (
                      <button
                        onClick={() => handleCopy(bill)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        Copy Mã
                      </button>
                    )}

                    {isPending && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setFileMap({ ...fileMap, [bill.id]: e.target.files[0] });
                            }
                          }}
                          style={{ fontSize: '11px' }}
                        />
                        <button
                          onClick={() => handleUploadBill(bill.id)}
                          disabled={uploadingId === bill.id}
                          style={{
                            width: '100%',
                            padding: '6px',
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          {uploadingId === bill.id ? 'Đang gửi...' : 'Gửi Bill Thanh Toán'}
                        </button>
                      </div>
                    )}

                    {isUsed && (
                      <button
                        disabled
                        style={{
                          width: '100%',
                          padding: '8px',
                          backgroundColor: '#f1f5f9',
                          color: '#94a3b8',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'not-allowed',
                        }}
                      >
                        Không Thể Copy
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}