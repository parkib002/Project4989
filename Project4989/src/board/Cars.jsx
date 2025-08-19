import axios from 'axios';
import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom';
import './cars.css';
import { useMemo } from 'react';

const Cars = () => {

  const [postList,setPostList]=useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const navi=useNavigate('');
  const location = useLocation();


 // 쿼리 변화시에만 현재 페이지/스크롤 갱신
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const page = Number(q.get('page')) || 1;
    setCurrentPage(page);
    window.scrollTo(0, 0); // 페이지 바뀔 때만 맨 위로
  }, [location.search]); 
  
  // 필터 / 페이지 계산 (메모)
  const cars = useMemo(() => postList.filter(p => p.postType === 'CARS'), [postList]);
  const totalPages = useMemo(() => Math.ceil(cars.length / itemsPerPage), [cars, itemsPerPage]);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = useMemo(() => cars.slice(startIndex, startIndex + itemsPerPage), [cars, startIndex, itemsPerPage]);

  const handlePageChange = (page) => {
    const q = new URLSearchParams(location.search);
    q.set('page', page);
    navi(`${location.pathname}?${q.toString()}`, { replace: true });
  };
  const handleNextPage = () => { if (currentPage < totalPages) handlePageChange(currentPage + 1); };
  const handlePrevPage = () => { if (currentPage > 1) handlePageChange(currentPage - 1); };

  // 상세에서 돌아왔을 때 클릭한 카드로 스크롤
  useEffect(() => {
    const focusId = location.state?.focusId;
    if (!focusId) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(`post-${focusId}`);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'auto' });
        el.classList.add('focused-card');
        setTimeout(() => el.classList.remove('focused-card'), 700);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [postList, currentPage, location.state]);

  const fromUrl = `${location.pathname}${location.search || ''}`;


  const list=()=>{
    let url="http://localhost:4989/post/list";

    axios.get(url)
    .then(res=>{
      console.log(res.data);
      setPostList(res.data);
    })
    .catch(err => {
      console.error("에러 발생:", err);
    });
  };

  useEffect(()=>{
    console.log("list");
    list();
  },[])

  useEffect(() => {
    console.log(postList); // mainPhotoUrl 값 확인
  }, [postList]);

  const photoUrl="http://localhost:4989/save/";

 
  // 현재 페이지의 아이템들 계산
  // const startIndex = (currentPage - 1) * itemsPerPage;
  // const endIndex = startIndex + itemsPerPage;
  // const currentItems = postList.filter(p => p.postType === 'CARS').slice(startIndex, endIndex);
  // const totalPages = Math.ceil(postList.filter(p => p.postType === 'CARS').length / itemsPerPage);

  // // 디버깅용 콘솔 로그
  // console.log('총 아이템 수:', postList.filter(p => p.postType === 'CARS').length);
  // console.log('페이지당 아이템 수:', itemsPerPage);
  // console.log('총 페이지 수:', totalPages);
  // console.log('현재 페이지:', currentPage);
  // console.log('현재 아이템 수:', currentItems.length);

  // const handleNextPage = () => {
  //   if (currentPage < totalPages) {
  //     setCurrentPage(currentPage + 1);
  //   }
  // }

  // const handlePrevPage = () => {
  //   if (currentPage > 1) {
  //     setCurrentPage(currentPage - 1);
  //   }
  // }

  // const handlePageChange = (page) => {
  //   setCurrentPage(page);
  // }

  return (
    <div className="cars-page">
      <div className="cars-container">
        {/* 헤더 섹션 */}
        <div className="cars-header">
          <h1 className="cars-title">자동차 목록</h1>
          <p className="cars-subtitle">다양한 자동차를 찾아보세요</p>
        </div>

        {/* 등록 버튼 */}
        <button 
          type='button' 
          className="cars-register-btn" 
          onClick={()=>{
            navi("/board/post");
          }}
        >
          자동차 등록하기
        </button>

        {/* 상품 목록 */}
        {postList.filter(p => p.postType === 'CARS').length > 0 ? (
          <>
            <div className="cars-grid">
              {currentItems.map(p => (
                <div id={`post-${p.postId}`}
                  key={p.postId}
                  className="cars-card"
                  onClick={() =>
                    navi(`/board/GoodsDetail?postId=${p.postId}`, {
                      state: { from: fromUrl, page: currentPage, focusId: p.postId }
                    })
                  }>
                  <div className="cars-image">
                    {p.mainPhotoUrl ? (
                      <img 
                        src={photoUrl + p.mainPhotoUrl} 
                        alt={p.title} 
                      />
                    ) : (
                      <div className="cars-image-placeholder">
                        이미지 없음
                      </div>
                    )}
                  </div>
                  <div className="cars-info">
                    <h3 className="cars-title-text">{p.title}</h3>
                    <div className="cars-price">
                      {p.price ? new Intl.NumberFormat().format(p.price) + '원' : '가격 미정'}
                    </div>
                    <div className="cars-member">판매자: {p.nickname}</div>
                    <div>조회수: {p.viewCount}</div>
                    <div>{p.status==='ON_SALE'?'판매중':p.status==='RESERVED'?'예약':'판매완료'}</div>
                    <div className="cars-date">
                      {p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 페이지네이션 */}
            <div className="cars-pagination">
              <div className="cars-page-info">
                총 {cars.length}개 중 {startIndex + 1}-{Math.min(startIndex + itemsPerPage, cars.length)}개 표시
              </div>
              
              {totalPages > 1 && (
                <>
                  <button 
                    className="cars-page-btn cars-prev-btn"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                  >
                    이전
                  </button>
                  
                  <div className="cars-page-numbers">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        className={`cars-page-number ${currentPage === page ? 'active' : ''}`}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  
                  <button 
                    className="cars-page-btn cars-next-btn"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    다음
                  </button>
                </>
              )}
              
              {totalPages <= 1 && (
                <div className="cars-page-single">
                  페이지 1 / 1
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="cars-empty">
            <div className="cars-empty-icon">🚗</div>
            <div className="cars-empty-text">등록된 자동차가 없습니다</div>
            <button 
              className="cars-empty-btn" 
              onClick={()=>{
                navi("/board/post");
              }}
            >
              첫 번째 자동차 등록하기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Cars
