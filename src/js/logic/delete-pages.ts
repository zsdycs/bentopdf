import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile } from '../utils/helpers.js';
import { state } from '../state.js';

import { PDFDocument as PDFLibDocument } from 'pdf-lib';

export async function deletePages() {
  // @ts-expect-error TS(2339) FIXME: Property 'value' does not exist on type 'HTMLEleme... Remove this comment to see the full error message
  const pageInput = document.getElementById('pages-to-delete').value;
  if (!pageInput) {
    showAlert('无效输入', '请输入要删除的页码。');
    return;
  }
  showLoader('正在删除页面...');
  try {
    const totalPages = state.pdfDoc.getPageCount();
    const indicesToDelete = new Set();
    const ranges = pageInput.split(',');

    for (const range of ranges) {
      const trimmedRange = range.trim();
      if (trimmedRange.includes('-')) {
        const [start, end] = trimmedRange.split('-').map(Number);
        if (
          isNaN(start) ||
          isNaN(end) ||
          start < 1 ||
          end > totalPages ||
          start > end
        )
          continue;
        for (let i = start; i <= end; i++) indicesToDelete.add(i - 1);
      } else {
        const pageNum = Number(trimmedRange);
        if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) continue;
        indicesToDelete.add(pageNum - 1);
      }
    }

    if (indicesToDelete.size === 0) {
      showAlert('无效输入', '没有选择有效的要删除的页面。');
      hideLoader();
      return;
    }
    if (indicesToDelete.size >= totalPages) {
      showAlert('无效输入', '您不能删除所有页面。');
      hideLoader();
      return;
    }

    const indicesToKeep = Array.from(
      { length: totalPages },
      (_, i) => i
    ).filter((index) => !indicesToDelete.has(index));
    const newPdf = await PDFLibDocument.create();
    const copiedPages = await newPdf.copyPages(state.pdfDoc, indicesToKeep);
    copiedPages.forEach((page: any) => newPdf.addPage(page));

    const newPdfBytes = await newPdf.save();
    downloadFile(
      new Blob([new Uint8Array(newPdfBytes)], { type: 'application/pdf' }),
      'deleted-pages.pdf'
    );
  } catch (e) {
    console.error(e);
    showAlert('错误', '无法删除页面。');
  } finally {
    hideLoader();
  }
}

export function setupDeletePagesTool() {
  const input = document.getElementById('pages-to-delete') as HTMLInputElement;
  if (!input) return;

  const updateHighlights = () => {
    const val = input.value;
    const pagesToDelete = new Set<number>();

    const parts = val.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) pagesToDelete.add(i);
        }
      } else {
        const num = Number(trimmed);
        if (!isNaN(num)) pagesToDelete.add(num);
      }
    }

    const thumbnails = document.querySelectorAll('#delete-pages-preview .page-thumbnail');
    thumbnails.forEach((thumb) => {
      const pageNum = parseInt((thumb as HTMLElement).dataset.pageNumber || '0');
      const innerContainer = thumb.querySelector('div.relative');

      if (pagesToDelete.has(pageNum)) {
        innerContainer?.classList.add('border-red-500');
        innerContainer?.classList.remove('border-gray-600');
      } else {
        innerContainer?.classList.remove('border-red-500');
        innerContainer?.classList.add('border-gray-600');
      }
    });
  };

  input.addEventListener('input', updateHighlights);
  updateHighlights();
}
