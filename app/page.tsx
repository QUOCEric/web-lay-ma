'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface BillItem {
  id: number;
  code: string;
  owner_name: string;
  amount: number;
  type: string;
  status: string;
}

export default function HomePage() {
  const [billType, setBillType] = useState<'dien' | 'nuoc'>('dien');
  const [bills, setBills] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimedCode, setClaimedCode] = useState<BillItem | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchAllBills = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bills')
      .select('*')
      .eq('type', billType)
      .order('id', { ascending: true });

    setBills(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllBills();
    setClaimedCode(null);
  }, [billType]);

  const handleGetCode = async () => {
    setLoading(true);
    setClaimedCode(null);

    const { data, error } = await supabase.rpc('get_and_claim_bill', { p_type: billType });
    setLoading(false);

    if (error || !data || data.length === 0) {
      alert('Hiện tại đã hết mã hóa đơn khả dụng!');
      return;
    }

    setClaimedCode(data[0]);
    fetchAllBills();
  };

  const handleCopy = (id: number, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Hệ Thống Phân Phối Mã Thanh Toán</h2>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
        <button
          onClick={() => setBillType('dien')}
          style={{
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 'bold',
            cursor: 'pointer',
            backgroundColor: billType === 'dien' ? '#2563eb' : '#e5e7eb',
            color: billType === 'dien' ? '#fff' : '#374151',
          }}
        >
          Mã Tiền Điện
        </button>
        <button
          onClick={() => setBillType('nuoc')}
          style={{
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 'bold',
            cursor: 'pointer',
            backgroundColor: billType === 'nuoc' ? '#2563eb' : '#e5e7eb',
            color: billType === 'nuoc' ? '#fff' : '#374151',
          }}
        >
          Mã Tiền Nước
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '25px' }}>
        <button
          onClick={handleGetCode}
          disabled={loading}
          style={{
            padding: '12px 30px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: '#059669',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Đang lấy mã...' : 'Nhận 1 Mã Mới Khả Dụng'}
        </button>
      </div>

      {claimedCode && (
        <div style={{ padding: '15px', backgroundColor: '#ecfdf5', border: '1px solid #10b981', borderRadius: '8px', marginBottom: '25px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#065f46' }}>Mã của bạn:</h3>
          <p style={{ margin: '4px 0' }}><strong>Mã:</strong> {claimedCode.code}</p>
          <p style={{ margin: '4px 0' }}><strong>Chủ mã:</strong> {claimedCode.owner_name}</p>
          <p style={{ margin: '4px 0' }}><strong>Số tiền:</strong> {claimedCode.amount?.toLocaleString('vi-VN')} VNĐ</p>
          <button
            onClick={() => handleCopy(claimedCode.id, claimedCode.code)}
            style={{ marginTop: '10px', padding: '8px 16px', backgroundColor: copiedId === claimedCode.id ? '#10b981' : '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {copiedId === claimedCode.id ? '✓ Đã Copy' : 'Copy Mã'}
          </button>
        </div>
      )}

      <h3>Danh Sách Tất Cả Mã Hóa Đơn ({billType === 'dien' ? 'Điện' : 'Nước'})</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f3f4f6', textAlign: 'left' }}>
            <th style={{ padding: '10px', border: '1px solid #e5e7eb' }}>Mã Thanh Toán</th>
            <th style={{ padding: '10px', border: '1px solid #e5e7eb' }}>Tên Chủ Mã</th>
            <th style={{ padding: '10px', border: '1px solid #e5e7eb' }}>Số Tiền</th>
            <th style={{ padding: '10px', border: '1px solid #e5e7eb' }}>Trạng Thái</th>
            <th style={{ padding: '10px', border: '1px solid #e5e7eb' }}>Hành Động</th>
          </tr>
        </thead>
        <tbody>
          {bills.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: '15px', textAlign: 'center', color: '#6b7280' }}>Chưa có mã nào trong hệ thống</td>
            </tr>
          ) : (
            bills.map((item) => (
              <tr key={item.id} style={{ backgroundColor: item.status === 'used' ? '#fef2f2' : '#fff' }}>
                <td style={{ padding: '10px', border: '1px solid #e5e7eb', fontWeight: 'bold' }}>{item.code}</td>
                <td style={{ padding: '10px', border: '1px solid #e5e7eb' }}>{item.owner_name}</td>
                <td style={{ padding: '10px', border: '1px solid #e5e7eb' }}>{item.amount?.toLocaleString('vi-VN')} đ</td>
                <td style={{ padding: '10px', border: '1px solid #e5e7eb' }}>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: item.status === 'active' ? '#dcfce7' : '#fee2e2',
                      color: item.status === 'active' ? '#15803d' : '#b91c1c',
                    }}
                  >
                    {item.status === 'active' ? 'Sẵn Sàng' : 'Đã Thanh Toán / Đã Dùng'}
                  </span>
                </td>
                <td style={{ padding: '10px', border: '1px solid #e5e7eb' }}>
                  <button
                    onClick={() => handleCopy(item.id, item.code)}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: '4px',
                      backgroundColor: copiedId === item.id ? '#10b981' : '#2563eb',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    {copiedId === item.id ? '✓ Đã Copy' : 'Copy Mã'}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}