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
      alert(`Đã copy mã ${bill.code}! Trạng thái đã chuyển sang Đang Xử Lý.`);
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '40px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            Cổng Nhận Mã Hóa Đơn
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Hệ thống phân phối và xác thực thanh toán hóa đơn điện nước tự động
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '10px', marginBottom: '24px' }}>
          <button
            onClick={() => setBillType('dien')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: billType === 'dien' ? '#ffffff' : 'transparent',
              color: billType === 'dien' ? '#2563eb' : '#64748b',
              boxShadow: billType === 'dien' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            ⚡ Tiền Điện
          </button>
          <button
            onClick={() => setBillType('nuoc')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: billType === 'nuoc' ? '#ffffff' : 'transparent',
              color: billType === 'nuoc' ? '#2563eb' : '#64748b',
              boxShadow: billType === 'nuoc' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            💧 Tiền Nước
          </button>
        </div>

        {/* Cards List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {bills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#94a3b8' }}>
              Hiện chưa có mã hóa đơn nào sẵn sàng.
            </div>
          ) : (
            bills.map((bill) => {
              const isActive = bill.status === 'active';
              const isPending = bill.status === 'pending';
              const isUsed = bill.status === 'used';

              return (
                <div
                  key={bill.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid',
                    borderColor: isUsed ? '#fecaca' : isPending ? '#fef08a' : '#e2e8f0',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '12px', textTransform: 'uppercase', tracking: '0.05em', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>
                        Mã Hóa Đơn
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', fontFamily: 'monospace' }}>
                        {bill.code}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isActive && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
                          Sẵn Sàng
                        </span>
                      )}
                      {isPending && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#fefce8', color: '#854d0e', border: '1px solid #fef08a', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#eab308' }}></span>
                          Đang Xử Lý
                        </span>
                      )}
                      {isUsed && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
                          Đã Thanh Toán
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '16px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Chủ hộ</span>
                      <strong style={{ fontSize: '14px', color: '#334155' }}>{bill.owner_name}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Cần thanh toán</span>
                      <strong style={{ fontSize: '14px', color: '#2563eb' }}>{bill.amount.toLocaleString('vi-VN')} VNĐ</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleCopy(bill)}
                      disabled={!isActive}
                      style={{
                        padding: '10px 18px',
                        backgroundColor: isActive ? '#2563eb' : '#f1f5f9',
                        color: isActive ? '#ffffff' : '#94a3b8',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: isActive ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s',
                        boxShadow: isActive ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none',
                      }}
                    >
                      {isActive ? 'Copy Mã Hóa Đơn' : 'Đã Khóa Mã'}
                    </button>

                    {isPending && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, backgroundColor: '#f8fafc', padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setFileMap({ ...fileMap, [bill.id]: e.target.files[0] });
                            }
                          }}
                          style={{ fontSize: '12px', color: '#475569', flex: 1 }}
                        />
                        <button
                          onClick={() => handleUploadBill(bill.id)}
                          disabled={uploadingId === bill.id}
                          style={{
                            padding: '8px 14px',
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {uploadingId === bill.id ? 'Đang gửi...' : 'Gửi Bill'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}