'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [type, setType] = useState('dien');
  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getBillCode = async () => {
    setLoading(true);
    setError('');
    setBill(null);

    const { data, error: fetchError } = await supabase
      .from('bills')
      .select('*')
      .eq('type', type)
      .eq('status', 'available')
      .limit(1)
      .single();

    if (fetchError || !data) {
      setError('Hiện tại đã hết mã hóa đơn khả dụng cho loại này!');
      setLoading(false);
      return;
    }

    setBill(data);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4 text-slate-800">
          Lấy Mã Thanh Toán Hóa Đơn
        </h1>

        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={() => setType('dien')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              type === 'dien'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            Mã Tiền Điện
          </button>
          <button
            onClick={() => setType('nuoc')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              type === 'nuoc'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            Mã Tiền Nước
          </button>
        </div>

        <button
          onClick={getBillCode}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Đang lấy mã...' : 'Nhận Mã Mới'}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {bill && (
          <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-left">
            <p className="text-sm text-slate-600">Mã hóa đơn của bạn:</p>
            <p className="text-2xl font-mono font-bold text-emerald-800 my-1">
              {bill.bill_code}
            </p>
            <p className="text-sm text-slate-600">
              Số tiền: <span className="font-semibold">{Number(bill.amount).toLocaleString('vi-VN')} đ</span>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}