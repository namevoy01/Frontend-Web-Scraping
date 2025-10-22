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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [latestScrapedAt, setLatestScrapedAt] = useState(null);
  const [savedQueries, setSavedQueries] = useState([]); // รายการค้นหาที่บันทึกไว้
  const [searchLoading, setSearchLoading] = useState(false); // สถานะ loading ของปุ่มค้นหา
  const [showSuggestions, setShowSuggestions] = useState(false); // แสดง/ซ่อน suggestions
  const [filteredSuggestions, setFilteredSuggestions] = useState([]); // รายการ suggestions ที่กรองแล้ว
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1); // index ของ suggestion ที่เลือก
  const [selectedCategory, setSelectedCategory] = useState(''); // category ที่เลือกสำหรับกรอง

  const SAVED_QUERIES_KEY = 'distributorSavedSearchTerms';
  const SINGLE_SEARCH_KEY = 'distributorSearchTerm';
  const MAX_SAVED = 10;

  // 🔹 Category options
  const CATEGORY_OPTIONS = [
    { value: '', label: '— เลือกหมวดหมู่ —' },
    { value: 'beer', label: 'เบียร์' },
    { value: 'brands', label: 'ยี่ห้อ' },
    { value: 'distributor', label: 'ตัวแทนจำหน่าย' },
    { value: 'selling', label: 'ขาย' },
    { value: 'delivery', label: 'จัดส่ง' },
    { value: 'price', label: 'ราคา' },
    { value: 'contact', label: 'ติดต่อ' }
  ];

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

  // 🔹 Helper: ตรวจสอบว่าโพสต์ตรงกับ category หรือไม่
  const matchesCategory = (post, category) => {
    if (!category) return true;
    return post.keywords?.some(k => k?.category === category);
  };

  // 🔹 ดึงข้อมูลจาก localStorage (เฉพาะรายการประวัติ) เมื่อเริ่มต้น
  useEffect(() => {
    const initialSaved = readSavedQueries();
    setSavedQueries(initialSaved);
  }, []);

  // 🔹 Auto complete logic
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = savedQueries.filter(query => 
      query.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    setFilteredSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setSelectedSuggestionIndex(-1);
  }, [searchTerm, savedQueries]);

  // 🔹 ดึงข้อมูลจาก API
  const fetchData = async (query = '') => {
    setLoading(true);
    setError('');
    try {
      const url = query ? `http://localhost:4000/${encodeURIComponent(query)}` : 'http://localhost:4000/posts';
      const response = await fetch(url);
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
    // 🔹 ป้องกันการกดปุ่มซ้ำ
    if (searchLoading) {
      console.log('⚠️ Search is already in progress, please wait...');
      return;
    }

    const term = (searchTerm || '').trim();
    if (!term) {
      setResults(allResults);
      setShowResults(true);
      return;
    }

    // 🔹 บันทึก search term ลง localStorage (แต่ไม่อ่านค่าจาก storage มาใช้)
    persistQueryIfNeeded(term);

    // 🔹 แสดงผลลัพธ์จากข้อมูลที่มีอยู่ก่อน (กรองจาก allResults)
    const searchLower = term.toLowerCase();
    const filtered = allResults.filter(result => 
      matchesSearch(result, searchLower) && matchesCategory(result, selectedCategory)
    );
    const formatted = filtered
      .map((p, index) => ({ id: index + 1, ...p }))
      .sort((a, b) => {
        const timeA = new Date(a.groupScrapedAt || a.timestamp || a.rawTimestamp || 0).getTime();
        const timeB = new Date(b.groupScrapedAt || b.timestamp || b.rawTimestamp || 0).getTime();
        return timeB - timeA;
      });

    setResults(formatted);
    setShowResults(true);

    // 🔹 ส่ง API ไปที่ http://localhost:4000/:query และ http://localhost:3001/search ในพื้นหลัง
    setSearchLoading(true);
    console.log('🔍 Starting search for:', term);
    
    try {
      // 🔹 เรียก API 4000 ก่อน (หลัก)
      const postsResp = await fetch(`http://localhost:4000/${encodeURIComponent(term)}`);
      
      if (postsResp.ok) {
        const postsData = await postsResp.json();
        console.log('✅ Posts API response:', postsData);
        console.log('📊 Posts API groups count:', postsData.groups?.length || 0);
        console.log('📊 Posts API total posts:', postsData.summary?.totalPosts || 0);
        
        // 🔹 รวมข้อมูลจาก posts API
        const parseGroupsToPosts = (root) => {
          const groups = Array.isArray(root?.groups) ? root.groups : [];
          console.log('🔍 Processing groups:', groups.length);
          
          return groups.flatMap((group) => {
            const groupScrapedAt = group.scrapedAt || group.lastUpdated || root.scrapedAt || null;
            const posts = Array.isArray(group.posts) ? group.posts : [];
            console.log(`📝 Group "${group.groupName}" has ${posts.length} posts`);
            
            return posts.map((post) => ({ ...post, groupScrapedAt, rootQuery: root.query }));
          });
        };

        const postsFromAPI = parseGroupsToPosts(postsData);
        console.log('📋 Posts from API:', postsFromAPI.length);
        
        // 🔹 ล้างข้อมูลเก่าและใช้ข้อมูลใหม่จาก API 4000 เท่านั้น
        console.log('🧹 Clearing old data and using new data from API 4000');
        console.log('📊 Old allResults:', allResults.length);
        console.log('📊 New posts from API:', postsFromAPI.length);

        // 🔹 อัปเดตข้อมูลทั้งหมดด้วยข้อมูลใหม่เท่านั้น
        setAllResults(postsFromAPI);
        
        // 🔹 กรองผลลัพธ์ใหม่ด้วยคำค้นและ category
        const searchLower = term.toLowerCase();
        const filtered = postsFromAPI.filter(result => 
          matchesSearch(result, searchLower) && matchesCategory(result, selectedCategory)
        );
        console.log('🔍 Filtered results:', filtered.length);
        
        const formatted = filtered
          .map((p, index) => ({ id: index + 1, ...p }))
          .sort((a, b) => {
            const timeA = new Date(a.groupScrapedAt || a.timestamp || a.rawTimestamp || 0).getTime();
            const timeB = new Date(b.groupScrapedAt || b.timestamp || b.rawTimestamp || 0).getTime();
            return timeB - timeA;
          });

        console.log('📋 Final formatted results:', formatted.length);
        setResults(formatted);
        setShowResults(true);
        
        // 🔹 อัปเดตเวลาล่าสุด
        if (postsData.scrapedAt) {
          setLatestScrapedAt(postsData.scrapedAt);
        }
        
        console.log('✅ Search completed successfully with', formatted.length, 'results');
        
        // 🔹 ส่ง API 3001 และรอให้เสร็จก่อนค่อยเปิดปุ่ม
        fetch(`http://localhost:3001/search?q=${encodeURIComponent(term)}`)
          .then(searchResp => {
            if (searchResp.ok) {
              return searchResp.json();
            } else {
              console.log('⚠️ Search API failed:', searchResp.status);
              return null;
            }
          })
          .then(searchData => {
            if (searchData) {
              console.log('✅ Search API response (background):', searchData);
              // สามารถเพิ่มข้อมูลจาก search API ได้ที่นี่ถ้าต้องการ
            }
          })
          .catch(searchError => {
            console.log('⚠️ Search API CORS error (background):', searchError.message);
            console.log('ℹ️ Background search failed, but main results are already shown');
          })
          .finally(() => {
            // 🔹 เปิดปุ่มให้กดได้ใหม่หลังจาก API 3001 เสร็จ
            setSearchLoading(false);
            console.log('✅ All APIs completed, button re-enabled');
          });
      } else {
        console.log('⚠️ Posts API ส่งคืนสถานะ: ' + postsResp.status);
        console.log('❌ Posts API failed, no data to show');
        setSearchLoading(false);
        console.log('✅ Search completed with API error, button re-enabled');
      }
    } catch (e) {
      console.log('⚠️ API failed:', e.message);
      // ไม่แสดง error ให้ผู้ใช้ เพราะข้อมูลหลักแสดงแล้ว
      setSearchLoading(false);
      console.log('✅ Search completed with error, button re-enabled');
    }
  };


  // 🔹 Handle keyboard navigation for auto complete
  const handleKeyDown = (e) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < filteredSuggestions.length) {
          setSearchTerm(filteredSuggestions[selectedSuggestionIndex]);
          setShowSuggestions(false);
          handleSearch();
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // 🔹 Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  // 🔹 Handle input focus - แสดง suggestions ทันทีเมื่อ focus
  const handleInputFocus = () => {
    if (savedQueries.length > 0) {
      setFilteredSuggestions(savedQueries);
      setShowSuggestions(true);
    }
  };

  // 🔹 Handle input blur (with delay to allow clicks)
  const handleInputBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }, 200);
  };

  // 🔹 Handle category change
  const handleCategoryChange = (e) => {
    const category = e.target.value;
    setSelectedCategory(category);
    
    // กรองผลลัพธ์ใหม่ทันที
    const searchLower = searchTerm.toLowerCase();
    const filtered = allResults.filter(result => 
      matchesSearch(result, searchLower) && matchesCategory(result, category)
    );
    const formatted = filtered
      .map((p, index) => ({ id: index + 1, ...p }))
      .sort((a, b) => {
        const timeA = new Date(a.groupScrapedAt || a.timestamp || a.rawTimestamp || 0).getTime();
        const timeB = new Date(b.groupScrapedAt || b.timestamp || b.rawTimestamp || 0).getTime();
        return timeB - timeA;
      });
    
    setResults(formatted);
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

          {allResults.length > 0 && (
            <div className="mb-6">
              <p className="text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                ✅ โหลดข้อมูลเสร็จสิ้น ({allResults.length} รายการ){latestScrapedAt ? ` · อัปเดตล่าสุด: ${formatDateTime(latestScrapedAt)}` : ''}
              </p>
            </div>
          )}


          <div className="flex flex-col gap-3 mb-4">
            <div className="flex gap-4 items-center relative">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="พิมพ์ข้อความที่นี่..."
                  className="w-full bg-blue-50 border-2 border-blue-200 text-blue-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                
                {/* Auto Complete Suggestions */}
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border-2 border-blue-200 rounded-xl shadow-lg z-50 mt-1 max-h-60 overflow-y-auto">
                    {filteredSuggestions.map((suggestion, index) => (
                      <div
                        key={suggestion}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={`px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${
                          index === selectedSuggestionIndex
                            ? 'bg-blue-100 text-blue-900'
                            : 'hover:bg-blue-50 text-blue-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Search className="w-4 h-4 text-blue-500" />
                          <span>{suggestion}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <button
                onClick={handleSearch}
                disabled={searchLoading}
                className={`px-6 py-3 rounded-xl shadow-md transition-all flex items-center space-x-2 ${
                  searchLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:shadow-lg'
                } text-white`}
              >
                {searchLoading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>กำลังส่ง...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>ค้นหา</span>
                  </>
                )}
              </button>
            </div>
            
            {/* Category Filter */}
            <div className="flex gap-3 items-center">
              <label className="text-blue-800 text-sm font-medium">กรองตามหมวดหมู่:</label>
              <select
                value={selectedCategory}
                onChange={handleCategoryChange}
                className="bg-blue-50 border-2 border-blue-200 text-blue-900 rounded-xl px-3 py-2 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
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
              {selectedCategory && (
                <span className="text-lg font-normal text-green-600 ml-2">
                  (หมวดหมู่: "{CATEGORY_OPTIONS.find(opt => opt.value === selectedCategory)?.label}")
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
                    <div className="flex items-center space-x-3">
                      {result.authorProfileLink && (
                        <a 
                          href={result.authorProfileLink} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-green-600 font-medium flex items-center hover:text-green-700 transition-colors"
                        >
                          <User className="w-4 h-4 mr-1" /> โปรไฟล์
                        </a>
                      )}
                      <a 
                        href={result.postLink} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-blue-600 font-medium flex items-center hover:text-blue-700 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" /> ดูโพสต์
                      </a>
                    </div>
                  </div>
                  <div className="text-xs text-blue-600 mb-3">
                    เวลาอัปเดต: {formatDateTime(result.groupScrapedAt || result.timestamp || result.rawTimestamp)}
                    {result.query && (
                      <span className="ml-3 text-green-600">
                        ค้นหา: "{result.query}"
                      </span>
                    )}
                    {result.rootQuery && result.rootQuery !== result.query && (
                      <span className="ml-3 text-purple-600">
                        API: "{result.rootQuery}"
                      </span>
                    )}
                  </div>
                  <p className="text-blue-800 mb-4">{result.text}</p>
                  {result.imageUrl && (
                    <img src={result.imageUrl} alt="post" className="rounded-xl w-full max-h-80 object-cover border" />
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

