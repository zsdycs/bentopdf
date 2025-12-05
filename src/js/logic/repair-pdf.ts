import { showLoader, hideLoader, showAlert } from '../ui.js';
import {
    downloadFile,
    initializeQpdf,
    readFileAsArrayBuffer,
} from '../utils/helpers.js';
import { state } from '../state.js';
import JSZip from 'jszip';

export async function repairPdfFile(file: File): Promise<Uint8Array | null> {
    const inputPath = '/input.pdf';
    const outputPath = '/repaired_form.pdf';
    let qpdf: any;

    try {
        qpdf = await initializeQpdf();
        const fileBuffer = await readFileAsArrayBuffer(file);
        const uint8Array = new Uint8Array(fileBuffer as ArrayBuffer);

        qpdf.FS.writeFile(inputPath, uint8Array);

        const args = [inputPath, '--decrypt', outputPath];

        try {
            qpdf.callMain(args);
        } catch (e) {
            console.warn(`QPDF execution warning for ${file.name}:`, e);
        }

        let repairedData: Uint8Array | null = null;
        try {
            repairedData = qpdf.FS.readFile(outputPath, { encoding: 'binary' });
        } catch (e) {
            console.warn(`Failed to read output for ${file.name}:`, e);
        }

        try {
            try {
                qpdf.FS.unlink(inputPath);
            } catch (e) {
                console.warn(e);
            }
            try {
                qpdf.FS.unlink(outputPath);
            } catch (e) {
                console.warn(e);
            }
        } catch (cleanupError) {
            console.warn('Cleanup error:', cleanupError);
        }

        return repairedData;

    } catch (error) {
        console.error(`Error repairing ${file.name}:`, error);
        return null;
    }
}

export async function repairPdf() {
    if (state.files.length === 0) {
        showAlert('无文件', '请选择一个或多个PDF文件。');
        return;
    }

    const successfulRepairs: { name: string; data: Uint8Array }[] = [];
    const failedRepairs: string[] = [];

    try {
        showLoader('正在初始化修复引擎...');

        for (let i = 0; i < state.files.length; i++) {
            const file = state.files[i];
            showLoader(`Repairing ${file.name} (${i + 1}/${state.files.length})...`);

            const repairedData = await repairPdfFile(file);

            if (repairedData && repairedData.length > 0) {
                successfulRepairs.push({
                    name: `repaired-${file.name}`,
                    data: repairedData,
                });
            } else {
                failedRepairs.push(file.name);
            }
        }

        hideLoader();

        if (successfulRepairs.length === 0) {
            showAlert('修复失败', '无法修复任何上传的PDF文件。');
            return;
        }

        if (failedRepairs.length > 0) {
            const failedList = failedRepairs.join(', ');
            showAlert(
                'Partial Success',
                `Repaired ${successfulRepairs.length} file(s). Failed to repair: ${failedList}`
            );
        }

        if (successfulRepairs.length === 1) {
            const file = successfulRepairs[0];
            const blob = new Blob([file.data as any], { type: 'application/pdf' });
            downloadFile(blob, file.name);
        } else {
            showLoader('正在创建ZIP存档...');
            const zip = new JSZip();
            successfulRepairs.forEach((file) => {
                zip.file(file.name, file.data);
            });

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            downloadFile(zipBlob, 'repaired_pdfs.zip');
            hideLoader();
        }

        if (failedRepairs.length === 0) {
            showAlert('成功', '所有文件修复成功！');
        }

    } catch (error: any) {
        console.error('Critical error during repair:', error);
        hideLoader();
        showAlert('错误', '修复过程中发生意外错误。');
    }
}
