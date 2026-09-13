'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const REGIONS = [
  { name: 'EVN Miền Bắc', url: 'https://cskh.npc.com.vn' },
  { name: 'EVN Miền Trung', url: 'https://cskh.cpc.vn' },
  { name: 'EVN Miền Nam', url: 'https://cskh.evnspc.vn' },
  { name: 'EVN Hà Nội', url: 'https://evnhanoi.vn' },
  { name: 'EVN TP.HCM', url: 'https://cskh.evnhcmc.vn' },
  { name: 'Cấp Nước', url: 'https://www.google.com/search?q=tra+cuu+tien+nuoc' },
];

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [bills, setBills] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('bills'); // 'bills' hoặc 'lookup'
  const [filter, setFilter] = useState('all'); // all, pending, completed, error
  const [batchData, setBatchData] = useState('');
  const [currentPeriod, setCurrentPeriod] = useState('2026-09');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [lookupCode, setLookupCode] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin123') {
      setIsAuthenticated(true);
      fetchBills();
    } else {
      alert('Mật khẩu không chính xác!');
    }
  };

  const fetchBills = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Lỗi tải dữ liệu:', error);
    } else {
      setBills(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setBills((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setBills((prev) =>
              prev.map((item) => (item.id === payload.new.id ? payload.new : item))
            );
          } else if (payload.eventType === 'DELETE') {
            setBills((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  // Nhập liệu hàng loạt (Bulk Import) & Lọc trùng
  const handleBatchImport = async () => {
    if (!batchData.trim()) return;

    const rows = batchData.trim().split('\n');
    const parsedRows = rows.map((row) => {
      const [code, customer_name, amount] = row.split(',').map((item) => item.trim());
      return {
        code,
        customer_name,
        amount: parseFloat(amount) || 0,
        billing_period: currentPeriod,
        status: 'pending',
      };
    }).filter(item => item.code);

    const uniqueMap = new Map();
    parsedRows.forEach(item => {
      const uniqueKey = `${item.code}_${item.billing_period}`;
      if (!uniqueMap.has(uniqueKey)) {
        uniqueMap.set(uniqueKey, item);
      }
    });
    const cleanRecords = Array.from(uniqueMap.values());

    setLoading(true);
    const { error } = await supabase.from('bills').insert(cleanRecords);

    if (error) {
      alert('Lỗi nhập dữ liệu (Có thể bị trùng mã trong cùng kỳ cước): ' + error.message);
    } else {
      alert(`Nhập thành công ${cleanRecords.length} bản ghi cho kỳ ${currentPeriod}!`);
      setBatchData('');
      fetchBills();
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('bills')
      .update({ status })
      .eq('id', id);

    if (error) {
      alert('Lỗi cập nhật trạng thái: ' + error.message);
    }
  };

  const handleDeleteBill = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa vĩnh viễn mã này khỏi hệ thống?')) return;
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (error) {
      alert('Lỗi xóa mã: ' + error.message);
    } else {
      setBills(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleQuickLookupAction = (regionUrl: string) => {
    if (!lookupCode.trim()) {
      alert('Vui lòng nhập hoặc dán mã trước!');
      return;
    }
    navigator.clipboard.writeText(lookupCode.trim());
    window.open(regionUrl, '_blank');
  };

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', fontFamily: 'sans-serif' }}>
        <h2>Đăng nhập trang Admin</h2>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Nhập mật khẩu admin..."
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box' }}
          />
          <button type="submit" style={{ width: '100%', padding: '10px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Đăng nhập
          </button>
        </form>
      </div>
    );
  }

  const filteredBills = bills.filter((inv) => {
    if (filter === 'pending') return inv.status === 'pending';
    if (filter === 'completed') return inv.status === 'completed';
    if (filter === 'error') return inv.status === 'error';
    return true;
  });

  const pendingCount = bills.filter(i => i.status === 'pending').length;
  const completedCount = bills.filter(i => i.status === 'completed').length;
  const errorCount = bills.filter(i => i.status === 'error').length;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Quản lý Hóa đơn Điện / Nước & Tra cứu</h1>

      {/* Thanh điều hướng Tab */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        <button 
          onClick={() => setActiveTab('bills')} 
          style={{ padding: '8px 16px', background: activeTab === 'bills' ? '#0070f3' : '#eee', color: activeTab === 'bills' ? '#fff' : '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Quản lý Hóa Đơn ({bills.length})
        </button>
        <button 
          onClick={() => setActiveTab('lookup')} 
          style={{ padding: '8px 16px', background: activeTab === 'lookup' ? '#0070f3' : '#eee', color: activeTab === 'lookup' ? '#fff' : '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Tra cứu nhanh (Quick Lookup)
        </button>
      </div>

      {activeTab === 'bills' && (
        <>
          {/* Khu vực nạp liệu hàng loạt */}
          <div style={{ marginBottom: '20px', padding: '15px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd' }}>
            <h3>Nhập liệu hàng loạt (Bulk Import) & Quản lý Kỳ Cước</h3>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Kỳ cước (Billing Period):</label>
              <input
                type="text"
                value={currentPeriod}
                onChange={(e) => setCurrentPeriod(e.target.value)}
                placeholder="Ví dụ: 2026-09"
                style={{ padding: '6px', width: '200px' }}
              />
            </div>
            <p style={{ fontSize: '13px', color: '#666' }}>Định dạng mỗi dòng: Mã KH, Tên khách hàng, Số tiền (Hệ thống tự động lọc bỏ các mã trùng nhau trong cùng kỳ)</p>
            <textarea
              rows={4}
              value={batchData}
              onChange={(e) => setBatchData(e.target.value)}
              placeholder="PE0123, Nguyễn Văn A, 500000&#10;PE0456, Trần Thị B, 300000"
              style={{ width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box' }}
            />
            <button onClick={handleBatchImport} disabled={loading} style={{ padding: '8px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {loading ? 'Đang xử lý...' : 'Nạp dữ liệu & Lọc trùng'}
            </button>
          </div>

          {/* Bộ lọc trạng thái */}
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setFilter('all')} style={{ padding: '6px 12px', background: filter === 'all' ? '#0070f3' : '#eee', color: filter === 'all' ? '#fff' : '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Tất cả ({bills.length})</button>
            <button onClick={() => setFilter('pending')} style={{ padding: '6px 12px', background: filter === 'pending' ? '#0070f3' : '#eee', color: filter === 'pending' ? '#fff' : '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Chờ duyệt ({pendingCount})</button>
            <button onClick={() => setFilter('completed')} style={{ padding: '6px 12px', background: filter === 'completed' ? '#0070f3' : '#eee', color: filter === 'completed' ? '#fff' : '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Đã hoàn thành ({completedCount})</button>
            <button onClick={() => setFilter('error')} style={{ padding: '6px 12px', background: filter === 'error' ? '#dc3545' : '#eee', color: filter === 'error' ? '#fff' : '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Lỗi / Đã đóng ({errorCount})</button>
          </div>

          {/* Bảng danh sách hóa đơn */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
              <thead>
                <tr style={{ background: '#f1f1f1', textAlign: 'left' }}>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>Mã KH (Code)</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>Khách hàng</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>Số tiền</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>Kỳ cước</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>Trạng thái</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>Ảnh Bill</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>Thao tác nhanh</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>Không có dữ liệu.</td>
                  </tr>
                ) : (
                  filteredBills.map((inv) => (
                    <tr key={inv.id} style={{ opacity: inv.status === 'error' ? 0.6 : 1 }}>
                      <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>{inv.code}</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>{inv.customer_name}</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>{Number(inv.amount).toLocaleString()} VNĐ</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>{inv.billing_period}</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                        <span style={{ 
                          color: inv.status === 'completed' ? 'green' : inv.status === 'error' ? 'red' : 'orange', 
                          fontWeight: 'bold' 
                        }}>
                          {inv.status === 'completed' ? 'Đã duyệt' : inv.status === 'error' ? 'Lỗi / Đã đóng' : 'Chờ duyệt'}
                        </span>
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                        {inv.image_url ? (
                          <button onClick={() => setSelectedImage(inv.image_url)} style={{ color: '#0070f3', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                            Xem ảnh
                          </button>
                        ) : (
                          'Chưa có'
                        )}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          {inv.status !== 'completed' && (
                            <button onClick={() => updateStatus(inv.id, 'completed')} style={{ padding: '5px 8px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                              Duyệt
                            </button>
                          )}
                          {inv.status !== 'error' && (
                            <button onClick={() => updateStatus(inv.id, 'error')} style={{ padding: '5px 8px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                              Đánh dấu lỗi
                            </button>
                          )}
                          {inv.status === 'completed' && (
                            <button onClick={() => updateStatus(inv.id, 'pending')} style={{ padding: '5px 8px', background: '#ffc107', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                              Hoàn tác
                            </button>
                          )}
                          <button onClick={() => handleDeleteBill(inv.id)} style={{ padding: '5px 8px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB TRA CỨU NHANH */}
      {activeTab === 'lookup' && (
        <div style={{ padding: '20px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3>Công cụ Tra cứu Nhanh (Quick Lookup)</h3>
          <p style={{ fontSize: '14px', color: '#555', marginBottom: '15px' }}>
            Nhập hoặc dán mã cần tra cứu vào ô bên dưới. Khi bấm nút khu vực, hệ thống sẽ <strong>tự động copy mã vào bộ nhớ tạm</strong> và mở trang tra cứu tương ứng trong tab mới.
          </p>
          
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Nhập hoặc dán mã khách hàng..."
              value={lookupCode}
              onChange={(e) => setLookupCode(e.target.value)}
              style={{ width: '100%', padding: '12px', fontSize: '16px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
            {REGIONS.map((reg, index) => (
              <button
                key={index}
                onClick={() => handleQuickLookupAction(reg.url)}
                style={{
                  padding: '12px 15px',
                  background: '#0070f3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  textAlign: 'center'
                }}
              >
                {reg.name} ➔
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal phóng to ảnh bill */}
      {selectedImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setSelectedImage(null)}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', maxWidth: '90%' }} onClick={(e) => e.stopPropagation()}>
            <img src={selectedImage} alt="Bill chuyển khoản" style={{ maxWidth: '100%', maxHeight: '80vh', display: 'block' }} />
            <button onClick={() => setSelectedImage(null)} style={{ marginTop: '10px', padding: '6px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Đóng</button>
          </div>
        </div>
      )}
    </div>
  );
}