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

    // Lắng nghe Realtime tự động cập nhật không cần F5
    const channel = supabase
      .channel('public:bills')
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

    const updatedClaimed = [...myClaimedIds, bill.id];
    setMyClaimedIds(updatedClaimed);
    localStorage.setItem('my_claimed_bills', JSON.stringify(updatedClaimed));

    await navigator.clipboard.writeText(bill.code);
    fetchBills();
  };

  const handleUploadBill = async (billId: number) => {
    const file = fileMap[billId];
    if (!file) {
      alert('Vui lòng chọn ảnh chuyển khoản trước!');
      return;
    }

    setUploadingId(billId);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${billId}.${fileExt}`;
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

    const { error: updateError } = await supabase
      .from('bills')
      .update({ 
        status: 'used', 
        image_url: imageUrl 
      })
      .eq('id', billId);

    if (!updateError) {
      alert('Đã tải ảnh lên và hoàn tất!');
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
                    {isMyBill ? '🔑 Bạn đang xử lý' : '🔒 Đã có người giữ'}
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
                    onClick={() => handleUploadBill(bill.id)}
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
                </div>
              )}

              {isPending && !isMyBill && (
                <div style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                  🚫 Đơn này đang được người khác xử lý.
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