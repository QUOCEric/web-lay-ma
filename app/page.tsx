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
}

export default function HomePage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [billType, setBillType] = useState<string>('dien');
  const [fileMap, setFileMap] = useState<{ [key: number]: File }>({});
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [myClaimedIds, setMyClaimedIds] = useState<number[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('my_claimed_bills');
    if (saved) {
      try {
        setMyClaimedIds(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

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
      .channel('public:bills')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, () => {
        fetchBills();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [billType]);

  // Khóa đơn ngay lập tức khi ấn Copy
  const handleCopy = async (bill: Bill) => {
    if (bill.status !== 'active') return;

    const { data, error } = await supabase
      .from('bills')
      .update({ status: 'pending' })
      .eq('id', bill.id)
      .eq('status', 'active')
      .select();

    if (error || !data || data.length === 0) {
      alert('Đơn này vừa có người khác giữ!');
      fetchBills();
      return;
    }

    const updatedClaimed = [...myClaimedIds, bill.id];
    setMyClaimedIds(updatedClaimed);
    localStorage.setItem('my_claimed_bills', JSON.stringify(updatedClaimed));

    await navigator.clipboard.writeText(bill.code);
    fetchBills();
  };

  // Upload ảnh chuyển khoản và lưu vào Lịch sử
  const handleUploadBill = async (bill: Bill) => {
    const file = fileMap[bill.id];
    if (!file) {
      alert('Vui lòng chọn ảnh chuyển khoản trước!');
      return;
    }

    setUploadingId(bill.id);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${bill.id}.${fileExt}`;
    const filePath = `bills/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('bill-images')
      .upload(filePath, file);

    if (uploadError) {
      alert('Lỗi tải ảnh lên: ' + uploadError.message);
      setUploadingId(null);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('bill-images')
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;

    // 1. Cập nhật ảnh vào bảng bills chính
    const { error: updateError } = await supabase
      .from('bills')
      .update({ 
        status: 'pending', 
        image_url: imageUrl 
      })
      .eq('id', bill.id);

    // 2. Lưu vào bảng lịch sử bill_history để Admin đối chứng
    await supabase.from('bill_history').insert([
      {
        bill_id: bill.id,
        code: bill.code,
        type: bill.type || billType,
        image_url: imageUrl
      }
    ]);

    if (!updateError) {
      alert('Đã gửi ảnh thanh toán! Chờ Admin kiểm tra và duyệt đơn.');
      fetchBills();
    } else {
      alert('Lỗi cập nhật hóa đơn: ' + updateError.message);
    }
    setUploadingId(null);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '24px', color: '#333', fontWeight: '500' }}>
        Thanh Toán Điện Nước
      </h2>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '32px' }}>
        <button
          onClick={() => setBillType('dien')}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: billType === 'dien' ? '#2563eb' : '#e5e7eb',
            color: billType === 'dien' ? '#ffffff' : '#374151',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          ⚡ Hóa Đơn Điện
        </button>
        <button
          onClick={() => setBillType('nuoc')}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: billType === 'nuoc' ? '#2563eb' : '#e5e7eb',
            color: billType === 'nuoc' ? '#ffffff' : '#374151',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          💧 Hóa Đơn Nước
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {bills.map((bill) => {
          const isActive = bill.status === 'active';
          const isPending = bill.status === 'pending';
          const isUsed = bill.status === 'used';
          const isMyBill = myClaimedIds.includes(bill.id);

          return (
            <div
              key={bill.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: 'calc(33.333% - 11px)',
                minWidth: '280px',
                minHeight: '130px',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#111827' }}>
                  Mã: {bill.code}
                </span>

                {isActive && (
                  <span style={{ fontSize: '12px', color: '#16a34a', backgroundColor: '#dcfce7', padding: '3px 8px', borderRadius: '4px' }}>
                    Sẵn sàng
                  </span>
                )}
                {isPending && (
                  <span style={{ fontSize: '12px', color: '#b45309', backgroundColor: '#fef3c7', padding: '3px 8px', borderRadius: '4px' }}>
                    {bill.image_url ? '⏳ Chờ Admin duyệt' : (isMyBill ? '🔑 Bạn đang giữ đơn' : '🔒 Đã bị khóa')}
                  </span>
                )}
                {isUsed && (
                  <span style={{ fontSize: '12px', color: '#dc2626', backgroundColor: '#fee2e2', padding: '3px 8px', borderRadius: '4px' }}>
                    Hoàn tất
                  </span>
                )}
              </div>

              {isActive && (
                <button
                  onClick={() => handleCopy(bill)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Copy Mã & Lấy Đơn
                </button>
              )}

              {isPending && isMyBill && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {bill.image_url ? (
                    <div style={{ fontSize: '13px', color: '#b45309', textAlign: 'center', padding: '8px 0', fontWeight: '500' }}>
                      ⏳ Đã gửi bill. Đang chờ Admin xác nhận...
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setFileMap({ ...fileMap, [bill.id]: e.target.files[0] });
                          }
                        }}
                        style={{ fontSize: '13px' }}
                      />
                      <button
                        onClick={() => handleUploadBill(bill)}
                        disabled={uploadingId === bill.id}
                        style={{
                          width: '100%',
                          padding: '10px',
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {uploadingId === bill.id ? 'Đang gửi...' : 'Xác Nhận Đã Thanh Toán'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {isPending && !isMyBill && (
                <div style={{ fontSize: '13px', color: '#dc2626', fontWeight: 'bold', textAlign: 'center', padding: '12px 0', backgroundColor: '#fef2f2', borderRadius: '6px' }}>
                  🔒 Đơn đã được người khác giữ
                </div>
              )}

              {isUsed && (
                <div style={{ fontSize: '13px', color: '#16a34a', textAlign: 'center', padding: '12px 0' }}>
                  ✅ Đã hoàn tất thanh toán
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}