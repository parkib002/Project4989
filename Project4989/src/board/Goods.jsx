import axios from 'axios';
import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom';
import './goods.css';

const Goods = () => {

  const navi=useNavigate('');
  const location = useLocation();

  const [postList,setPostList]=useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [showScrollTop, setShowScrollTop] = useState(false);

// ✅ 중고물품 상세 캐시: postId -> detail
  const [itemDetailMap, setItemDetailMap] = useState({});
  const TRADE_FROM_CODE = { 1: 'SALE', 2: 'AUCTION', 3: 'SHARE' }; // 백이 숫자코드면 매핑

  const normalizeTrade = (v) => {
  const s = (v ?? '').toString().trim();
  const u = s.toUpperCase();
  if (u === '1' || u === 'SALE'    || s === '판매') return 'SALE';
  if (u === '2' || u === 'AUCTION' || s === '경매') return 'AUCTION';
  if (u === '3' || u === 'SHARE'   || s === '나눔' || u === 'GIVE' || u === 'GIVEAWAY' || u === 'FREE') return 'SHARE';
  return u; // 혹시 다른 값이 오면 대문자 그대로
};

  // 스크롤 이벤트 핸들러
  const handleScroll = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    setShowScrollTop(scrollTop > 300);
  };

  // 최상단으로 스크롤하는 함수
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // 스크롤 이벤트 리스너 등록
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

// ✅ 라디오 필터 상태
  // categoryId: 1 전자, 2 의류, 3 가구 (예시)
  // status: ON_SALE(판매중), RESERVED(예약), SOLD_OUT(판매완료) (백엔드에서 오는 값과 매칭)
  const [filters, setFilters] = useState({
    categoryId: 'ALL',
    status: 'ALL',
    tradeType: 'ALL', 
  });

// ② 쿼리 변화시에만 현재 페이지/스크롤 갱신
useEffect(() => {
  const q = new URLSearchParams(location.search);
  const page = Number(q.get('page')) || 1;
  setCurrentPage(page);
  window.scrollTo(0, 0); // 페이지 바뀔 때만 맨 위로
}, [location.search]);

// ③ 페이지 변경 시에는 navigate만 (setState/scrollTo 삭제)
const handlePageChange = (page) => {
  const q = new URLSearchParams(location.search);
  q.set('page', page);
  navi(`${location.pathname}?${q.toString()}`, { replace: true });
};

const handleNextPage = () => {
  if (currentPage < totalPages) handlePageChange(currentPage + 1);
};
const handlePrevPage = () => {
  if (currentPage > 1) handlePageChange(currentPage - 1);
};

useEffect(() => {
  const focusId = location.state?.focusId;
  if (!focusId) return;

  // 렌더/이미지 레이아웃이 잡힌 다음 스크롤
  const timer = setTimeout(() => {
    const el = document.getElementById(`post-${focusId}`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'auto' }); // 또는 'smooth'
      // 옵션: 잠깐 하이라이트 주기
      el.classList.add('focused-card');
      setTimeout(() => el.classList.remove('focused-card'), 700);
    }
  }, 0);

  return () => clearTimeout(timer);
}, [postList, currentPage, location.state]);


  // 공통 목록 호출
  const list = () => {
    const url = "http://localhost:4989/post/list";
    axios.get(url)
      .then(async (res) => {
        setPostList(res.data || []);
      })
      .catch(err => {
        console.error("에러 발생:", err);
      });
  };

  useEffect(() => {
    console.log("list");
    list();
  }, []);


  // ✅ 목록이 갱신되면, ITEMS 대상의 상세를 프리패치해서 Map에 저장
  useEffect(() => {
    const items = (postList || []).filter(p => p.postType === 'ITEMS');
    if (items.length === 0) return;

    // 이미 캐시되어 있는 것은 스킵
    const needIds = items
      .map(p => p.postId)
      .filter(id => itemDetailMap[id] === undefined);

    if (needIds.length === 0) return;

    // 병렬 호출 (부하가 크면 p-limit 같은 걸로 동시성 제한)
    // 가정: /post/itemdetail?postId=... 가 상세를 하나 반환 (ex: { postId, categoryId, condition, ... })
    Promise.all(
      needIds.map(id =>
        axios.get(`http://localhost:4989/post/itemdetail`, { params: { postId: id } })
          .then(r => ({ id, detail: r.data }))
          .catch(e => {
            console.warn('itemdetail 실패 postId=', id, e);
            return ({ id, detail: null });
          })
      )
    ).then(results => {
      const next = { ...itemDetailMap };
      results.forEach(({ id, detail }) => {
        next[id] = detail;
      });
      setItemDetailMap(next);
    });
  }, [postList]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ 공통 + 상세를 머지한 배열 (계산 효율을 위해 useMemo)
  const mergedItems = useMemo(() => {
    const itemsOnly = (postList || []).filter(p => p.postType === 'ITEMS');
    const arr = itemsOnly.map(p => {
      const d = itemDetailMap[p.postId] || {};
      const commonTrade = p.tradeType ?? p.trade_type ?? p.TRADE_TYPE;

    return {
      ...p,
      ...d,
      // ✅ tradeType은 공통 리스트 기준 + 정규화
      tradeType: normalizeTrade(commonTrade),
    };
    });
    // 디버깅
    console.log('mergedItems 샘플:', arr.slice(0, 3));
    console.log('tradeType 값들:', arr.map(item => ({ postId: item.postId, tradeType: item.tradeType })));
    return arr;
  }, [postList, itemDetailMap]);

  // ✅ 라디오 필터 로직
  const filteredItems = useMemo(() => {
    return mergedItems.filter(it => {
      // categoryId: 숫자 또는 문자열일 수 있으니 느슨히 비교
      if (filters.categoryId !== 'ALL') {
        // 상세에 categoryId가 없으면 통과시키지 않음
        if (String(it.categoryId) !== String(filters.categoryId)) return false;
      }
      if (filters.status !== 'ALL') {
        if (String(it.status) !== String(filters.status)) return false;
      }
      if (filters.tradeType !== 'ALL') {
      if (normalizeTrade(it.tradeType) !== normalizeTrade(filters.tradeType)) return false;
    }
      return true;
    });
  }, [mergedItems, filters]);

  // ✅ 페이지네이션은 필터 이후 기준으로 계산
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredItems.slice(startIndex, endIndex);

  // 디버깅용 콘솔 로그
  console.log('필터 상태:', filters);
  console.log('필터링 후 총 아이템 수:', filteredItems.length);
  console.log('총 페이지 수:', totalPages);
  console.log('현재 페이지:', currentPage);
  console.log('현재 아이템 수:', currentItems.length);

  const fromUrl = `${location.pathname}${location.search || ''}`;
  const photoUrl = "http://localhost:4989/postphoto/";

  // ✅ 라디오 변경 핸들러
  const onChangeCategory = (e) => {
    setCurrentPage(1); // 필터 변경 시 첫 페이지로
    setFilters(prev => ({ ...prev, categoryId: e.target.value }));
  };
  const onChangeStatus = (e) => {
    setCurrentPage(1);
    setFilters(prev => ({ ...prev, status: e.target.value }));
  };
  const onChangeTradeType = (e) => {
  setCurrentPage(1);
  setFilters(prev => ({ ...prev, tradeType: e.target.value }));
  };
  
  // 필터 초기화 함수
  const resetFilters = () => {
    setCurrentPage(1);
    setFilters({
      categoryId: 'ALL',
      status: 'ALL',
      tradeType: 'ALL',
    });
  };


  return (
    <div className="goods-page">
      <div className="goods-container">
        {/* 헤더 섹션 */}
        <div className="goods-header">
          <h1 className="goods-title">중고물품 목록</h1>
          <p className="goods-subtitle">다양한 중고물품을 찾아보세요</p>
        </div>

        {/* search */}
        <button
                type="button"
                className="gooddetail-btn"
                onClick={() => navi(`/board/search`)}
              >
                search
              </button>

        {/* ✅ 라디오 필터 UI */}
        <div className="goods-filters">
          <div className="filter-group">
            <div className="filter-label">카테고리</div>
            <label><input type="radio" name="category" value="ALL" checked={filters.categoryId === 'ALL'} onChange={onChangeCategory} /> 전체</label>
            <label><input type="radio" name="category" value="1" checked={filters.categoryId === '1'} onChange={onChangeCategory} /> 전자제품</label>
            <label><input type="radio" name="category" value="2" checked={filters.categoryId === '2'} onChange={onChangeCategory} /> 의류</label>
            <label><input type="radio" name="category" value="3" checked={filters.categoryId === '3'} onChange={onChangeCategory} /> 가구</label>
          </div>

          <div className="filter-group">
            <div className="filter-label">상태</div>
            <label><input type="radio" name="status" value="ALL" checked={filters.status === 'ALL'} onChange={onChangeStatus} /> 전체</label>
            <label><input type="radio" name="status" value="ON_SALE" checked={filters.status === 'ON_SALE'} onChange={onChangeStatus} /> 판매중</label>
            <label><input type="radio" name="status" value="RESERVED" checked={filters.status === 'RESERVED'} onChange={onChangeStatus} /> 예약</label>
            <label><input type="radio" name="status" value="SOLD" checked={filters.status === 'SOLD'} onChange={onChangeStatus} /> 판매완료</label>
          </div>

          <div className="filter-group">
            <div className="filter-label">판매타입</div>
            <label><input type="radio" name="tradeType" value="ALL"     checked={filters.tradeType === 'ALL'}     onChange={onChangeTradeType} /> 전체</label>
            <label><input type="radio" name="tradeType" value="SALE"    checked={filters.tradeType === 'SALE'}    onChange={onChangeTradeType} /> 판매</label>
            <label><input type="radio" name="tradeType" value="AUCTION" checked={filters.tradeType === 'AUCTION'} onChange={onChangeTradeType} /> 경매</label>
            <label><input type="radio" name="tradeType" value="SHARE"   checked={filters.tradeType === 'SHARE'}   onChange={onChangeTradeType} /> 나눔</label>
          </div>

          {/* 필터 초기화 버튼 */}
          <div className="filter-reset-container">
            <button 
              type="button" 
              className="filter-reset-btn" 
              onClick={resetFilters}
              title="모든 필터 초기화"
            >
              필터 초기화
            </button>
          </div>

        </div>

        {/* 등록 버튼 */}
        <button 
          type='button' 
          className="goods-register-btn" 
          onClick={()=>{
            navi("/board/post");
          }}
        >
          물품 등록하기
        </button>

        {/* 상품 목록 */}
        {filteredItems.length > 0 ?(
          <>
            <div className="goods-grid">
              {currentItems.map(p => (
                <div id={`post-${p.postId}`}        // ← 스크롤 타겟
  key={p.postId}
  className="goods-card"
  onClick={() =>
    navi(`/board/GoodsDetail?postId=${p.postId}`, {
      state: { from: fromUrl, page: currentPage, focusId: p.postId, scrollY: window.scrollY },
    })
  }>
                  <div className="goods-image">
                    {p.mainPhotoUrl ? (
                      <img 
                        src={photoUrl + p.mainPhotoUrl} 
                        alt={p.title} 
                      />
                    ) : (
                      <div className="goods-image-placeholder">
                        이미지 없음
                      </div>
                    )}
                  </div>
                  <div className="goods-info">
                    <h3 className="goods-title-text">{p.title}</h3>
                    <div className="goods-price">
                      {p.price ? new Intl.NumberFormat().format(p.price) + '원' : '가격 미정'}
                    </div>

                    {/* ✅ 상세에서 온 값 안전 표시 */}
                    {/* <div className="goods-meta">
                      <span>카테고리: {p.categoryId === 1 ? '전자제품' : p.categoryId === 2 ? '의류' : p.categoryId === 3 ? '가구' : '-'}</span>
                    </div> */}

                    <div className="goods-member">판매자: {p.nickname}</div>
                    <div>조회수: {p.viewCount}</div>
                    <div className="goods-status">
                      <span className={`status-badge ${p.status === 'ON_SALE' ? 'on-sale' : p.status === 'RESERVED' ? 'reserved' : 'sold'}`}>
                        {p.status==='ON_SALE'?'판매중':p.status==='RESERVED'?'예약':'판매완료'}
                      </span>
                      <span className={`trade-type-badge ${p.tradeType === 'SALE' ? 'sale' : p.tradeType === 'AUCTION' ? 'auction' : p.tradeType === 'SHARE' ? 'share' : ''}`}>
                        {p.tradeType === 'SALE' ? '판매' : p.tradeType === 'AUCTION' ? '경매' : p.tradeType === 'SHARE' ? '나눔' : p.tradeType || '미정'}
                      </span>
                    </div>
                    <div className="goods-date">
                      {p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 페이지네이션 */}
            <div className="goods-pagination">
              <div className="goods-page-info">
                총 {filteredItems.length}개 중 {startIndex + 1}-{Math.min(endIndex, filteredItems.length)}개 표시
              </div>
              
              {totalPages > 1 ? (
                <>
                  <button className="goods-page-btn goods-prev-btn" onClick={handlePrevPage} disabled={currentPage === 1}>이전</button>
                  <div className="goods-page-numbers">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        className={`goods-page-number ${currentPage === page ? 'active' : ''}`}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button className="goods-page-btn goods-next-btn" onClick={handleNextPage} disabled={currentPage === totalPages}>다음</button>
                </>
              ) : (
                <div className="goods-page-single">페이지 1 / 1</div>
              )}
            </div>
          </>
        ) : (
          <div className="goods-empty">
            <div className="goods-empty-icon">📦</div>
            <div className="goods-empty-text">조건에 맞는 물품이 없습니다</div>
            <button className="goods-empty-btn" onClick={() => { navi("/board/post"); }}>
              첫 번째 물품 등록하기
            </button>
          </div>
        )}

        {/* 최상단으로 스크롤하는 화살표 버튼 */}
        {showScrollTop && (
          <button 
            className="scroll-to-top-btn"
            onClick={scrollToTop}
            title="최상단으로 이동"
          >
            ↑
          </button>
        )}
      </div>
    </div>
  )
}

export default Goods
