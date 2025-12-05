import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile, readFileAsArrayBuffer } from '../utils/helpers.js';
import { state } from '../state.js';
import { PDFDocument } from 'pdf-lib';

export function flattenFormsInDoc(pdfDoc) {
  const form = pdfDoc.getForm();
  form.flatten();
}

export async function flatten() {
  if (state.files.length === 0) {
    showAlert('无文件', '请至少选择一个PDF文件。');
    return;
  }

  try {
    if (state.files.length === 1) {
      showLoader('正在拼合PDF...');
      const file = state.files[0];
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const pdfDoc = await PDFDocument.load(arrayBuffer as ArrayBuffer, { ignoreEncryption: true });

      try {
        flattenFormsInDoc(pdfDoc);
      } catch (e) {
        if (e.message.includes('getForm')) {
          // Ignore if no form found
        } else {
          throw e;
        }
      }

      const flattenedBytes = await pdfDoc.save();
      downloadFile(
        new Blob([flattenedBytes as any], { type: 'application/pdf' }),
        `flattened_${file.name}`
      );
      hideLoader();
    } else {
      showLoader('正在拼合多个PDF...');
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      let processedCount = 0;

      for (let i = 0; i < state.files.length; i++) {
        const file = state.files[i];
        showLoader(`正在拼合 ${i + 1}/${state.files.length}：${file.name}...`);

        try {
          const arrayBuffer = await readFileAsArrayBuffer(file);
          const pdfDoc = await PDFDocument.load(arrayBuffer as ArrayBuffer, { ignoreEncryption: true });

          try {
            flattenFormsInDoc(pdfDoc);
          } catch (e) {
            if (e.message.includes('getForm')) {
              // Ignore if no form found
            } else {
              throw e;
            }
          }

          const flattenedBytes = await pdfDoc.save();
          zip.file(`flattened_${file.name}`, flattenedBytes);
          processedCount++;
        } catch (e) {
          console.error(`Error processing ${file.name}:`, e);
        }
      }

      if (processedCount > 0) {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadFile(zipBlob, 'flattened_pdfs.zip');
        showAlert('成功', `处理了 ${processedCount} 个PDF。`);
      } else {
        showAlert('错误', '无法处理任何PDF。');
      }
      hideLoader();
    }
  } catch (e) {
    console.error(e);
    hideLoader();
    showAlert('错误', e.message || '发生意外错误。');
  }
}
