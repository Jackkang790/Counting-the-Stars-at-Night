// 건물 목록. 건물 추가 = 파일 하나(h4.js — h1.js 를 복사해 고치기) 만들고 아래 배열에 넣기.
// 배열 순서 = 지도 번호 · 별자리 순서.
import h1 from './h1.js';
import h2 from './h2.js';
import h3 from './h3.js';

export const HOUSES = [h1, h2, h3];
export const houseById = (id) => HOUSES.find((h) => h.id === id);
