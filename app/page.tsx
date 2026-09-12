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
  const [billType, setBillType] = useState<string>('dien'); // 'dien' hoac 'nuoc'
  const [fileMap, setFileMap] = useState<{ [key: number]: File }>({});
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  
  // Lưu danh sách ID các đơn mà người dùng này đã bấm Copy thành công
  const [myClaimedIds, setMyClaimedIds] = useState<number[]>([]);

  // Đọc đơn đã chiếm từ localStorage khi vừa mở web
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

  // Lấy danh sách đơn từ Supabase
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

  // Đồng bộ Realtime & Fetch lại khi đổi loại bill
  useEffect(() => {
    fetchBills();

    const channel = supabase
      .channel('realtime_bills')
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

  // Xử lý khi nhấn Copy Mã (Khóa đơn an toàn tuyệt đối)
  const handleCopy = async (bill: Bill) => {
    if (bill.status !== 'active') return;

    // 1. Chỉ đổi sang 'pending' nếu trạng thái trong DB thực sự đang là 'active'
    const { data, error } = await supabase
      .from('bills')
      .update({ status: 'pending' })
      .eq('id', bill.id)
      .eq('status', 'active')
      .select();

    // 2. Nếu người khác nhanh tay hơn -> Tải lại & chặn lại
    if (error || !data || data.length === 0) {
      fetchBills();
      return;
    }

    // 3. Nếu chiếm thành công -> Lưu ID đơn vào máy Người 1 & Copy mã
    const updatedClaimed = [...myClaimedIds, bill.id];
    setMyClaimedIds(updatedClaimed);
    localStorage.setItem('my_claimed_bills', JSON.stringify(updatedClaimed));

    await navigator.clipboard.writeText(bill.code);
    fetchBills();
  };

  // Xử lý Upload ảnh chuyển khoản
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

      // Cập nhật trạng thái thành 'used' khi hoàn tất
      const { error: updateError } = await supabase
        .from('bills')
        .update({ status: 'used', image_url: imageUrl })
        .eq('id', billId);

      if (!updateError) {
        fetchBills();
      }
    }
    setUploadingId(null);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>Thanh Toán Điện Nước</h1>

      {/* Nút chuyển Tab Điện / Nước */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => setBillType('dien')}
          style={{
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: billType === 'dien' ? '#0070f3' : '#e0e0e0',
            color: billType === 'dien' ? '#fff' : '#000',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ⚡ Hóa Đơn Điện
        </button>
        <button
          onClick={() => setBillType('nuoc')}
          style={{
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: billType === 'nuoc' ? '#0070f3' : '#e0e0e0',
            color: billType === 'nuoc' ? '#fff' : '#000',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          💧 Hóa Đơn Nước
        </button>
      </div>

      {/* Danh sách Đơn */}
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
                border: '1px solid #e2e8f0',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
                width: 'calc(33.333% - 11px)',
                minWidth: '280px',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  Mã: {bill.code}
                </span>

                {/* Badging Trạng thái */}
                {isActive && (
                  <span style={{ fontSize: '12px', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
                    Sẵn sàng
                  </span>
                )}
                {isPending && (
                  <span style={{ fontSize: '12px', color: '#ca8a04', backgroundColor: '#fef9c3', padding: '2px 8px', borderRadius: '4px' }}>
                    {isMyBill ? '🔑 Bạn đang xử lý' : '🔒 Đã có người giữ'}
                  </span>
                )}
                {isUsed && (
                  <span style={{ fontSize: '12px', color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '4px' }}>
                    Hoàn tất
                  </span>
                )}
              </div>

              {/* TH 1: Đơn Sẵn sàng -> Hiện nút Copy */}
              {isActive && (
                <button
                  onClick={() => handleCopy(bill)}
                  style={{
                    padding: '8px',
                    backgroundColor: '#0070f3',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Copy Mã & Lấy Đơn
                </button>
              )}

              {/* TH 2: Đơn Pending & LÀ CỦA NGƯỜI 1 -> Cho Upload Ảnh */}
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
                  />
                  <button
                    onClick={() => handleUploadBill(bill.id)}
                    disabled={uploadingId === bill.id}
                    style={{
                      padding: '8px',
                      backgroundColor: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {uploadingId === bill.id ? 'Đang gửi...' : 'Xác Nhận Đã Thanh Toán'}
                  </button>
                </div>
              )}

              {/* TH 3: Đơn Pending NƯNG CỦA NGƯỜI KHÁC -> Khóa hoàn toàn */}
              {isPending && !isMyBill && (
                <div style={{ fontSize: '13px', color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
                  🚫 Đơn này đang được người khác xử lý.
                </div>
              )}

              {/* TH 4: Đơn đã hoàn tất */}
              {isUsed && (
                <div style={{ fontSize: '12px', color: '#16a34a', textAlign: 'center' }}>
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