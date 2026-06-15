// 변환기는 main(자동 동기화)과 공유하므로 src/shared 에 둔다. renderer 는 re-export 만.
export { blocksToMarkdown } from '../../../shared/markdown';
