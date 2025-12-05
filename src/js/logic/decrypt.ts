import { showLoader, hideLoader, showAlert } from '../ui.js';
import {
  downloadFile,
  initializeQpdf,
  readFileAsArrayBuffer,
} from '../utils/helpers.js';
import { state } from '../state.js';

export async function decrypt() {
  const file = state.files[0];
  const password = (
    document.getElementById('password-input') as HTMLInputElement
  )?.value;

  if (!password) {
    showAlert('需要输入', '请输入PDF密码。');
    return;
  }

  const inputPath = '/input.pdf';
  const outputPath = '/output.pdf';
  let qpdf: any;

  try {
    showLoader('正在初始化解密...');
    qpdf = await initializeQpdf();

    showLoader('正在读取加密的PDF...');
    const fileBuffer = await readFileAsArrayBuffer(file);
    const uint8Array = new Uint8Array(fileBuffer as ArrayBuffer);

    qpdf.FS.writeFile(inputPath, uint8Array);

    showLoader('正在解密PDF...');

    const args = [inputPath, '--password=' + password, '--decrypt', outputPath];

    try {
      qpdf.callMain(args);
    } catch (qpdfError: any) {
      console.error('qpdf execution error:', qpdfError);

      if (
        qpdfError.message?.includes('invalid password') ||
        qpdfError.message?.includes('password')
      ) {
        throw new Error('INVALID_PASSWORD');
      }
      throw qpdfError;
    }

    showLoader('正在准备下载...');
    const outputFile = qpdf.FS.readFile(outputPath, { encoding: 'binary' });

    if (outputFile.length === 0) {
      throw new Error('解密结果为空文件。');
    }

    const blob = new Blob([outputFile], { type: 'application/pdf' });
    downloadFile(blob, `unlocked-${file.name}`);

    hideLoader();
    showAlert(
      '成功',
      'PDF解密成功！已开始下载。'
    );
  } catch (error: any) {
    console.error('Error during PDF decryption:', error);
    hideLoader();

    if (error.message === 'INVALID_PASSWORD') {
      showAlert(
        '密码错误',
        '您输入的密码不正确。请重试。'
      );
    } else if (error.message?.includes('password')) {
      showAlert(
        '密码错误',
        '无法使用提供的密码解密PDF。'
      );
    } else {
      showAlert(
        '解密失败',
        `发生错误：${error.message || '您输入的密码错误或文件已损坏。'}`
      );
    }
  } finally {
    try {
      if (qpdf?.FS) {
        try {
          qpdf.FS.unlink(inputPath);
        } catch (e) {
          console.warn('Failed to unlink input file:', e);
        }
        try {
          qpdf.FS.unlink(outputPath);
        } catch (e) {
          console.warn('Failed to unlink output file:', e);
        }
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup WASM FS:', cleanupError);
    }
  }
}
