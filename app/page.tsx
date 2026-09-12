'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Bill {
  id: number;
  code: string;
  owner_name: string;
  amount: number;
  status: 'active' | 'pending' | 'used';
  type: 'dien' | 'nuoc';
  bill_image?: string;
}

export default function HomePage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [billType, setBillType] = useState<'dien' | 'nuoc'>('dien');
  const [fileMap, setFileMap] = useState<{ [key: number]: File }>({});
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  // Tải danh sách đơn từ Supabase
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

  // Cập nhật dữ liệu & Đăng ký lắng nghe Realtime để chống trùng đơn tức thì
  useEffect(() => {
    fetchBills();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills' },
        () => {
          fetchBills();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [billType]);

  // Xử lý khi nhấn Copy Mã (Không dùng alert, đổi trạng thái tức thì)
  // Xử lý khi nhấn Copy Mã (Khóa đơn an toàn chống trùng 100%)
  const handleCopy = async (bill: Bill) => {
    if (bill.status !== 'active') return;

    const { data, error } = await supabase
      .from('bills')
      .update({ status: 'pending' })
      .eq('id', bill.id)
      .eq('status', 'active')
      .select();

    if (error || !data || data.length === 0) {
      fetchBills();
      return;
    }

    await navigator.clipboard.writeText(bill.code);
    fetchBills();
  };
  // Xử lý khi upload ảnh chuyển khoản
  const handleUploadBill = async (billId: number) => {
    const file = fileMap[billId];
    if (!file) return;

    setUploadingId(billId);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${billId}.${fileExt}`;
    const filePath = `bills/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('bill-images')
      .upload(filePath, file);

    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage
        .from('bill-images')
        .getPublicUrl(filePath);

      const imageUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('bills')
        .update({ bill_image: imageUrl })
        .eq('id', billId);

      if (!updateError) {
        fetchBills();
      }
    }
    setUploadingId(null);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '20px 16px' }}>
      <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>
            thanhtoandiennuoc
          </h1>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', justifyContent: 'center', maxWidth: '300px', margin: '0 auto 20px auto', gap: '8px' }}>
          <button
            onClick={() => setBillType('dien')}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              backgroundColor: billType === 'dien' ? '#2563eb' : '#e2e8f0',
              color: billType === 'dien' ? '#ffffff' : '#64748b',
            }}
          >
            Tiền Điện
          </button>
          <button
            onClick={() => setBillType('nuoc')}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              backgroundColor: billType === 'nuoc' ? '#2563eb' : '#e2e8f0',
              color: billType === 'nuoc' ? '#ffffff' : '#64748b',
            }}
          >
            Tiền Nước
          </button>
        </div>

        {/* Danh Sách Đơn Hang (Grid 3 Cột) */}
        {bills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#ffffff', borderRadius: '8px' }}>
            Không có mã nào sẵn sàng.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'flex-start' }}>
            {bills.map((bill) => {
              const isActive = bill.status === 'active';
              const isPending = bill.status === 'pending';
              const isUsed = bill.status === 'used';

              return (
                <div
                  key={bill.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    width: 'calc(33.333% - 11px)',
                    minWidth: '280px',
                    boxSizing: 'border-box',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                        Mã: {bill.code}
                      </span>

                      {/* Status Badges */}
                      {isActive && (
                        <span style={{ backgroundColor: '#22c55e', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                          Sẵn Sàng
                        </span>
                      )}
                      {isPending && (
                        <span style={{ backgroundColor: '#eab308', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                          Đang Xử Lý
                        </span>
                      )}
                      {isUsed && (
                        <span style={{ backgroundColor: '#ef4444', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                          Đã Thanh Toán
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>Chủ Hóa Đơn: <strong>{bill.owner_name}</strong></div>
                      <div>Số Tiền: <strong style={{ color: '#2563eb' }}>{bill.amount.toLocaleString('vi-VN')} VNĐ</strong></div>
                    </div>
                  </div>

                  {/* Khu Vực Thao Tác - Khóa cứng nếu không phải 'active' */}
                  <div style={{ paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
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
                      <div>
                        <div style={{ fontSize: '12px', color: '#d97706', textAlign: 'center', fontWeight: '600', marginBottom: '8px' }}>
                          🔒 Đơn đang có người xử lý
                        </div>
                        {/* Upload bill thanh toán */}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setFileMap({ ...fileMap, [bill.id]: e.target.files[0] });
                            }
                          }}
                          style={{ fontSize: '11px', width: '100%', marginBottom: '6px' }}
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
                      <div style={{ fontSize: '12px', color: '#dc2626', textAlign: 'center', fontWeight: '600' }}>
                        ❌ Đã hoàn tất thanh toán
                      </div>
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