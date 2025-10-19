import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Download, ExternalLink, User, Phone, MessageCircle,
  MapPin, Store, Package, AlertCircle, CheckCircle
} from 'lucide-react';
import data from '../data.json';

export default function DistributorFinderDashboard() {
  const [searchTerm, setSearchTerm] = useState('');

  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(true); // ✅ แสดงผลตั้งแต่แรก
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 🔹 ดึงข้อมูลจาก data.json
  useEffect(() => {
    try {
      // ✅ รวมโพสต์จากทุกกลุ่ม
      const allPosts = data.groups?.flatMap(g => g.posts) || [];

      // ✅ เพิ่ม id ให้ React ใช้เป็น key
      const formatted = allPosts.map((p, index) => ({
        id: index + 1,
        ...p
      }));

      setResults(formatted);
      setShowResults(true);
      setLoading(false);
    } catch (err) {
      console.error('❌ Error loading data:', err);
      setError('ไม่สามารถโหลดข้อมูลจากไฟล์ได้');
      setLoading(false);
    }
  }, []);

  const handleSearch = () => {
    setShowResults(true);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(filteredResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `distributor_leads_${new Date().getTime()}.json`;
    link.click();
  };

  const calculateCompleteness = (post) => {
    let score = 0;
    let total = 5;

    if (post.contact?.hasContact) score++;
    if (post.productInfo?.prices?.length > 0) score++;
    if (post.productInfo?.beerBrands?.length > 0) score++;
    if (post.productInfo?.locations?.length > 0) score++;
    if (post.imageUrl) score++;

    return Math.round((score / total) * 100);
  };

  const filteredResults = results.filter(result => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      result.text?.toLowerCase().includes(searchLower) ||
      result.author?.toLowerCase().includes(searchLower) ||
      result.productInfo?.beerBrands?.some(b => b.toLowerCase().includes(searchLower)) ||
      result.productInfo?.locations?.some(l => l.toLowerCase().includes(searchLower))
    );
  });

  const stats = {
    total: filteredResults.length,
    withContact: filteredResults.filter(r => r.contact?.hasContact).length,
    withPrice: filteredResults.filter(r => r.productInfo?.prices?.length > 0).length,
    withLocation: filteredResults.filter(r => r.productInfo?.locations?.length > 0).length,
    avgCompleteness: filteredResults.length > 0
      ? Math.round(filteredResults.reduce((sum, r) => sum + calculateCompleteness(r), 0) / filteredResults.length)
      : 0
  };

  // 🔹 สถานะโหลดข้อมูล
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-blue-50">
        <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
        <p className="text-blue-800 font-medium">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  // 🔹 แสดง error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-50">
        <AlertCircle className="w-10 h-10 text-red-600 mb-4" />
        <p className="text-red-700 font-semibold">{error}</p>
      </div>
    );
  }

  // 🔹 Layout + Results
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100">
      {/* Header */}
      <div className="bg-white border-b border-blue-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-3 rounded-xl shadow-lg">
              <Store className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                Distributor Finder
              </h1>
              <p className="text-sm text-blue-600 font-medium">ค้นหาร้านค้าตัวแทนจำหน่าย</p>
            </div>
          </div>

          <button
            onClick={handleExport}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Search + Results */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Search Section */}
        <div className="bg-white rounded-2xl border border-blue-200 p-8 mb-8 shadow-xl">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-blue-900">ค้นหา</h2>
          </div>

          <div className="flex gap-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาตามข้อความ, ผู้เขียน, ยี่ห้อ, หรือพื้นที่..."
              className="flex-1 bg-blue-50 border-2 border-blue-200 text-blue-900 rounded-xl px-4 py-3"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center space-x-2"
            >
              <Search className="w-4 h-4" />
              <span>ค้นหา</span>
            </button>
          </div>
        </div>

        {/* Results */}
        {showResults && (
          <div>
            <h3 className="text-2xl font-bold text-blue-900 mb-6">
              พบทั้งหมด {filteredResults.length} รายการ
            </h3>

            {filteredResults.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-blue-200 p-16 text-center shadow-xl">
                <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-blue-900 mb-2">ไม่พบผลลัพธ์</h3>
                <p className="text-blue-600">ลองปรับเงื่อนไขการค้นหาใหม่</p>
              </div>
            ) : (
              filteredResults.map((result) => (
                <div key={result.id} className="bg-white rounded-2xl p-6 mb-6 border-2 border-blue-200 shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-lg text-blue-900">{result.author}</h4>
                    <a href={result.postLink} target="_blank" rel="noreferrer" className="text-blue-600 font-medium flex items-center">
                      <ExternalLink className="w-4 h-4 mr-1" /> ดูโพสต์
                    </a>
                  </div>
                  <p className="text-blue-800 mb-4">{result.text}</p>
                  {result.imageUrl && (
                    <img src={result.imageUrl} alt="post" className="rounded-xl w-full max-h-80 object-cover border" />
                  )}
                  <div className="text-sm text-blue-700 mt-4">
                    👍 {result.engagement?.reactions ?? 0} · 💬 {result.engagement?.comments ?? 0}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

