import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Filter, Download, ExternalLink, User, Phone, MessageCircle,
  MapPin, Store, Package, AlertCircle, CheckCircle
} from 'lucide-react';

export default function DistributorFinderDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [allResults, setAllResults] = useState([]); // เก็บข้อมูลทั้งหมด
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [latestScrapedAt, setLatestScrapedAt] = useState(null);
  const [savedQueries, setSavedQueries] = useState([]); // รายการค้นหาที่บันทึกไว้

  const SAVED_QUERIES_KEY = 'distributorSavedSearchTerms';
  const SINGLE_SEARCH_KEY = 'distributorSearchTerm';
  const MAX_SAVED = 10;

  const readSavedQueries = () => {
    try {
      const raw = localStorage.getItem(SAVED_QUERIES_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter(q => typeof q === 'string') : [];
    } catch {
      return [];
    }
  };

  const writeSavedQueries = (arr) => {
    try {
      localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(arr));
    } catch {
      // ignore
    }
  };

  // 🔹 Helper: ตรวจสอบว่าโพสต์ตรงกับคำค้นหรือไม่
  const matchesSearch = (post, searchLower) => {
    if (!searchLower) return true;
    return (
      post.text?.toLowerCase().includes(searchLower) ||
      post.author?.toLowerCase().includes(searchLower) ||
      post.productInfo?.beerBrands?.some(brand => brand?.toLowerCase().includes(searchLower)) ||
      post.productInfo?.locations?.some(location => location?.toLowerCase().includes(searchLower)) ||
      post.keywords?.some(k => (k?.keyword || '')?.toLowerCase().includes(searchLower))
    );
  };

  // 🔹 ดึงข้อมูลจาก localStorage (เฉพาะรายการประวัติ) และ API เมื่อเริ่มต้น
  useEffect(() => {
    const initialSaved = readSavedQueries();
    setSavedQueries(initialSaved);
    
    // โหลดข้อมูลจาก API ทันทีเมื่อเข้าเว็บ
    fetchData();
  }, []);

  // 🔹 ดึงข้อมูลจาก API
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:4000/posts');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // ✅ รวมโพสต์จากทุกกลุ่ม พร้อมแนบเวลา scrapedAt ของกลุ่ม
      const groups = Array.isArray(data.groups) ? data.groups : [];
      const postsWithGroupTime = groups.flatMap((group) => {
        const groupScrapedAt = group.scrapedAt || group.lastUpdated || data.scrapedAt || null;
        const posts = Array.isArray(group.posts) ? group.posts : [];
        return posts.map((post) => ({ ...post, groupScrapedAt }));
      });

      // ✅ เพิ่ม id ให้ React ใช้เป็น key และจัดเรียงใหม่ตามเวลาใหม่สุดก่อน
      const formatted = postsWithGroupTime
        .map((p, index) => ({ id: index + 1, ...p }))
        .sort((a, b) => {
          const timeA = new Date(a.groupScrapedAt || a.timestamp || a.rawTimestamp || 0).getTime();
          const timeB = new Date(b.groupScrapedAt || b.timestamp || b.rawTimestamp || 0).getTime();
          return timeB - timeA; // ใหม่สุดอยู่บน
        });

      // ✅ เก็บเวลาล่าสุดเพื่อแสดงผลด้านบน
      const latest = groups
        .map(g => g.scrapedAt || g.lastUpdated)
        .filter(Boolean)
        .map(t => new Date(t).getTime());
      const latestTs = latest.length ? Math.max(...latest) : (data.scrapedAt ? new Date(data.scrapedAt).getTime() : null);
      setLatestScrapedAt(latestTs ? new Date(latestTs).toISOString() : null);

      setAllResults(formatted);
      setResults(formatted);
      setLoading(false);
    } catch (err) {
      console.error('❌ Error loading data:', err);
      setError('ไม่สามารถโหลดข้อมูลจาก API ได้');
      setLoading(false);
    }
  };

  const persistQueryIfNeeded = (term) => {
    if (!term || !term.trim()) return;
    const normalized = term.trim();
    // ยังคงอัปเดต single key เพื่อความเข้ากันได้ (ไม่อ่านมาใช้ตอนค้นหา)
    localStorage.setItem(SINGLE_SEARCH_KEY, normalized);

    // จัดเก็บในอาร์เรย์ ไม่ซ้ำ ย้ายขึ้นบน จำกัดจำนวน
    const current = readSavedQueries();
    const without = current.filter(q => q.toLowerCase() !== normalized.toLowerCase());
    const next = [normalized, ...without].slice(0, MAX_SAVED);
    setSavedQueries(next);
    writeSavedQueries(next);
  };

  const handleSearch = async () => {
    const term = (searchTerm || '').trim();
    if (!term) {
      setResults(allResults);
      setShowResults(true);
      return;
    }

    // 🔹 บันทึก search term ลง localStorage (แต่ไม่อ่านค่าจาก storage มาใช้)
    persistQueryIfNeeded(term);

    // 🔹 เรียกทั้ง 2 API พร้อมกัน: ค้นหา (3001) และโพสต์ (4000)
    const searchUrl = `http://localhost:3001/search?q=${encodeURIComponent(term)}`;
    const postsUrl = 'http://localhost:4000/posts';

    try {
      const [searchResp, postsResp] = await Promise.all([
        fetch(searchUrl),
        fetch(postsUrl)
      ]);

      if (!searchResp.ok) throw new Error(`Search API error ${searchResp.status}`);
      if (!postsResp.ok) throw new Error(`Posts API error ${postsResp.status}`);

      const [searchData, postsData] = await Promise.all([
        searchResp.json(),
        postsResp.json()
      ]);

      const parseGroupsToPosts = (root) => {
        const groups = Array.isArray(root?.groups) ? root.groups : [];
        return groups.flatMap((group) => {
          const groupScrapedAt = group.scrapedAt || group.lastUpdated || root.scrapedAt || null;
          const posts = Array.isArray(group.posts) ? group.posts : [];
          return posts.map((post) => ({ ...post, groupScrapedAt }));
        });
      };

      const searchPosts = parseGroupsToPosts(searchData);
      const basePosts = parseGroupsToPosts(postsData);

      // 🔹 รวมและลบซ้ำ โดยใช้ postLink เป็น key ถ้ามี ไม่งั้นใช้ author+text
      const seen = new Set();
      const merged = [];
      const pushUnique = (p) => {
        const key = p.postLink || `${p.author || ''}::${(p.text || '').slice(0,100)}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(p);
        }
      };
      basePosts.forEach(pushUnique);
      searchPosts.forEach(pushUnique);

      // 🔹 กรองผลรวมอีกครั้งด้วยคำค้นที่ผู้ใช้ใส่ เพื่อให้แสดงเฉพาะที่ตรงจริงๆ
      const searchLower = term.toLowerCase();
      const filteredMerged = merged.filter(p => matchesSearch(p, searchLower));

      const formatted = filteredMerged
        .map((p, index) => ({ id: index + 1, ...p }))
        .sort((a, b) => {
          const timeA = new Date(a.groupScrapedAt || a.timestamp || a.rawTimestamp || 0).getTime();
          const timeB = new Date(b.groupScrapedAt || b.timestamp || b.rawTimestamp || 0).getTime();
          return timeB - timeA;
        });

      setResults(formatted);
      setShowResults(true);
    } catch (e) {
      // ถ้า API ใดๆ ล้มเหลว ให้ถอยไปกรองข้อมูลภายในหน้า
      const searchLower = term.toLowerCase();
      const filtered = allResults.filter(result => matchesSearch(result, searchLower));
      setResults(filtered);
      setShowResults(true);
    }
  };

  const handleSelectSaved = (e) => {
    const value = e.target.value;
    // เลือกจากประวัติ: ตั้งค่าในช่องค้นหาเฉยๆ ไม่ค้นหาอัตโนมัติ และไม่เขียน storage
    setSearchTerm(value);
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

  const formatDateTime = (isoString) => {
    if (!isoString) return 'ไม่ระบุเวลา';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'ไม่ระบุเวลา';
    return d.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // แสดงผลลัพธ์ที่กรองแล้ว
  const filteredResults = results;

  const stats = useMemo(() => ({
    total: results.length,
    withContact: results.filter(r => r.contact?.hasContact).length,
    withPrice: results.filter(r => r.productInfo?.prices?.length > 0).length,
    withLocation: results.filter(r => r.productInfo?.locations?.length > 0).length,
    avgCompleteness: results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + calculateCompleteness(r), 0) / results.length)
      : 0
  }), [results]);

  // 🔹 สถานะโหลดข้อมูล
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-blue-50">
        <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
        <p className="text-blue-800 font-medium">กำลังโหลดข้อมูลจาก API...</p>
        <p className="text-blue-600 text-sm mt-2">กรุณารอสักครู่</p>
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
          <div className="flex items_center space-x-4">
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

          {!loading && allResults.length > 0 && (
            <div className="mb-6">
              <p className="text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                ✅ โหลดข้อมูลเสร็จสิ้น ({allResults.length} รายการ){latestScrapedAt ? ` · อัปเดตล่าสุด: ${formatDateTime(latestScrapedAt)}` : ''}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 mb-4">
            <div className="flex gap-4 items-center">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="พิมพ์ข้อความที่นี่..."
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
            <div className="flex gap-3 items-center">
              <label className="text-blue-800 text-sm">ประวัติการค้นหา:</label>
              <select
                className="bg-blue-50 border-2 border-blue-200 text-blue-900 rounded-xl px-3 py-2 min-w-[240px]"
                value={savedQueries.includes(searchTerm) ? searchTerm : ''}
                onChange={handleSelectSaved}
              >
                <option value="">— เลือกคำค้นที่บันทึกไว้ —</option>
                {savedQueries.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        {showResults && (
          <div>
            <h3 className="text-2xl font-bold text-blue-900 mb-6">
              ผลการค้นหา {results.length} รายการ
              {searchTerm && (
                <span className="text-lg font-normal text-blue-600 ml-2">
                  (ค้นหา: "{searchTerm}")
                </span>
              )}
            </h3>

            {results.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-blue-200 p-16 text-center shadow-xl">
                <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify_center mx-auto mb-6">
                  <Search className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-blue-900 mb-2">
                  {allResults.length === 0 ? 'ยังไม่ได้โหลดข้อมูล' : 'ไม่พบผลการค้นหา'}
                </h3>
                <p className="text-blue-600">
                  {allResults.length === 0 
                    ? 'กรุณากดปุ่ม "โหลดข้อมูลจาก API" เพื่อเริ่มต้น' 
                    : `ไม่พบข้อมูลที่ตรงกับ "${searchTerm}"`
                  }
                </p>
              </div>
            ) : (
              results.map((result) => (
                <div key={result.id} className="bg-white rounded-2xl p-6 mb-6 border-2 border-blue-200 shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-lg text-blue-900">{result.author}</h4>
                    <a href={result.postLink} target="_blank" rel="noreferrer" className="text-blue-600 font-medium flex items-center">
                      <ExternalLink className="w-4 h-4 mr-1" /> ดูโพสต์
                    </a>
                  </div>
                  <div className="text-xs text-blue-600 mb-3">
                    เวลาอัปเดต: {formatDateTime(result.groupScrapedAt || result.timestamp || result.rawTimestamp)}
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

