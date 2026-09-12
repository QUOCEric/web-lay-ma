'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function HomePage() {
  const [billType, setBillType] = useState<'dien' | 'nuoc'>('dien');
  const [codeData, setCodeData] = useState<{ id: number; code: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGetCode = async () => {
    setLoading(true);
    setErrorMsg('');
    setCodeData(null);
    setCopied(false);

    // Gọi hàm RPC để lấy mã và đổi ngay trạng thái thành 'used'
    const { data, error } = await supabase.rpc('get_and_claim_bill', { p_type: billType });

    setLoading(false);

    if (error) {
      setErrorMsg(`Lỗi kết nối: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      setErrorMsg('Hiện tại đã hết mã hóa đơn khả dụng cho loại này!');
      return;
    }

    setCodeData(data[0]);
  };

  const handleCopy = () => {
    if (codeData?.code) {
      navigator.clipboard.writeText(codeData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'center', width: '380px' }}>
        <h2 style={{ marginBottom: '20px', color: '#1a252c' }}>Lấy Mã Thanh Toán Hóa Đơn</h2>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
          <button
            onClick={() => { setBillType('dien'); setCodeData(null); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              backgroundColor: billType === 'dien' ? '#2563eb' : '#e5e7eb',
              color: billType === 'dien' ? '#fff' : '#374151',
            }}
          >
            Mã Tiền Điện
          </button>
          <button
            onClick={() => { setBillType('nuoc'); setCodeData(null); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              backgroundColor: billType === 'nuoc' ? '#2563eb' : '#e5e7eb',
              color: billType === 'nuoc' ? '#fff' : '#374151',
            }}
          >
            Mã Tiền Nước
          </button>
        </div>

        <button
          onClick={handleGetCode}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: loading ? '#9ca3af' : '#059669',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '15px'
          }}
        >
          {loading ? 'Đang cấp mã...' : 'Nhận Mã Mới'}
        </button>

        {codeData && (
          <div style={{ padding: '15px', backgroundColor: '#ecfdf5', border: '1px solid #10b981', borderRadius: '8px', marginTop: '10px' }}>
            <span style={{ fontSize: '13px', color: '#065f46', display: 'block', marginBottom: '4px' }}>Mã đã được cấp riêng cho bạn:</span>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#047857', letterSpacing: '1px', marginBottom: '10px' }}>
              {codeData.code}
            </div>

            <button
              onClick={handleCopy}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: copied ? '#10b981' : '#2563eb',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {copied ? '✓ Đã Copy Mã' : 'Copy Mã'}
            </button>

            <div style={{ marginTop: '10px', fontSize: '12px', color: '#6b7280' }}>
              Trạng thái: <span style={{ color: '#dc2626', fontWeight: 'bold' }}>Đã xuất kho (Đã thanh toán)</span>
            </div>
          </div>
        )}

        {errorMsg && (
          <div style={{ padding: '10px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '14px' }}>
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}