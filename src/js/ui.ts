import { resetState } from './state.js';
import { formatBytes, getPDFDocument } from './utils/helpers.js';
import { tesseractLanguages } from './config/tesseract-languages.js';
import {
  renderPagesProgressively,
  cleanupLazyRendering,
} from './utils/render-utils.js';
import { icons, createIcons } from 'lucide';
import Sortable from 'sortablejs';
import {
  getRotationState,
  updateRotationState,
} from './handlers/fileHandler.js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Centralizing DOM element selection
export const dom = {
  gridView: document.getElementById('grid-view'),
  toolGrid: document.getElementById('tool-grid'),
  toolInterface: document.getElementById('tool-interface'),
  toolContent: document.getElementById('tool-content'),
  backToGridBtn: document.getElementById('back-to-grid'),
  loaderModal: document.getElementById('loader-modal'),
  loaderText: document.getElementById('loader-text'),
  alertModal: document.getElementById('alert-modal'),
  alertTitle: document.getElementById('alert-title'),
  alertMessage: document.getElementById('alert-message'),
  alertOkBtn: document.getElementById('alert-ok'),
  dividers: document.querySelectorAll('.section-divider'),
  hideSections: document.querySelectorAll('.hide-section'),
  shortcutsModal: document.getElementById('shortcuts-modal'),
  closeShortcutsModalBtn: document.getElementById('close-shortcuts-modal'),
  shortcutsList: document.getElementById('shortcuts-list'),
  shortcutSearch: document.getElementById('shortcut-search'),
  resetShortcutsBtn: document.getElementById('reset-shortcuts-btn'),
  importShortcutsBtn: document.getElementById('import-shortcuts-btn'),
  exportShortcutsBtn: document.getElementById('export-shortcuts-btn'),
  openShortcutsBtn: document.getElementById('open-shortcuts-btn'),
  warningModal: document.getElementById('warning-modal'),
  warningTitle: document.getElementById('warning-title'),
  warningMessage: document.getElementById('warning-message'),
  warningCancelBtn: document.getElementById('warning-cancel-btn'),
  warningConfirmBtn: document.getElementById('warning-confirm-btn'),
};

export const showLoader = (text = '处理中...') => {
  if (dom.loaderText) dom.loaderText.textContent = text;
  if (dom.loaderModal) dom.loaderModal.classList.remove('hidden');
};

export const hideLoader = () => {
  if (dom.loaderModal) dom.loaderModal.classList.add('hidden');
};

export const showAlert = (
  title: any,
  message: any,
  type: string = 'error',
  callback?: () => void
) => {
  if (dom.alertTitle) dom.alertTitle.textContent = title;
  if (dom.alertMessage) dom.alertMessage.textContent = message;
  if (dom.alertModal) dom.alertModal.classList.remove('hidden');

  if (dom.alertOkBtn) {
    const newOkBtn = dom.alertOkBtn.cloneNode(true) as HTMLElement;
    dom.alertOkBtn.replaceWith(newOkBtn);
    dom.alertOkBtn = newOkBtn;

    newOkBtn.addEventListener('click', () => {
      hideAlert();
      if (callback) callback();
    });
  }
};

export const hideAlert = () => {
  if (dom.alertModal) dom.alertModal.classList.add('hidden');
};

export const switchView = (view: any) => {
  if (view === 'grid') {
    dom.gridView.classList.remove('hidden');
    dom.toolInterface.classList.add('hidden');
    // show hero and features and header
    // show dividers
    dom.dividers.forEach((divider) => {
      divider.classList.remove('hidden');
    });
    // show hideSections
    dom.hideSections.forEach((section) => {
      section.classList.remove('hidden');
    });

    resetState();
  } else {
    dom.gridView.classList.add('hidden');
    dom.toolInterface.classList.remove('hidden');
    dom.dividers.forEach((divider) => {
      divider.classList.add('hidden');
    });
    dom.hideSections.forEach((section) => {
      section.classList.add('hidden');
    });
  }
};

const thumbnailState = {
  sortableInstances: {},
};

function initializeOrganizeSortable(containerId: any) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (thumbnailState.sortableInstances[containerId]) {
    thumbnailState.sortableInstances[containerId].destroy();
  }

  thumbnailState.sortableInstances[containerId] = Sortable.create(container, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    filter: '.delete-page-btn',
    preventOnFilter: true,
    onStart: function (evt: any) {
      evt.item.style.opacity = '0.5';
    },
    onEnd: function (evt: any) {
      evt.item.style.opacity = '1';
    },
  });
}

/**
 * Renders page thumbnails for tools like 'Organize' and 'Rotate'.
 * @param {string} toolId The ID of the active tool.
 * @param {object} pdfDoc The loaded pdf-lib document instance.
 */
export const renderPageThumbnails = async (toolId: any, pdfDoc: any) => {
  const containerId =
    toolId === 'organize'
      ? 'page-organizer'
      : toolId === 'delete-pages'
        ? 'delete-pages-preview'
        : 'page-rotator';
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  // Cleanup any previous lazy loading observers
  cleanupLazyRendering();

  const currentRenderId = Date.now();
  container.dataset.renderId = currentRenderId.toString();

  showLoader('正在渲染页面预览...');

  const pdfData = await pdfDoc.save();
  const pdf = await getPDFDocument({ data: pdfData }).promise;

  // Function to create wrapper element for each page
  const createWrapper = (canvas: HTMLCanvasElement, pageNumber: number) => {
    const wrapper = document.createElement('div');
    // @ts-expect-error TS(2322) FIXME: Type 'number' is not assignable to type 'string'.
    wrapper.dataset.pageIndex = pageNumber - 1;

    const imgContainer = document.createElement('div');
    imgContainer.className =
      'w-full h-36 bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden border-2 border-gray-600';

    const img = document.createElement('img');
    img.src = canvas.toDataURL();
    img.className = 'max-w-full max-h-full object-contain';

    imgContainer.appendChild(img);

    if (toolId === 'organize') {
      wrapper.className = 'page-thumbnail relative group';
      wrapper.appendChild(imgContainer);

      const pageNumSpan = document.createElement('span');
      pageNumSpan.className =
        'absolute top-1 left-1 bg-gray-900 bg-opacity-75 text-white text-xs rounded-full px-2 py-1';
      pageNumSpan.textContent = pageNumber.toString();

      const deleteBtn = document.createElement('button');
      deleteBtn.className =
        'delete-page-btn absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.addEventListener('click', (e) => {
        (e.currentTarget as HTMLElement).parentElement.remove();

        // Renumber remaining pages
        const pages = container.querySelectorAll('.page-thumbnail');
        pages.forEach((page, index) => {
          const numSpan = page.querySelector('span');
          if (numSpan) {
            numSpan.textContent = (index + 1).toString();
          }
        });

        initializeOrganizeSortable(containerId);
      });

      wrapper.append(pageNumSpan, deleteBtn);
    } else if (toolId === 'rotate') {
      wrapper.className =
        'page-rotator-item flex flex-col items-center gap-2 relative group';

      // Read rotation from state (handles "Rotate All" on lazy-loaded pages)
      const rotationStateArray = getRotationState();
      const pageIndex = pageNumber - 1;
      const initialRotation = rotationStateArray[pageIndex] || 0;

      wrapper.dataset.rotation = initialRotation.toString();
      img.classList.add('transition-transform', 'duration-300');

      // Apply initial rotation if any
      if (initialRotation !== 0) {
        img.style.transform = `rotate(${initialRotation}deg)`;
      }

      wrapper.appendChild(imgContainer);

      // Page Number Overlay (Top Left)
      const pageNumSpan = document.createElement('span');
      pageNumSpan.className =
        'absolute top-2 left-2 bg-gray-900 bg-opacity-75 text-white text-xs font-medium rounded-md px-2 py-1 shadow-sm z-10 pointer-events-none';
      pageNumSpan.textContent = pageNumber.toString();
      wrapper.appendChild(pageNumSpan);

      const controlsDiv = document.createElement('div');
      controlsDiv.className =
        'flex flex-col lg:flex-row items-center justify-center w-full gap-2 px-1';

      // Custom Stepper Component
      const stepperContainer = document.createElement('div');
      stepperContainer.className =
        'flex items-center border border-gray-600 rounded-md bg-gray-800 overflow-hidden w-24 h-8';

      const decrementBtn = document.createElement('button');
      decrementBtn.className =
        'px-2 h-full text-gray-400 hover:text-white hover:bg-gray-700 border-r border-gray-600 transition-colors flex items-center justify-center';
      decrementBtn.innerHTML = '<i data-lucide="minus" class="w-3 h-3"></i>';

      const angleInput = document.createElement('input');
      angleInput.type = 'number';
      angleInput.className =
        'no-spinner w-full h-full bg-transparent text-white text-xs text-center focus:outline-none appearance-none m-0 p-0 border-none';
      angleInput.value = initialRotation.toString();
      angleInput.placeholder = '0';

      const incrementBtn = document.createElement('button');
      incrementBtn.className =
        'px-2 h-full text-gray-400 hover:text-white hover:bg-gray-700 border-l border-gray-600 transition-colors flex items-center justify-center';
      incrementBtn.innerHTML = '<i data-lucide="plus" class="w-3 h-3"></i>';

      // Helper to update rotation
      const updateRotation = (newRotation: number) => {
        const card = wrapper; // Closure capture
        const imgEl = card.querySelector('img');
        const pageIndex = pageNumber - 1;

        // Update UI
        angleInput.value = newRotation.toString();
        card.dataset.rotation = newRotation.toString();
        imgEl.style.transform = `rotate(${newRotation}deg)`;

        // Update State
        updateRotationState(pageIndex, newRotation);
      };

      // Event Listeners
      decrementBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        let current = parseInt(angleInput.value) || 0;
        updateRotation(current - 1);
      });

      incrementBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        let current = parseInt(angleInput.value) || 0;
        updateRotation(current + 1);
      });

      angleInput.addEventListener('change', (e) => {
        e.stopPropagation();
        let val = parseInt((e.target as HTMLInputElement).value) || 0;
        updateRotation(val);
      });
      angleInput.addEventListener('click', (e) => e.stopPropagation());

      stepperContainer.append(decrementBtn, angleInput, incrementBtn);

      const rotateBtn = document.createElement('button');
      rotateBtn.className =
        'rotate-btn btn bg-gray-700 hover:bg-gray-600 p-1.5 rounded-md text-gray-200 transition-colors flex-shrink-0';
      rotateBtn.title = '旋转 +90°';
      rotateBtn.innerHTML = '<i data-lucide="rotate-cw" class="w-4 h-4"></i>';
      rotateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        let current = parseInt(angleInput.value) || 0;
        updateRotation(current + 90);
      });

      controlsDiv.append(stepperContainer, rotateBtn);
      wrapper.appendChild(controlsDiv);
    } else if (toolId === 'delete-pages') {
      wrapper.className =
        'page-thumbnail relative group cursor-pointer transition-all duration-200';
      wrapper.dataset.pageNumber = pageNumber.toString();

      const innerContainer = document.createElement('div');
      innerContainer.className =
        'relative w-full h-36 bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden border-2 border-gray-600 transition-colors duration-200';
      innerContainer.appendChild(img);
      wrapper.appendChild(innerContainer);

      const pageNumSpan = document.createElement('span');
      pageNumSpan.className =
        'absolute top-2 left-2 bg-gray-900 bg-opacity-75 text-white text-xs font-medium rounded-md px-2 py-1 shadow-sm z-10 pointer-events-none';
      pageNumSpan.textContent = pageNumber.toString();
      wrapper.appendChild(pageNumSpan);

      wrapper.addEventListener('click', () => {
        const input = document.getElementById(
          'pages-to-delete'
        ) as HTMLInputElement;
        if (!input) return;

        const currentVal = input.value;
        let pages = currentVal
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s);
        const pageStr = pageNumber.toString();

        if (pages.includes(pageStr)) {
          pages = pages.filter((p) => p !== pageStr);
        } else {
          pages.push(pageStr);
        }

        pages.sort((a, b) => {
          const numA = parseInt(a.split('-')[0]);
          const numB = parseInt(b.split('-')[0]);
          return numA - numB;
        });

        input.value = pages.join(', ');

        input.dispatchEvent(new Event('input'));
      });
    }

    return wrapper;
  };

  try {
    // Render pages progressively with lazy loading
    await renderPagesProgressively(pdf, container, createWrapper, {
      batchSize: 8,
      useLazyLoading: true,
      lazyLoadMargin: '300px',
      onProgress: (current, total) => {
        showLoader(`正在渲染页面预览: ${current}/${total}`);
      },
      onBatchComplete: () => {
        createIcons({ icons });
      },
      shouldCancel: () => {
        return container.dataset.renderId !== currentRenderId.toString();
      },
    });

    if (toolId === 'organize') {
      initializeOrganizeSortable(containerId);
    } else if (toolId === 'delete-pages') {
      // No sortable needed for delete pages
    }

    // Reinitialize lucide icons for dynamically added elements
    createIcons({ icons });
  } catch (error) {
    console.error('Error rendering page thumbnails:', error);
    showAlert('错误', '渲染页面缩略图失败');
  } finally {
    hideLoader();
  }
};

/**
 * Renders a list of uploaded files in the specified container.
 * @param {HTMLElement} container The DOM element to render the list into.
 * @param {File[]} files The array of file objects.
 */
export const renderFileDisplay = (container: any, files: any) => {
  container.textContent = '';
  if (files.length > 0) {
    files.forEach((file: any) => {
      const fileDiv = document.createElement('div');
      fileDiv.className =
        'flex items-center justify-between bg-gray-700 p-3 rounded-lg text-sm';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'truncate font-medium text-gray-200';
      nameSpan.textContent = file.name;

      const sizeSpan = document.createElement('span');
      sizeSpan.className = 'flex-shrink-0 ml-4 text-gray-400';
      sizeSpan.textContent = formatBytes(file.size);

      fileDiv.append(nameSpan, sizeSpan);
      container.appendChild(fileDiv);
    });
  }
};

const createFileInputHTML = (options = {}) => {
  // @ts-expect-error TS(2339) FIXME: Property 'multiple' does not exist on type '{}'.
  const multiple = options.multiple ? 'multiple' : '';
  // @ts-expect-error TS(2339) FIXME: Property 'accept' does not exist on type '{}'.
  const acceptedFiles = options.accept || 'application/pdf';
  // @ts-expect-error TS(2339) FIXME: Property 'showControls' does not exist on type '{}... Remove this comment to see the full error message
  const showControls = options.showControls || false; // NEW: Add this parameter

  return `
        <div id="drop-zone" class="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer bg-gray-900 hover:bg-gray-700 transition-colors duration-300">
            <div class="flex flex-col items-center justify-center pt-5 pb-6">
                <i data-lucide="upload-cloud" class="w-10 h-10 mb-3 text-gray-400"></i>
                <p class="mb-2 text-sm text-gray-400"><span class="font-semibold">点击选择文件</span>或拖放到此处</p>
                <p class="text-xs text-gray-500">${multiple ? 'PDF或图片' : '单个PDF文件'}</p>
                <p class="text-xs text-gray-500">您的文件不会离开您的设备。</p>
            </div>
            <input id="file-input" type="file" class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" ${multiple} accept="${acceptedFiles}">
        </div>
        
        ${
          showControls
            ? `
            <!-- NEW: Add control buttons for multi-file uploads -->
            <div id="file-controls" class="hidden mt-4 flex gap-3">
                <button id="add-more-btn" class="btn bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2">
                    <i data-lucide="plus"></i> 添加更多文件
                </button>
                <button id="clear-files-btn" class="btn bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2">
                    <i data-lucide="x"></i> 清除全部
                </button>
            </div>
        `
            : ''
        }
    `;
};

export const toolTemplates = {
  encrypt: () => `
                                                                                                                                                                                                                                    <h2 class="text-2xl font-bold text-white mb-4" > 加密PDF </h2>
                                                                                                                                                                                                                                        <p class="mb-6 text-gray-400" > 为PDF添加256位AES密码保护。</p>
  ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "encrypt-options" class="hidden space-y-4 mt-6" >
        <div>
        <label for= "user-password-input" class= "block mb-2 text-sm font-medium text-gray-300" > 用户密码 </label>
            <input required type = "password" id = "user-password-input" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder = "打开PDF的密码" >
                <p class="text-xs text-gray-500 mt-1" > 打开和查看PDF所需 </p>
                    </div>
                    <div >
                    <label for= "owner-password-input" class= "block mb-2 text-sm font-medium text-gray-300" > 所有者密码(可选) </label>
                        <input type = "password" id = "owner-password-input" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder = "完整权限的密码(推荐)" >
                            <p class="text-xs text-gray-500 mt-1" > 允许更改权限和删除加密 </p>
                                </div>

                                <!--Restriction checkboxes(shown when owner password is entered)-- >
                                    <div id="restriction-options" class="hidden p-4 bg-gray-800 border border-gray-700 rounded-lg" >
                                        <h3 class="font-semibold text-base mb-2 text-white" >🔒 限制PDF权限 </h3>
                                            <p class="text-sm text-gray-400 mb-3" > 选择要禁用的操作： </p>
                                                <div class="space-y-2" >
                                                    <label class="flex items-center space-x-2" >
                                                        <input type="checkbox" id = "restrict-modify" checked >
                                                            <span>禁用所有修改(--modify=none) </span>
                                                                </label>
                                                                <label class="flex items-center space-x-2" >
                                                                    <input type="checkbox" id = "restrict-extract" checked >
                                                                        <span>禁用文本和图像提取(--extract=n) </span>
                                                                            </label>
                                                                            <label class="flex items-center space-x-2" >
                                                                                <input type="checkbox" id = "restrict-print" checked >
                                                                                    <span>禁用所有打印(--print=none) </span>
                                                                                        </label>
                                                                                        <label class="flex items-center space-x-2" >
                                                                                            <input type="checkbox" id = "restrict-accessibility" >
                                                                                                <span>禁用辅助功能文本复制(--accessibility=n) </span>
                                                                                                    </label>
                                                                                                    <label class="flex items-center space-x-2" >
                                                                                                        <input type="checkbox" id = "restrict-annotate" >
                                                                                                            <span>禁用注释(--annotate=n) </span>
                                                                                                                </label>
                                                                                                                <label class="flex items-center space-x-2" >
                                                                                                                    <input type="checkbox" id = "restrict-assemble" >
                                                                                                                        <span>禁用页面组装(--assemble=n) </span>
                                                                                                                            </label>
                                                                                                                            <label class="flex items-center space-x-2" >
                                                                                                                                <input type="checkbox" id = "restrict-form" >
                                                                                                                                    <span>禁用表单填写(--form=n) </span>
                                                                                                                                        </label>
                                                                                                                                        <label class="flex items-center space-x-2" >
                                                                                                                                            <input type="checkbox" id = "restrict-modify-other" >
                                                                                                                                                <span>禁用其他修改(--modify - other=n) </span>
                                                                                                                                                    </label>
                                                                                                                                                    </div>
                                                                                                                                                    </div>

                                                                                                                                                    <div class="p-4 bg-yellow-900/20 border border-yellow-500/30 text-yellow-200 rounded-lg" >
                                                                                                                                                        <h3 class="font-semibold text-base mb-2" >⚠️ 安全建议 </h3>
                                                                                                                                                            <p class="text-sm text-gray-300" > 为了强加安全性，请设置两个密码。没有所有者密码，安全限制(打印、复制等)可以被轻松绕过。</p>
                                                                                                                                                                </div>
                                                                                                                                                                <div class="p-4 bg-green-900/20 border border-green-500/30 text-green-200 rounded-lg" >
                                                                                                                                                                    <h3 class="font-semibold text-base mb-2" >✓ 高质量加密 </h3>
                                                                                                                                                                        <p class="text-sm text-gray-300" > 256位AES加密，无质量损失。文本保持可选中和可搜索。</p>
                                                                                                                                                                            </div>
                                                                                                                                                                            <button id = "process-btn" class="btn-gradient w-full mt-6" > 加密并下载 </button>
                                                                                                                                                                                </div>
                                                                                                                                                                                    `,
  decrypt: () => `
                                                                                                                                                                                <h2 class="text-2xl font-bold text-white mb-4" > 解密PDF </h2>
                                                                                                                                                                                    <p class="mb-6 text-gray-400" > 上传加密的PDF并提供密码以创建解锁版本。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "decrypt-options" class="hidden space-y-4 mt-6" >
        <div>
        <label for= "password-input" class= "block mb-2 text-sm font-medium text-gray-300" > 输入PDF密码 </label>
            <input type = "password" id = "password-input" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder = "输入当前密码" >
                </div>
                <button id = "process-btn" class="btn-gradient w-full mt-6" > 解密并下载 </button>
                    </div>
                    <canvas id = "pdf-canvas" class="hidden" > </canvas>
                        `,
  organize: () => `
                        <h2 class="text-2xl font-bold text-white mb-4" > 组织PDF </h2>
                            <p class="mb-6 text-gray-400" > 重新排序、旋转或删除页面。拖放页面以重新排序。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "page-organizer" class="hidden grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 my-6" > </div>
        <button id = "process-btn" class="btn-gradient w-full mt-6" > 保存更改 </button>
            `,

  rotate: () => `
            <h2 class="text-2xl font-bold text-white mb-4" > 旋转PDF </h2>
                <p class="mb-6 text-gray-400" > 旋转PDF文档中的所有页面或特定页面。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>

    <div id = "rotate-all-controls" class="hidden my-6" >
        <div class="bg-gray-900/50 border border-gray-700 rounded-lg p-4" >
            <h3 class="text-sm font-semibold text-gray-400 mb-3 text-center" > 批量操作 </h3>
                <div class="flex flex-col md:flex-row justify-center gap-6 items-center" >

                    <!--90 Degree Rotation Group-- >
                        <div class="flex flex-col gap-2 items-center" >
                            <span class="text-xs text-gray-400 font-medium uppercase tracking-wider" > 旋转90度 </span>
                                <div class="flex gap-2" >
                                    <button id="rotate-all-left-btn" class="flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-200 bg-gray-800 border border-gray-600 rounded-lg shadow-sm hover:bg-gray-700 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 transform transition-all duration-150 active:scale-95" title = "左转90°" >
                                        <i data-lucide="rotate-ccw" class="mr-2 h-4 w-4" > </i>
左转
    </button>
    <button id = "rotate-all-right-btn" class="flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-200 bg-gray-800 border border-gray-600 rounded-lg shadow-sm hover:bg-gray-700 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 transform transition-all duration-150 active:scale-95" title = "右转90°" >
        <i data-lucide="rotate-cw" class="mr-2 h-4 w-4" > </i>
右转
    </button>
    </div>
    </div>

    <div class="hidden md:block w-px h-12 bg-gray-700" > </div>

        <!--Custom Rotation Group-- >
            <div class="flex flex-col gap-2 items-center" >
                <span class="text-xs text-gray-400 font-medium uppercase tracking-wider" > 自定义度数旋转 </span>
                    <div class="flex gap-2 items-center" >

                        <!--Custom Stepper-- >
                            <div class="flex items-center border border-gray-600 rounded-md bg-gray-800 overflow-hidden h-10" >
                                <button id="rotate-all-decrement-btn" class="px-3 h-full text-gray-400 hover:text-white hover:bg-gray-700 border-r border-gray-600 transition-colors flex items-center justify-center" >
                                    <i data-lucide="minus" class="w-4 h-4" > </i>
                                        </button>
                                        <div class="relative w-20 h-full" >
                                            <input type="number" id = "custom-rotate-all-input" placeholder = "0" class="no-spinner w-full h-full bg-transparent text-white text-sm text-center focus:outline-none appearance-none m-0 p-0 border-none" min = "-360" max = "360" >
                                                </div>
                                                <button id = "rotate-all-increment-btn" class="px-3 h-full text-gray-400 hover:text-white hover:bg-gray-700 border-l border-gray-600 transition-colors flex items-center justify-center" >
                                                    <i data-lucide="plus" class="w-4 h-4" > </i>
                                                        </button>
                                                        </div>

                                                        <button id = "rotate-all-custom-btn" class="btn bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow-sm h-10" >
                                                            应用
                                                            </button>
                                                            </div>
                                                            </div>

                                                            </div>
                                                            </div>
                                                            </div>
                                                            <div id = "page-rotator" class="hidden grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 my-6" > </div>
                                                                <button id = "process-btn" class="btn-gradient w-full mt-6" > 保存旋转 </button>
                                                                    `,

  'add-page-numbers': () => `
                                                                    <h2 class="text-2xl font-bold text-white mb-4" > 添加页码 </h2>
                                                                        <p class="mb-6 text-gray-400" > 为PDF文件添加可自定义的页码。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "pagenum-options" class="hidden grid grid-cols-1 md:grid-cols-2 gap-4 mt-6" >
        <div>
        <label for= "position" class= "block mb-2 text-sm font-medium text-gray-300" > 位置 </label>
            <select id = "position" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                <option value="bottom-center" > 底部居中 </option>
                    <option value = "bottom-left" > 底部左侧 </option>
                        <option value = "bottom-right" > 底部右侧 </option>
                            <option value = "top-center" > 顶部居中 </option>
                                <option value = "top-left" > 顶部左侧 </option>
                                    <option value = "top-right" > 顶部右侧 </option>
                                        </select>
                                        </div>
                                        <div >
                                        <label for= "font-size" class= "block mb-2 text-sm font-medium text-gray-300" > 字体大小 </label>
                                            <input type = "number" id = "font-size" value = "12" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                </div>
                                                <div >
                                                <label for= "number-format" class= "block mb-2 text-sm font-medium text-gray-300" > 格式 </label>
                                                    <select id = "number-format" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                        <option value="default" > 1, 2, 3...</option>
                                                            <option value = "page_x_of_y" > 第 1 / N 页, 2 / N...</option>
                                                                </select>
                                                                </div>
                                                                <div >
                                                                <label for= "text-color" class= "block mb-2 text-sm font-medium text-gray-300" > 文本颜色 </label>
                                                                    <input type = "color" id = "text-color" value = "#000000" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer" >
                                                                        </div>
                                                                        </div>
                                                                        <button id = "process-btn" class="btn-gradient w-full mt-6" > 添加页码 </button>
                                                                            `,
  'pdf-to-jpg': () => `
                                                                            <h2 class="text-2xl font-bold text-white mb-4" > PDF转JPG </h2>
                                                                                <p class="mb-6 text-gray-400" > 将PDF文件的每一页转换为高质量JPG图像。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "jpg-preview" class="hidden mt-6" >
        <div class="mb-4" >
            <label for= "jpg-quality" class= "block mb-2 text-sm font-medium text-gray-300" > 图像质量 </label>
                <div class="flex items-center gap-4" >
                    <input type="range" id = "jpg-quality" min = "0.1" max = "1.0" step = "0.01" value = "1.0" class="flex-1" >
                        <span id="jpg-quality-value" class="text-white font-medium w-16 text-right" > 100 % </span>
                            </div>
                            <p class="mt-1 text-xs text-gray-400" > 质量越高 = 文件越大 </p>
                                </div>
                                <p class="mb-4 text-white text-center" > 点击“下载为ZIP”获取所有页面的图像。</p>
                                    <button id = "process-btn" class="btn-gradient w-full" > 下载为ZIP</button >
                                        </div>
                                            `,

  'scan-to-pdf': () => `
                                        <h2 class="text-2xl font-bold text-white mb-4" > 扫描转PDF </h2>
                                            <p class="mb-6 text-gray-400" > 使用设备摄像头扫描文档并保存为PDF。在桌面端，将打开文件选择器。</p>
        ${createFileInputHTML({ accept: 'image/*' })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="btn-gradient w-full mt-6" > 从扫描创建PDF </button>
        `,

  crop: () => `
        <h2 class="text-2xl font-bold text-white mb-4" > 裁剪PDF </h2>
            <p class="mb-6 text-gray-400" > 点击并拖动以选择任意页面上的裁剪区域。您可以为每个页面设置不同的裁剪区域。</p>
    ${createFileInputHTML()}
<div id="crop-editor" class="hidden" >
    <div class="flex flex-col md:flex-row items-center justify-center gap-4 mb-4 p-3 bg-gray-900 rounded-lg border border-gray-700" >
        <div id="page-nav" class="flex items-center gap-2" > </div>
            <div class="border-l border-gray-600 h-6 mx-2 hidden md:block" > </div>
                <div id = "zoom-controls" class="flex items-center gap-2" >
                    <button id="zoom-out-btn" class="btn p-2 rounded-full bg-gray-700 hover:bg-gray-600" title = "缩小" > <i data-lucide="zoom-out" class="w-5 h-5" > </i></button >
                        <button id="fit-page-btn" class="btn p-2 rounded-full bg-gray-700 hover:bg-gray-600" title = "适应视图" > <i data-lucide="minimize" class="w-5 h-5" > </i></button >
                            <button id="zoom-in-btn" class="btn p-2 rounded-full bg-gray-700 hover:bg-gray-600" title = "放大" > <i data-lucide="zoom-in" class="w-5 h-5" > </i></button >
                                </div>
                                <div class="border-l border-gray-600 h-6 mx-2 hidden md:block" > </div>
                                    <div id = "crop-controls" class="flex items-center gap-2" >
                                        <button id="clear-crop-btn" class="btn bg-yellow-600 hover:bg-yellow-700 text-white font-semibold px-4 py-2 rounded-lg text-sm" title = "清除此页裁剪" > 清除页面 </button>
                                            <button id = "clear-all-crops-btn" class="btn bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg text-sm" title = "清除所有裁剪选择" > 清除全部 </button>
                                                </div>
                                                </div>
                                                <div id = "canvas-container" class="relative w-full overflow-auto bg-gray-900 rounded-lg border border-gray-600" style = "height: 70vh;" >
                                                    <canvas id="canvas-editor" class="mx-auto cursor-crosshair" > </canvas>
                                                        </div>
                                                        <button id = "process-btn" class="btn-gradient w-full mt-6" > 应用裁剪并保存PDF </button>
                                                            </div>
                                                                `,
  compress: () => `
                                                            <h2 class="text-2xl font-bold text-white mb-4" > 压缩PDF </h2>
                                                                <p class="mb-6 text-gray-400" > 通过选择最适合您文档的压缩方法来减小文件大小。支持多个PDF。</p>
    ${createFileInputHTML({ multiple: true, showControls: true })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "compress-options" class="hidden mt-6 space-y-6" >
        <div>
        <label for= "compression-level" class= "block mb-2 text-sm font-medium text-gray-300" > 压缩级别 </label>
            <select id = "compression-level" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 focus:ring-indigo-500 focus:border-indigo-500" >
                <option value="balanced" > 平衡(推荐) </option>
                    <option value = "high-quality" > 高质量(文件较大) </option>
                        <option value = "small-size" > 最小大小(质量较低) </option>
                            <option value = "extreme" > 极致压缩(质量很低) </option>
                                </select>
                                </div>

                                <div >
                                <label for= "compression-algorithm" class= "block mb-2 text-sm font-medium text-gray-300" > 压缩算法 </label>
                                    <select id = "compression-algorithm" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 focus:ring-indigo-500 focus:border-indigo-500" >
                                        <option value="vector" > 矢量(用于文本为主的PDF) </option>
                                            <option value = "photon" > 光子(用于复杂图像和图纸) </option>
                                                </select>
                                                <p class="mt-2 text-xs text-gray-400" >
                                                    对于文本类PDF选择“矢量”，对于扫描文档和复杂图像选择“光子”。
            </p>
                                                        </div>

                                                        <button id = "process-btn" class="btn-gradient w-full mt-4" disabled > 压缩PDF </button>
                                                            </div>
                                                                `,
  'pdf-to-greyscale': () => `
                                                            <h2 class="text-2xl font-bold text-white mb-4" > PDF转灰度 </h2>
                                                                <p class="mb-6 text-gray-400" > 将PDF的所有页面转换为灰度。通过渲染每一页、应用滤镜并重建 PDF来实现。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="btn-gradient w-full mt-6" > 转换为灰度 </button>
        `,
  'pdf-to-zip': () => `
        <h2 class="text-2xl font-bold text-white mb-4" > 将PDF组合到ZIP </h2>
            <p class="mb-6 text-gray-400" > 选择多个PDF文件，将它们一起下载到单个ZIP压缩包中。</p>
        ${createFileInputHTML({ multiple: true, showControls: true })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="btn-gradient w-full mt-6" > 创建ZIP文件 </button>
        `,

  'edit-metadata': () => `
        <h2 class="text-2xl font-bold text-white mb-4" > 编辑PDF元数据 </h2>
            <p class="mb-6 text-gray-400" > 修改PDF的核心元数据字段。留空字段可清除它。</p>

                <div class="p-3 mb-6 bg-gray-900 border border-yellow-500/30 text-yellow-200/80 rounded-lg text-sm flex items-start gap-3" >
                    <i data-lucide="info" class="w-5 h-5 flex-shrink-0 mt-0.5" > </i>
                        <div >
                        <strong class="font-semibold text-yellow-200" > 重要提示：</strong>
            此工具使用 <code class="bg-gray-700 px-1 rounded text-white" > pdf-lib </code> 库，在上传时可能会因其默认行为而更新 <strong>Producer</strong>、<strong>CreationDate</strong> 和 <strong>ModDate</strong> 字段。要准确查看编辑后文件的最终元数据，或者仅进行正常查看，请使用我们的 <strong>查看元数据</strong> 工具。
    </div>
    </div>

    ${createFileInputHTML()}

<div id="metadata-form" class="hidden mt-6 space-y-4" >
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" >
        <div>
        <label for= "meta-title" class= "block mb-2 text-sm font-medium text-gray-300" > 标题 </label>
            <input type = "text" id = "meta-title" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                </div>
                <div >
                <label for= "meta-author" class= "block mb-2 text-sm font-medium text-gray-300" > 作者 </label>
                    <input type = "text" id = "meta-author" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                        </div>
                        <div >
                        <label for= "meta-subject" class= "block mb-2 text-sm font-medium text-gray-300" > 主题 </label>
                            <input type = "text" id = "meta-subject" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                </div>
                                <div >
                                <label for= "meta-keywords" class= "block mb-2 text-sm font-medium text-gray-300" > 关键词(逗号分隔) </label>
                                    <input type = "text" id = "meta-keywords" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                        </div>
                                        <div >
                                        <label for= "meta-creator" class= "block mb-2 text-sm font-medium text-gray-300" > 创建工具 </label>
                                            <input type = "text" id = "meta-creator" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                </div>
                                                <div >
                                                <label for= "meta-producer" class= "block mb-2 text-sm font-medium text-gray-300" > 生产工具 </label>
                                                    <input type = "text" id = "meta-producer" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                        </div>
                                                        <div >
                                                        <label for= "meta-creation-date" class= "block mb-2 text-sm font-medium text-gray-300" > 创建日期 </label>
                                                            <input type = "datetime-local" id = "meta-creation-date" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                </div>
                                                                <div >
                                                                <label for= "meta-mod-date" class= "block mb-2 text-sm font-medium text-gray-300" > 修改日期 </label>
                                                                    <input type = "datetime-local" id = "meta-mod-date" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                        </div>
                                                                        </div>

                                                                        <div id = "custom-metadata-container" class="space-y-3 pt-4 border-t border-gray-700" >
                                                                            <h3 class="text-lg font-semibold text-white" > 自定义字段 </h3>
                                                                                <p class="text-sm text-gray-400 -mt-2" > 注意：并非所有PDF阅读器都支持自定义字段。</p>
                                                                                    </div>
                                                                                    <button id = "add-custom-meta-btn" class="btn border border-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2" >
                                                                                        <i data-lucide="plus" > </i> 添加自定义字段
                                                                                            </button>

                                                                                            </div>

                                                                                            <button id = "process-btn" class="hidden btn-gradient w-full mt-6" > 更新元数据并下载 </button>
                                                                                                `,

  'remove-metadata': () => `
                                                                                                <h2 class="text-2xl font-bold text-white mb-4" > 删除PDF元数据 </h2>
                                                                                                    <p class="mb-6 text-gray-400" > 完全删除PDF中的识别元数据。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="hidden mt-6 btn-gradient w-full" > 删除元数据并下载 </button>
        `,
  flatten: () => `
        <h2 class="text-2xl font-bold text-white mb-4" > 平面化PDF </h2>
            <p class="mb-6 text-gray-400" > 通过平面化使PDF表单和注释不可编辑。</p>
        ${createFileInputHTML({ multiple: true, showControls: true })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="hidden mt-6 btn-gradient w-full" > 平面化PDF </button>
        `,
  'pdf-to-png': () => `
        <h2 class="text-2xl font-bold text-white mb-4" > PDF转PNG </h2>
            <p class="mb-6 text-gray-400" > 将PDF文件的每一页转换为高质量PNG图像。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "png-preview" class="hidden mt-6" >
        <div class="mb-4" >
            <label for= "png-quality" class= "block mb-2 text-sm font-medium text-gray-300" > 图像质量(缩放) </label>
                <div class="flex items-center gap-4" >
                    <input type="range" id = "png-quality" min = "1.0" max = "4.0" step = "0.5" value = "2.0" class="flex-1" >
                        <span id="png-quality-value" class="text-white font-medium w-16 text-right" > 2.0x </span>
                            </div>
                            <p class="mt-1 text-xs text-gray-400" > 更高的缩放 = 更好的质量但文件更大 </p>
                                </div>
                                <p class="mb-4 text-white text-center" > 您的文件已准备好。点击按钮下载包含所有PNG图像的ZIP文件。</p>
                                    <button id = "process-btn" class="btn-gradient w-full" > 下载为ZIP</button >
                                        </div>
                                            `,
  'png-to-pdf': () => `
                                        <h2 class="text-2xl font-bold text-white mb-4" > PNG转PDF </h2>
                                            <p class="mb-6 text-gray-400" > 将一个或多个PNG图像转换为单个PDF文件。</p>
        ${createFileInputHTML({ multiple: true, accept: 'image/png', showControls: true })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "png-to-pdf-options" class="hidden mt-6" >
        <div class="mb-4" >
            <label for= "png-pdf-quality" class= "block mb-2 text-sm font-medium text-gray-300" > PDF质量 </label>
                <select id = "png-pdf-quality" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                    <option value="high" > 高质量(文件较大) </option>
                        <option value = "medium" selected > 中等质量(平衡) </option>
                            <option value = "low" > 低质量(文件较小) </option>
                                </select>
                                <p class="mt-1 text-xs text-gray-400" > 控制嵌入PDF时的图像压缩 </p>
                                    </div>
                                    </div>
                                    <button id = "process-btn" class="btn-gradient w-full mt-6" > 转换为PDF </button>
                                        `,
  'pdf-to-webp': () => `
                                        <h2 class="text-2xl font-bold text-white mb-4" > PDF转WebP </h2>
                                            <p class="mb-6 text-gray-400" > 将PDF文件的每一页转换为现代WebP图像。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "webp-preview" class="hidden mt-6" >
        <div class="mb-4" >
            <label for= "webp-quality" class= "block mb-2 text-sm font-medium text-gray-300" > 图像质量 </label>
                <div class="flex items-center gap-4" >
                    <input type="range" id = "webp-quality" min = "0.1" max = "1.0" step = "0.1" value = "0.9" class="flex-1" >
                        <span id="webp-quality-value" class="text-white font-medium w-16 text-right" > 90 % </span>
                            </div>
                            <p class="mt-1 text-xs text-gray-400" > 质量越高 = 文件越大 </p>
                                </div>
                                <p class="mb-4 text-white text-center" > 您的文件已准备好。点击按钮下载包含所有WebP图像的ZIP文件。</p>
                                    <button id = "process-btn" class="btn-gradient w-full" > 下载为ZIP</button >
                                        </div>
                                            `,
  'webp-to-pdf': () => `
                                        <h2 class="text-2xl font-bold text-white mb-4" > WebP转PDF </h2>
                                            <p class="mb-6 text-gray-400" > 将一个或多个WebP图像转换为单个PDF文件。</p>
        ${createFileInputHTML({ multiple: true, accept: 'image/webp', showControls: true })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="btn-gradient w-full mt-6" > 转换为PDF </button>
        `,
  edit: () => `
        <h2 class="text-2xl font-bold text-white mb-4" > PDF工作室 </h2>
            <p class="mb-6 text-gray-400" > 一个全功能PDF工作区，可以注释、绘图、高亮、编辑、添加注释和形状、截图和查看PDF。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "embed-pdf-wrapper" class="hidden mt-6 w-full h-[75vh] border border-gray-600 rounded-lg" >
        <div id="embed-pdf-container" class="w-full h-full" > </div>
            </div>
                `,
  'delete-pages': () => `
            <h2 class="text-2xl font-bold text-white mb-4" > 删除页面 </h2>
                <p class="mb-6 text-gray-400" > 从PDF文件中删除特定页面或页面范围。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "delete-options" class="hidden mt-6" >
        <p class="mb-2 font-medium text-white" > 总页数：<span id="total-pages" > </span></p >
            <label for= "pages-to-delete" class= "block mb-2 text-sm font-medium text-gray-300" > 输入要删除的页面 (例如，2, 4-6, 9): </label>
                <input type = "text" id = "pages-to-delete" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-6" placeholder = "例如，2, 4-6, 9" >
                    <div id="delete-pages-preview" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 my-6" > </div>
                        <button id = "process-btn" class="btn-gradient w-full" > 删除页面并下载 </button>
                            </div>
                                `,
  'add-blank-page': () => `
                            <h2 class="text-2xl font-bold text-white mb-4" > 添加空白页 </h2>
                                <p class="mb-6 text-gray-400" > 在文档的特定位置插入一个或多个空白页。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "blank-page-options" class="hidden mt-6" >
        <p class="mb-2 font-medium text-white" > 总页数：<span id="total-pages" > </span></p >
            <label for= "page-number" class= "block mb-2 text-sm font-medium text-gray-300" > 在页码后插入空白页：</label>
                <input type = "number" id = "page-number" min = "0" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-4" placeholder = "输入0以添加到开头" >
                    <label for= "page-count" class= "block mb-2 text-sm font-medium text-gray-300" > 要插入的空白页数量：</label>
                        <input type = "number" id = "page-count" min = "1" value = "1" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-6" placeholder = "输入页面数" >
                            <button id="process-btn" class="btn-gradient w-full" > 添加页面并下载 </button>
                                </div>
                                    `,
  'extract-pages': () => `
                                <h2 class="text-2xl font-bold text-white mb-4" > 提取页面 </h2>
                                    <p class="mb-6 text-gray-400" > 从PDF中提取特定页面到单独文件。您的文件将下载到ZIP压缩包中。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "extract-options" class="hidden mt-6" >
        <p class="mb-2 font-medium text-white" > 总页数：<span id="total-pages" > </span></p >
            <label for= "pages-to-extract" class= "block mb-2 text-sm font-medium text-gray-300" > 输入要提取的页面(例如，2, 4-6, 9): </label>
                <input type = "text" id = "pages-to-extract" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-6" placeholder = "例如，2, 4-6, 9" >
                    <button id="process-btn" class="btn-gradient w-full" > 提取并下载ZIP </button>
                        </div>
                            `,

  'add-watermark': () => `
                        <h2 class="text-2xl font-bold text-white mb-4" > 添加水印 </h2>
                            <p class="mb-6 text-gray-400" > 将文本或图像水印应用到PDF文档的每一页。</p>
    ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>

    <div id = "watermark-options" class="hidden mt-6 space-y-4" >
        <div class="flex gap-4 p-2 rounded-lg bg-gray-900" >
            <label class="flex-1 flex items-center justify-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer has-[:checked]:bg-indigo-600" >
                <input type="radio" name = "watermark-type" value = "text" checked class="hidden" >
                    <span class="font-semibold text-white" > 文本 </span>
                        </label>
                        <label class="flex-1 flex items-center justify-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer has-[:checked]:bg-indigo-600" >
                            <input type="radio" name = "watermark-type" value = "image" class="hidden" >
                                <span class="font-semibold text-white" > 图像 </span>
                                    </label>
                                    </div>

                                    <div id = "text-watermark-options" >
                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" >
                                            <div>
                                            <label for= "watermark-text" class= "block mb-2 text-sm font-medium text-gray-300" > 水印文本 </label>
                                                <input type = "text" id = "watermark-text" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder = "例如，机密" >
                                                    </div>
                                                    <div >
                                                    <label for= "font-size" class= "block mb-2 text-sm font-medium text-gray-300" > 字体大小 </label>
                                                        <input type = "number" id = "font-size" value = "72" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                            </div>
                                                            </div>
                                                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4" >
                                                                <div>
                                                                <label for= "text-color" class= "block mb-2 text-sm font-medium text-gray-300" > 文本颜色 </label>
                                                                    <input type = "color" id = "text-color" value = "#000000" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer" >
                                                                        </div>
                                                                        <div >
                                                                        <label for= "opacity-text" class= "block mb-2 text-sm font-medium text-gray-300" > Opacity(<span id="opacity-value-text" > 0.3 < /span>)</label >
                                                                            <input type="range" id = "opacity-text" value = "0.3" min = "0" max = "1" step = "0.1" class= "w-full" >
                                                                            </div>
                                                                            </div>
                                                                            <div class= "mt-4" >
                                                                            <label for= "angle-text" class= "block mb-2 text-sm font-medium text-gray-300" > Angle(<span id="angle-value-text" > 0 < /span>°)</label >
                                                                                <input type="range" id = "angle-text" value = "0" min = "-180" max = "180" step = "1" class= "w-full" >
                                                                                </div>
                                                                                </div>

                                                                                <div id = "image-watermark-options" class= "hidden space-y-4" >
                                                                                <div>
                                                                                <label for= "image-watermark-input" class= "block mb-2 text-sm font-medium text-gray-300" > Upload Watermark Image </label>
                                                                                    <input type = "file" id = "image-watermark-input" accept = "image/png, image/jpeg" class="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700" >
                                                                                        </div>
                                                                                        <div >
                                                                                        <label for= "opacity-image" class= "block mb-2 text-sm font-medium text-gray-300" > Opacity(<span id="opacity-value-image" > 0.3 < /span>)</label >
                                                                                            <input type="range" id = "opacity-image" value = "0.3" min = "0" max = "1" step = "0.1" class= "w-full" >
                                                                                            </div>
                                                                                            <div >
                                                                                            <label for= "angle-image" class= "block mb-2 text-sm font-medium text-gray-300" > Angle(<span id="angle-value-image" > 0 < /span>°)</label >
                                                                                                <input type="range" id = "angle-image" value = "0" min = "-180" max = "180" step = "1" class= "w-full" >
                                                                                                </div>
                                                                                                </div>

                                                                                                </div>
                                                                                                <button id = "process-btn" class= "hidden btn-gradient w-full mt-6" > Add Watermark & Download </button>
                                                                                                    `,

  'add-header-footer': () => `
                                                                                                <h2 class= "text-2xl font-bold text-white mb-4" > Add Header & Footer </h2>
                                                                                                <p class= "mb-6 text-gray-400" > Add custom text to the top and bottom margins of every page.</p>
    ${createFileInputHTML()}
                                                                                            <div id = "file-display-area" class= "mt-4 space-y-2" > </div>
                                                                                            <div id = "header-footer-options" class= "hidden mt-6 space-y-4" >

                                                                                            <div class="p-4 bg-gray-900 border border-gray-700 rounded-lg" >
                                                                                            <h3 class="text-lg font-semibold text-white mb-3" > Formatting Options </h3>
                                                                                            <div class= "grid grid-cols-1 sm:grid-cols-3 gap-4" >
                                                                                            <div>
                                                                                            <label for= "page-range" class= "block mb-2 text-sm font-medium text-gray-300" > Page Range(optional) </label>
                                                                                                <input type = "text" id = "page-range" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder = "e.g., 1-3, 5" >
                                                                                                    <p class="text-xs text-gray-400 mt-1" > Total pages: <span id="total-pages" > 0 < /span></p >
                                                                                                        </div>
                                                                                                        <div >
                                                                                                        <label for= "font-size" class= "block mb-2 text-sm font-medium text-gray-300" > Font Size </label>
                                                                                                            <input type = "number" id = "font-size" value = "10" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                                                                </div>
                                                                                                                <div >
                                                                                                                <label for= "font-color" class= "block mb-2 text-sm font-medium text-gray-300" > Font Color </label>
                                                                                                                    <input type = "color" id = "font-color" value = "#000000" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer" >
                                                                                                                        </div>
                                                                                                                        </div>
                                                                                                                        </div>

                                                                                                                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4" >
                                                                                                                            <div>
                                                                                                                            <label for= "header-left" class= "block mb-2 text-sm font-medium text-gray-300" > Header Left </label>
                                                                                                                                <input type = "text" id = "header-left" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                                                                                    </div>
                                                                                                                                    <div >
                                                                                                                                    <label for= "header-center" class= "block mb-2 text-sm font-medium text-gray-300" > Header Center </label>
                                                                                                                                        <input type = "text" id = "header-center" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                                                                                            </div>
                                                                                                                                            <div >
                                                                                                                                            <label for= "header-right" class= "block mb-2 text-sm font-medium text-gray-300" > Header Right </label>
                                                                                                                                                <input type = "text" id = "header-right" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                                                                                                    </div>
                                                                                                                                                    </div>
                                                                                                                                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4" >
                                                                                                                                                        <div>
                                                                                                                                                        <label for= "footer-left" class= "block mb-2 text-sm font-medium text-gray-300" > Footer Left </label>
                                                                                                                                                            <input type = "text" id = "footer-left" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                                                                                                                </div>
                                                                                                                                                                <div >
                                                                                                                                                                <label for= "footer-center" class= "block mb-2 text-sm font-medium text-gray-300" > Footer Center </label>
                                                                                                                                                                    <input type = "text" id = "footer-center" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                                                                                                                        </div>
                                                                                                                                                                        <div >
                                                                                                                                                                        <label for= "footer-right" class= "block mb-2 text-sm font-medium text-gray-300" > Footer Right </label>
                                                                                                                                                                            <input type = "text" id = "footer-right" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                                                                                                                                </div>
                                                                                                                                                                                </div>
                                                                                                                                                                                </div>
                                                                                                                                                                                <button id = "process-btn" class="hidden btn-gradient w-full mt-6" > Apply Header & Footer </button>
                                                                                                                                                                                    `,

  'image-to-pdf': () => `
                                                                                                                                                                                    <h2 class="text-2xl font-bold text-white mb-4" > 图像转PDF转换器 </h2>
                                                                                                                                                                                        <p class="mb-4 text-gray-400" > 将多个图像组合成单个PDF。拖放以重新排序。</p>

                                                                                                                                                                                            <div class="mb-6 p-3 bg-gray-900/50 border border-gray-700 rounded-lg" >
                                                                                                                                                                                                <p class="text-sm text-gray-300 mb-2" > <strong class="text-white" > 支持格式：</strong></p >
                                                                                                                                                                                                    <p class="text-xs text-gray-400" > JPG, PNG, WebP, BMP, TIFF, SVG, HEIC / HEIF </p>
                                                                                                                                                                                                        </div>
        
        ${createFileInputHTML({ multiple: true, accept: 'image/jpeg,image/png,image/webp,image/bmp,image/tiff,image/svg+xml', showControls: true })}
<ul id="image-list" class="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4" >
    </ul>
    <div id = "image-to-pdf-options" class="hidden mt-6" >
        <div class="mb-4" >
            <label for= "image-pdf-quality" class= "block mb-2 text-sm font-medium text-gray-300" > PDF Image Quality </label>
                <div class="flex items-center gap-4" >
                    <input type="range" id = "image-pdf-quality" min = "0.3" max = "1.0" step = "0.1" value = "0.9" class="flex-1" >
                        <span id="image-pdf-quality-value" class="text-white font-medium w-16 text-right" > 90 % </span>
                            </div>
                            <p class="mt-1 text-xs text-gray-400" > Higher quality = larger PDF size </p>
                                </div>
                                </div>
                                <button id = "process-btn" class="btn-gradient w-full mt-6" > Convert to PDF </button>
                                    `,

  'change-permissions': () => `
                                    <h2 class="text-2xl font-bold text-white mb-4" > 修改PDF权限 </h2>
                                        <p class="mb-6 text-gray-400" > 修改密码和权限而不损失质量。</p>
    ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "permissions-options" class="hidden mt-6 space-y-4" >
        <div>
        <label for= "current-password" class= "block mb-2 text-sm font-medium text-gray-300" > Current Password(if encrypted)</label>
            <input type = "password" id = "current-password" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder = "Leave blank if PDF is not password-protected" >
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4" >
                    <div>
                    <label for= "new-user-password" class= "block mb-2 text-sm font-medium text-gray-300" > New User Password(optional) </label>
                        <input type = "password" id = "new-user-password" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder = "Password to open PDF" >
                            </div>
                            <div >
                            <label for= "new-owner-password" class= "block mb-2 text-sm font-medium text-gray-300" > New Owner Password(optional) </label>
                                <input type = "password" id = "new-owner-password" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder = "Password for full permissions" >
                                    </div>
                                    </div>

                                    <div class="p-4 bg-blue-900/20 border border-blue-500/30 text-blue-200 rounded-lg" >
                                        <h3 class="font-semibold text-base mb-2" > How It Works </h3>
                                            <ul class="list-disc list-inside text-sm text-gray-300 space-y-1" >
                                                <li><strong>User Password: </strong> Required to open the PDF</li >
                                                    <li><strong>Owner Password: </strong> Required to enforce the permissions below</li >
                                                        <li>Leave both blank to remove all encryption and restrictions </li>
                                                            <li > Check boxes below to ALLOW specific actions(unchecked = disabled) </li>
                                                                </ul>
                                                                </div>

                                                                <fieldset class="border border-gray-600 p-4 rounded-lg" >
                                                                    <legend class="px-2 text-sm font-medium text-gray-300" > Permissions(only enforced with Owner Password): </legend>
                                                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3" >
                                                                            <label class="flex items-center gap-2 text-gray-300 cursor-pointer hover:text-white" >
                                                                                <input type="checkbox" id = "allow-printing" checked class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded" >
                                                                                    Allow Printing
                                                                                        </label>
                                                                                        <label class="flex items-center gap-2 text-gray-300 cursor-pointer hover:text-white" >
                                                                                            <input type="checkbox" id = "allow-copying" checked class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded" >
                                                                                                Allow Text / Image Extraction
                                                                                                    </label>
                                                                                                    <label class="flex items-center gap-2 text-gray-300 cursor-pointer hover:text-white" >
                                                                                                        <input type="checkbox" id = "allow-modifying" checked class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded" >
                                                                                                            Allow Modifications
                                                                                                                </label>
                                                                                                                <label class="flex items-center gap-2 text-gray-300 cursor-pointer hover:text-white" >
                                                                                                                    <input type="checkbox" id = "allow-annotating" checked class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded" >
                                                                                                                        Allow Annotations
                                                                                                                            </label>
                                                                                                                            <label class="flex items-center gap-2 text-gray-300 cursor-pointer hover:text-white" >
                                                                                                                                <input type="checkbox" id = "allow-filling-forms" checked class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded" >
                                                                                                                                    Allow Form Filling
                                                                                                                                        </label>
                                                                                                                                        <label class="flex items-center gap-2 text-gray-300 cursor-pointer hover:text-white" >
                                                                                                                                            <input type="checkbox" id = "allow-document-assembly" checked class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded" >
                                                                                                                                                Allow Page Assembly
                                                                                                                                                    </label>
                                                                                                                                                    <label class="flex items-center gap-2 text-gray-300 cursor-pointer hover:text-white" >
                                                                                                                                                        <input type="checkbox" id = "allow-page-extraction" checked class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded" >
                                                                                                                                                            Allow Page Extraction
                                                                                                                                                                </label>
                                                                                                                                                                </div>
                                                                                                                                                                </fieldset>
                                                                                                                                                                </div>
                                                                                                                                                                <button id = "process-btn" class="hidden btn-gradient w-full mt-6" > Apply Changes </button>
                                                                                                                                                                    `,

  'pdf-to-markdown': () => `
                                                                                                                                                                    <h2 class="text-2xl font-bold text-white mb-4" > PDF to Markdown </h2>
                                                                                                                                                                        <p class="mb-6 text-gray-400" > Convert a PDF's text content into a structured Markdown file.</p>
        ${createFileInputHTML({ accept: '.pdf' })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div class="hidden mt-4 p-3 bg-gray-900 border border-yellow-500/30 text-yellow-200 rounded-lg" id = "quality-note" >
        <p class="text-sm text-gray-400" > <b>Note: </b> This is a text-focused conversion. Tables and images will not be included.</p >
            </div>
            <button id = "process-btn" class="hidden btn-gradient w-full mt-6" > Convert to Markdown </button>
                `,
  'txt-to-pdf': () => `
                <h2 class="text-2xl font-bold text-white mb-4" > 文本转PDF </h2>
                    <p class="mb-6 text-gray-400" > 上传一个或多个文本文件，或在下方输入/粘贴文本以转换为自定义格式的PDF。</p>

                        <div class="mb-4" >
                            <div class="flex gap-2 p-1 rounded-lg bg-gray-900 border border-gray-700 mb-4" >
                                <button id="txt-mode-upload-btn" class="flex-1 btn bg-indigo-600 text-white font-semibold py-2 rounded-md" > 上传文件 </button>
                                    <button id = "txt-mode-text-btn" class="flex-1 btn bg-gray-700 text-gray-300 font-semibold py-2 rounded-md" > 输入文本 </button>
                                        </div>

                                        <div id = "txt-upload-panel" >
                                            ${createFileInputHTML({ multiple: true, accept: 'text/plain,.txt', showControls: true })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    </div>

    <div id = "txt-text-panel" class="hidden" >
        <textarea id="text-input" rows = "12" class="w-full bg-gray-900 border border-gray-600 text-gray-300 rounded-lg p-2.5 font-sans" placeholder = "Start typing here..." > </textarea>
            </div>
            </div>

            <div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4" >
                <div>
                <label class="block mb-2 text-sm font-medium text-gray-300" > Select Languages </label>
                    <div class="relative" >
                        <button id="lang-dropdown-btn" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 text-left flex justify-between items-center" >
                            <span id="lang-dropdown-text" class="truncate" > English(Default) </span>
                                <i data-lucide="chevron-down" class="w-4 h-4" > </i>
                                    </button>
                                    <div id = "lang-dropdown-content" class="hidden absolute z-10 w-full bg-gray-800 border border-gray-600 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg" >
                                        <div class="p-2 sticky top-0 bg-gray-800 border-b border-gray-700" >
                                            <input type="text" id = "lang-search" class="w-full bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-sm" placeholder = "Search languages..." >
                                                </div>
                                                <div id = "language-list-container" class="p-2 space-y-1" >
                                                    <!--Checkboxes injected here-- >
                                                        </div>
                                                        </div>
                                                        </div>
                                                        </div>
                                                        <div >
                                                        <label for= "font-size" class= "block mb-2 text-sm font-medium text-gray-300" > Font Size </label>
                                                            <input type = "number" id = "font-size" value = "12" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                </div>
                                                                <div >
                                                                <label for= "page-size" class= "block mb-2 text-sm font-medium text-gray-300" > Page Size </label>
                                                                    <select id = "page-size" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                        <optgroup label="ISO A Series" >
                                                                            <option value="A4" selected > A4(210 x 297 mm) </option>
                                                                                <option value = "A3" > A3(297 x 420 mm) </option>
                                                                                    <option value = "A5" > A5(148 x 210 mm) </option>
                                                                                        <option value = "A6" > A6(105 x 148 mm) </option>
                                                                                            </optgroup>
                                                                                            <optgroup label = "North American" >
                                                                                                <option value="Letter" > Letter(8.5 x 11 in) </option>
                                                                                                    <option value = "Legal" > Legal(8.5 x 14 in) </option>
                                                                                                        <option value = "Tabloid" > Tabloid(11 x 17 in) </option>
                                                                                                            <option value = "Executive" > Executive(7.25 x 10.5 in) </option>
                                                                                                                </optgroup>
                                                                                                                <optgroup label = "ISO B Series" >
                                                                                                                    <option value="B4" > B4(250 x 353 mm) </option>
                                                                                                                        <option value = "B5" > B5(176 x 250 mm) </option>
                                                                                                                            </optgroup>
                                                                                                                            <option value = "Custom" > Custom Size </option>
                                                                                                                                </select>
                                                                                                                                </div>
                                                                                                                                <div >
                                                                                                                                <label for= "page-orientation" class= "block mb-2 text-sm font-medium text-gray-300" > Orientation </label>
                                                                                                                                    <select id = "page-orientation" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                                                                                        <option value="portrait" > Portrait </option>
                                                                                                                                            <option value = "landscape" > Landscape </option>
                                                                                                                                                </select>
                                                                                                                                                </div>
                                                                                                                                                <div id = "custom-size-container" class="hidden col-span-2 grid grid-cols-2 gap-4" >
                                                                                                                                                    <div>
                                                                                                                                                    <label for= "custom-width" class= "block mb-2 text-sm font-medium text-gray-300" > Width(pt) </label>
                                                                                                                                                        <input type = "number" id = "custom-width" value = "595" min = "1" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                                                                                                            </div>
                                                                                                                                                            <div >
                                                                                                                                                            <label for= "custom-height" class= "block mb-2 text-sm font-medium text-gray-300" > Height(pt) </label>
                                                                                                                                                                <input type = "number" id = "custom-height" value = "842" min = "1" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                                                                                                                    </div>
                                                                                                                                                                    </div>
                                                                                                                                                                    <div >
                                                                                                                                                                    <label for= "text-color" class= "block mb-2 text-sm font-medium text-gray-300" > Text Color </label>
                                                                                                                                                                        <input type = "color" id = "text-color" value = "#000000" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer" >
                                                                                                                                                                            </div>
                                                                                                                                                                            </div>
                                                                                                                                                                            <button id = "process-btn" class="btn-gradient w-full mt-6" > Create PDF </button>
                                                                                                                                                                                `,
  'invert-colors': () => `
                                                                                                                                                                                <h2 class="text-2xl font-bold text-white mb-4" > 反转PDF颜色 </h2>
                                                                                                                                                                                    <p class="mb-6 text-gray-400" > 通过反转颜色将PDF转换为“深色模式”。适用于简单的文本和图像文档。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="hidden btn-gradient w-full mt-6" > 反转颜色并下载 </button>
        `,
  'view-metadata': () => `
        <h2 class="text-2xl font-bold text-white mb-4" > 查看PDF元数据 </h2>
            <p class="mb-6 text-gray-400" > 上传PDF以查看其内部属性，如标题、作者和创建日期。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "metadata-results" class="hidden mt-6 p-4 bg-gray-900 border border-gray-700 rounded-lg" > </div>
        `,
  'reverse-pages': () => `
        <h2 class="text-2xl font-bold text-white mb-4" > 反转PDF页面 </h2>
            <p class="mb-6 text-gray-400" > 翻转文档中所有页面的顺序，使最后一页变为第一页。</p>
        ${createFileInputHTML({ multiple: true, accept: 'application/pdf', showControls: true })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="hidden btn-gradient w-full mt-6" > 反转并下载 </button>
        `,
  'md-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4" > Markdown转PDF </h2>
            <p class="mb-6 text-gray-400" > 用Markdown编写，选择格式选项，获取高质量的多页PDF。<br > <strong class="text-gray-300" > 注意：</strong> 从网络链接的图像(例如，https://...)需要互联网连接才能渲染。</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" >
                    <div>
                    <label for= "page-format" class= "block mb-2 text-sm font-medium text-gray-300" > Page Format </label>
                        <select id = "page-format" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                            <option value="a4" > A4 </option>
                                <option value = "letter" > Letter </option>
                                    </select>
                                    </div>
                                    <div >
                                    <label for= "orientation" class= "block mb-2 text-sm font-medium text-gray-300" > Orientation </label>
                                        <select id = "orientation" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                            <option value="portrait" > Portrait </option>
                                                <option value = "landscape" > Landscape </option>
                                                    </select>
                                                    </div>
                                                    <div >
                                                    <label for= "margin-size" class= "block mb-2 text-sm font-medium text-gray-300" > Margin Size </label>
                                                        <select id = "margin-size" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                            <option value="normal" > Normal </option>
                                                                <option value = "narrow" > Narrow </option>
                                                                    <option value = "wide" > Wide </option>
                                                                        </select>
                                                                        </div>
                                                                        </div>
                                                                        <div class="h-[50vh]" >
                                                                            <label for= "md-input" class= "block mb-2 text-sm font-medium text-gray-300" > Markdown Editor </label>
                                                                                <textarea id = "md-input" class="w-full h-full bg-gray-900 border border-gray-600 text-gray-300 rounded-lg p-3 font-mono resize-none" placeholder = "# Welcome to Markdown..." > </textarea>
                                                                                    </div>
                                                                                    <button id = "process-btn" class="btn-gradient w-full mt-6" > Create PDF from Markdown </button>
                                                                                        `,
  'svg-to-pdf': () => `
                                                                                        <h2 class="text-2xl font-bold text-white mb-4" > SVG转PDF </h2>
                                                                                            <p class="mb-6 text-gray-400" > 将一个或多个SVG矢量图像转换为单个PDF文件。</p>
        ${createFileInputHTML({ multiple: true, accept: 'image/svg+xml', showControls: true })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="btn-gradient w-full mt-6" > 转换为PDF </button>
        `,
  'bmp-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4" > BMP转PDF </h2>
            <p class="mb-6 text-gray-400" > 将一个或多个BMP图像转换为单个PDF文件。</p>
        ${createFileInputHTML({ multiple: true, accept: 'image/bmp', showControls: true })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="btn-gradient w-full mt-6" > 转换为PDF </button>
        `,
  'heic-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4" > HEIC转PDF </h2>
            <p class="mb-6 text-gray-400" > 将iPhone或相机中的一个或多个HEIC(高效)图像转换为单个PDF文件。</p>
        ${createFileInputHTML({ multiple: true, accept: '.heic,.heif', showControls: true })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="btn-gradient w-full mt-6" > 转换为PDF </button>
        `,
  'tiff-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4" > TIFF转PDF </h2>
            <p class="mb-6 text-gray-400" > 将一个或多个单页或多页TIFF图像转换为单个PDF文件。</p>
        ${createFileInputHTML({ multiple: true, accept: 'image/tiff', showControls: true })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="btn-gradient w-full mt-6" > 转换为PDF </button>
        `,
  'pdf-to-bmp': () => `
        <h2 class="text-2xl font-bold text-white mb-4" > PDF转BMP </h2>
            <p class="mb-6 text-gray-400" > 将PDF文件的每一页转换为BMP图像。您的文件将下载到ZIP压缩包中。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="btn-gradient w-full mt-6" > 转换为BMP并下载ZIP </button>
        `,
  'pdf-to-tiff': () => `
        <h2 class="text-2xl font-bold text-white mb-4" > PDF转TIFF </h2>
            <p class="mb-6 text-gray-400" > 将PDF文件的每一页转换为高质量TIFF图像。您的文件将下载到ZIP压缩包中。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="btn-gradient w-full mt-6" > 转换为TIFF并下载ZIP </button>
        `,

  'split-in-half': () => `
        <h2 class="text-2xl font-bold text-white mb-4" > 将页面分为两半 </h2>
            <p class="mb-6 text-gray-400" > 选择一种方法将文档的每一页分成两个单独的页面。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>

    <div id = "split-half-options" class="hidden mt-6" >
        <label for= "split-type" class= "block mb-2 text-sm font-medium text-gray-300" > 选择分割类型 </label>
            <select id = "split-type" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-6" >
                <option value="vertical" > 垂直分割(左右半部) </option>
                    <option value = "horizontal" > 水平分割(上下半部) </option>
                        </select>

                        <button id = "process-btn" class="btn-gradient w-full mt-6" > 分割PDF </button>
                            </div>
                                `,
  'page-dimensions': () => `
                            <h2 class="text-2xl font-bold text-white mb-4" > 分析页面尺寸 </h2>
                                <p class="mb-6 text-gray-400" > 上传PDF以查看每一页的精确尺寸、标准大小和方向。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>

    <div id = "dimensions-results" class="hidden mt-6" >
        <!--Summary Statistics Panel-- >
            <div id="dimensions-summary" class="mb-6" > </div>

                <!--Controls Row-- >
                    <div class="flex flex-wrap justify-between items-center gap-4 mb-4" >
                        <div class="flex items-center gap-3" >
                            <label for= "units-select" class= "text-sm font-medium text-gray-300" > Display Units: </label>
                                <select id = "units-select" class="bg-gray-700 border border-gray-600 text-white rounded-lg p-2" >
                                    <option value="pt" selected > Points(pt) </option>
                                        <option value = "in" > Inches(in) </option>
                                            <option value = "mm" > Millimeters(mm) </option>
                                                <option value = "px" > Pixels(at 96 DPI) </option>
                                                    </select>
                                                    </div>
                                                    <button id = "export-csv-btn" class="btn bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2" >
                                                        <i data-lucide="download" class="w-4 h-4" > </i>
                    Export to CSV
    </button>
    </div>

    <!--Dimensions Table-- >
        <div class="overflow-x-auto rounded-lg border border-gray-700" >
            <table class="min-w-full divide-y divide-gray-700 text-sm text-left" >
                <thead class="bg-gray-900" >
                    <tr>
                    <th class="px-4 py-3 font-medium text-white" > Page # </th>
                        <th class="px-4 py-3 font-medium text-white" > Dimensions(W x H) </th>
                            <th class="px-4 py-3 font-medium text-white" > Standard Size </th>
                                <th class="px-4 py-3 font-medium text-white" > Orientation </th>
                                    <th class="px-4 py-3 font-medium text-white" > Aspect Ratio </th>
                                        <th class="px-4 py-3 font-medium text-white" > Area </th>
                                            <th class="px-4 py-3 font-medium text-white" > Rotation </th>
                                                </tr>
                                                </thead>
                                                <tbody id = "dimensions-table-body" class="divide-y divide-gray-700" >
                                                    </tbody>
                                                    </table>
                                                    </div>
                                                    </div>
                                                        `,

  'n-up': () => `
                                                    <h2 class="text-2xl font-bold text-white mb-4" > N - Up Page Arrangement </h2>
                                                        <p class="mb-6 text-gray-400" > Combine multiple pages from your PDF onto a single sheet.This is great for creating booklets or proof sheets.</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>

    <div id = "n-up-options" class="hidden mt-6 space-y-4" >
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" >
            <div>
            <label for= "pages-per-sheet" class= "block mb-2 text-sm font-medium text-gray-300" > Pages Per Sheet </label>
                <select id = "pages-per-sheet" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                    <option value="2" > 2 - Up </option>
                        <option value = "4" selected > 4 - Up(2x2) </option>
                            <option value = "9" > 9 - Up(3x3) </option>
                                <option value = "16" > 16 - Up(4x4) </option>
                                    </select>
                                    </div>
                                    <div >
                                    <label for= "output-page-size" class= "block mb-2 text-sm font-medium text-gray-300" > Output Page Size </label>
                                        <select id = "output-page-size" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                            <option value="Letter" > Letter(8.5 x 11 in) </option>
                                                <option value = "Legal" > Legal(8.5 x 14 in) </option>
                                                    <option value = "Tabloid" > Tabloid(11 x 17 in) </option>
                                                        <option value = "A4" selected > A4(210 x 297 mm) </option>
                                                            <option value = "A3" > A3(297 x 420 mm) </option>
                                                                </select>
                                                                </div>
                                                                </div>

                                                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" >
                                                                    <div>
                                                                    <label for= "output-orientation" class= "block mb-2 text-sm font-medium text-gray-300" > Output Orientation </label>
                                                                        <select id = "output-orientation" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                            <option value="auto" selected > Automatic </option>
                                                                                <option value = "portrait" > Portrait </option>
                                                                                    <option value = "landscape" > Landscape </option>
                                                                                        </select>
                                                                                        </div>
                                                                                        <div class="flex items-end pb-1" >
                                                                                            <label class="flex items-center gap-2 text-sm font-medium text-gray-300" >
                                                                                                <input type="checkbox" id = "add-margins" checked class="w-4 h-4 rounded text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500" >
                                                                                                    Add Margins & Gutters
                                                                                                        </label>
                                                                                                        </div>
                                                                                                        </div>

                                                                                                        <div class="border-t border-gray-700 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4" >
                                                                                                            <div class="flex items-center" >
                                                                                                                <label class="flex items-center gap-2 text-sm font-medium text-gray-300" >
                                                                                                                    <input type="checkbox" id = "add-border" class="w-4 h-4 rounded text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500" >
                                                                                                                        Draw Border Around Each Page
                                                                                                                            </label>
                                                                                                                            </div>
                                                                                                                            <div id = "border-color-wrapper" class="hidden" >
                                                                                                                                <label for= "border-color" class= "block mb-2 text-sm font-medium text-gray-300" > Border Color </label>
                                                                                                                                    <input type = "color" id = "border-color" value = "#000000" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer" >
                                                                                                                                        </div>
                                                                                                                                        </div>

                                                                                                                                        <button id = "process-btn" class="btn-gradient w-full mt-6" > Create N - Up PDF </button>
                                                                                                                                            </div>
                                                                                                                                                `,

  'duplicate-organize': () => `
                                                                                                                                            <h2 class="text-2xl font-bold text-white mb-4" > 页面管理器 </h2>
                                                                                                                                                <p class="mb-6 text-gray-400" > 拖动页面以重新排序。使用 <i data-lucide="copy-plus" class="inline-block w-4 h-4 text-green-400" > </i> 图标复制页面或使用 <i data-lucide="x-circle" class="inline-block w-4 h-4 text-red-400"></i > 图标删除页面。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>

    <div id = "page-manager-options" class="hidden mt-6" >
        <div id="page-grid" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 my-6" >
            </div>
            <button id = "process-btn" class="btn-gradient w-full mt-6" > 保存新PDF </button>
                </div>
                    `,

  'combine-single-page': () => `
                <h2 class="text-2xl font-bold text-white mb-4" > 合并为单页 </h2>
                    <p class="mb-6 text-gray-400" > 将PDF的所有页面垂直或水平拼接在一起，创建一个连续的页面。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>

    <div id = "combine-options" class="hidden mt-6 space-y-4" >
        <div>
        <label for= "combine-orientation" class= "block mb-2 text-sm font-medium text-gray-300" > 方向 </label>
            <select id = "combine-orientation" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                <option value="vertical" selected > 垂直(从上到下堆叠页面) </option>
                    <option value = "horizontal" > 水平(从左到右堆叠页面) </option>
                        </select>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" >
                            <div>
                            <label for= "page-spacing" class= "block mb-2 text-sm font-medium text-gray-300" > 页面间距(以点为单位) </label>
                                <input type = "number" id = "page-spacing" value = "18" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                    </div>
                                    <div >
                                    <label for= "background-color" class= "block mb-2 text-sm font-medium text-gray-300" > 背景颜色 </label>
                                        <input type = "color" id = "background-color" value = "#FFFFFF" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer" >
                                            </div>
                                            </div>

                                            <div >
                                            <label class="flex items-center gap-2 text-sm font-medium text-gray-300" >
                                                <input type="checkbox" id = "add-separator" class="w-4 h-4 rounded text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500" >
                                                    在页面之间绘制分隔线
                                                        </label>
                                                        </div>

                                                        <div id = "separator-options" class="hidden grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-gray-900 border border-gray-700" >
                                                            <div>
                                                            <label for= "separator-thickness" class= "block mb-2 text-sm font-medium text-gray-300" > 分隔线粗细(以点为单位) </label>
                                                                <input type = "number" id = "separator-thickness" value = "0.5" min = "0.1" max = "10" step = "0.1" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                    </div>
                                                                    <div >
                                                                    <label for= "separator-color" class= "block mb-2 text-sm font-medium text-gray-300" > 分隔线颜色 </label>
                                                                        <input type = "color" id = "separator-color" value = "#CCCCCC" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer" >
                                                                            </div>
                                                                            </div>

                                                                            <button id = "process-btn" class="btn-gradient w-full mt-6" > 合并页面 </button>
                                                                                </div>
                                                                                    `,

  'fix-dimensions': () => `
                                                                                <h2 class="text-2xl font-bold text-white mb-4" > 标准化页面尺寸 </h2>
                                                                                    <p class="mb-6 text-gray-400" > 将PDF中的所有页面转换为统一大小。选择标准格式或定义自定义尺寸。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>

    <div id = "fix-dimensions-options" class="hidden mt-6 space-y-4" >
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" >
            <div>
            <label for= "target-size" class= "block mb-2 text-sm font-medium text-gray-300" > 目标大小 </label>
                <select id = "target-size" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                    <option value="A4" selected > A4 </option>
                        <option value = "Letter" > Letter </option>
                            <option value = "Legal" > Legal </option>
                                <option value = "Tabloid" > Tabloid </option>
                                    <option value = "A3" > A3 </option>
                                        <option value = "A5" > A5 </option>
                                            <option value = "Custom" > 自定义大小...</option>
                                                </select>
                                                </div>
                                                <div >
                                                <label for= "orientation" class= "block mb-2 text-sm font-medium text-gray-300" > 方向 </label>
                                                    <select id = "orientation" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                        <option value="portrait" selected > 纵向 </option>
                                                            <option value = "landscape" > 横向 </option>
                                                                </select>
                                                                </div>
                                                                </div>

                                                                <div id = "custom-size-wrapper" class="hidden p-4 rounded-lg bg-gray-900 border border-gray-700 grid grid-cols-3 gap-3" >
                                                                    <div>
                                                                    <label for= "custom-width" class= "block mb-2 text-xs font-medium text-gray-300" > 宽度 </label>
                                                                        <input type = "number" id = "custom-width" value = "8.5" class="w-full bg-gray-700 border-gray-600 text-white rounded-lg p-2" >
                                                                            </div>
                                                                            <div >
                                                                            <label for= "custom-height" class= "block mb-2 text-xs font-medium text-gray-300" > 高度 </label>
                                                                                <input type = "number" id = "custom-height" value = "11" class="w-full bg-gray-700 border-gray-600 text-white rounded-lg p-2" >
                                                                                    </div>
                                                                                    <div >
                                                                                    <label for= "custom-units" class= "block mb-2 text-xs font-medium text-gray-300" > 单位 </label>
                                                                                        <select id = "custom-units" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2" >
                                                                                            <option value="in" > 英寸 </option>
                                                                                                <option value = "mm" > 毫米 </option>
                                                                                                    </select>
                                                                                                    </div>
                                                                                                    </div>

                                                                                                    <div >
                                                                                                    <label class="block mb-2 text-sm font-medium text-gray-300" > 内容缩放方法 </label>
                                                                                                        <div class="flex gap-4 p-2 rounded-lg bg-gray-900" >
                                                                                                            <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer" >
                                                                                                                <input type="radio" name = "scaling-mode" value = "fit" checked class="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500" >
                                                                                                                    <div>
                                                                                                                    <span class="font-semibold text-white" > 适应 </span>
                                                                                                                        <p class="text-xs text-gray-400" > 保留所有内容，可能添加空白条。</p>
                                                                                                                            </div>
                                                                                                                            </label>
                                                                                                                            <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer" >
                                                                                                                                <input type="radio" name = "scaling-mode" value = "fill" class="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500" >
                                                                                                                                    <div>
                                                                                                                                    <span class="font-semibold text-white" > 填充 </span>
                                                                                                                                        <p class="text-xs text-gray-400" > 覆盖页面，可能裁剪内容。</p>
                                                                                                                                            </div>
                                                                                                                                            </label>
                                                                                                                                            </div>
                                                                                                                                            </div>

                                                                                                                                            <div >
                                                                                                                                            <label for= "background-color" class= "block mb-2 text-sm font-medium text-gray-300" > 背景颜色(用于“适应”模式)</label>
                                                                                                                                                <input type = "color" id = "background-color" value = "#FFFFFF" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer" >
                                                                                                                                                    </div>

                                                                                                                                                    <button id = "process-btn" class="btn-gradient w-full mt-6" > 标准化页面 </button>
                                                                                                                                                        </div>
                                                                                                                                                            `,

  'change-background-color': () => `
                                                                                                                                                        <h2 class="text-2xl font-bold text-white mb-4" > 修改背景颜色 </h2>
                                                                                                                                                            <p class="mb-6 text-gray-400" > 为PDF的每一页选择新的背景颜色。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "change-background-color-options" class="hidden mt-6" >
        <label for= "background-color" class= "block mb-2 text-sm font-medium text-gray-300" > 选择背景颜色 </label>
            <input type = "color" id = "background-color" value = "#FFFFFF" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer" >
                <button id="process-btn" class="btn-gradient w-full mt-6" > 应用颜色并下载 </button>
                    </div>
                        `,

  'change-text-color': () => `
                    <h2 class="text-2xl font-bold text-white mb-4" > 修改文本颜色 </h2>
                        <p class="mb-6 text-gray-400" > 修改PDF中深色文本的颜色。此过程会将页面转换为图像，因此最终文件中的文本将不可选中。</p>
        ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "text-color-options" class="hidden mt-6 space-y-4" >
        <div>
        <label for= "text-color-input" class= "block mb-2 text-sm font-medium text-gray-300" > 选择文本颜色 </label>
            <input type = "color" id = "text-color-input" value = "#FF0000" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer" >
                </div>
                <div class="grid grid-cols-2 gap-4" >
                    <div class="text-center" >
                        <h3 class="font-semibold text-white mb-2" > 原始 </h3>
                            <canvas id = "original-canvas" class="w-full h-auto rounded-lg border-2 border-gray-600" > </canvas>
                                </div>
                                <div class="text-center" >
                                    <h3 class="font-semibold text-white mb-2" > 预览 </h3>
                                        <canvas id = "text-color-canvas" class="w-full h-auto rounded-lg border-2 border-gray-600" > </canvas>
                                            </div>
                                            </div>
                                            <button id = "process-btn" class="btn-gradient w-full mt-6" > 应用颜色并下载 </button>
                                                </div>
                                                    `,

  'compare-pdfs': () => `
                                                <h2 class="text-2xl font-bold text-white mb-4" > 比较PDF </h2>
                                                    <p class="mb-6 text-gray-400" > 上传两个文件，使用叠加或并排视图进行直观比较。</p>

                                                        <div id = "compare-upload-area" class="grid grid-cols-1 md:grid-cols-2 gap-4" >
                                                            <div id="drop-zone-1" class="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer bg-gray-900 hover:bg-gray-700" >
                                                                <div id="file-display-1" class="flex flex-col items-center justify-center pt-5 pb-6" >
                                                                    <i data-lucide="file-scan" class="w-10 h-10 mb-3 text-gray-400" > </i>
                                                                        <p class="mb-2 text-sm text-gray-400" > <span class="font-semibold" > 上传原始PDF < /span></p >
                                                                            </div>
                                                                            <input id = "file-input-1" type = "file" class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" accept = "application/pdf" >
                                                                                </div>
                                                                                <div id = "drop-zone-2" class="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer bg-gray-900 hover:bg-gray-700" >
                                                                                    <div id="file-display-2" class="flex flex-col items-center justify-center pt-5 pb-6" >
                                                                                        <i data-lucide="file-diff" class="w-10 h-10 mb-3 text-gray-400" > </i>
                                                                                            <p class="mb-2 text-sm text-gray-400" > <span class="font-semibold" > 上传修订后的PDF < /span></p >
                                                                                                </div>
                                                                                                <input id = "file-input-2" type = "file" class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" accept = "application/pdf" >
                                                                                                    </div>
                                                                                                    </div>

                                                                                                    <div id = "compare-viewer" class="hidden mt-6" >
                                                                                                        <div class="flex flex-wrap items-center justify-center gap-4 mb-4 p-3 bg-gray-900 rounded-lg border border-gray-700" >
                                                                                                            <button id="prev-page-compare" class="btn p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50" > <i data-lucide="chevron-left" > </i></button >
                                                                                                                <span class="text-white font-medium" > 第 <span id = "current-page-display-compare" > 1 < /span> 页，共 <span id="total-pages-display-compare">1</span > 页</span>
                                                                                                                    <button id = "next-page-compare" class="btn p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50" > <i data-lucide="chevron-right" > </i></button >
                                                                                                                        <div class="border-l border-gray-600 h-6 mx-2" > </div>
                                                                                                                            <div class="bg-gray-700 p-1 rounded-md flex gap-1" >
                                                                                                                                <button id="view-mode-overlay" class="btn bg-indigo-600 px-3 py-1 rounded text-sm font-semibold" > 叠加 </button>
                                                                                                                                    <button id = "view-mode-side" class="btn px-3 py-1 rounded text-sm font-semibold" > 并排 </button>
                                                                                                                                        </div>
                                                                                                                                        <div class="border-l border-gray-600 h-6 mx-2" > </div>
                                                                                                                                            <div id = "overlay-controls" class="flex items-center gap-2" >
                                                                                                                                                <button id="flicker-btn" class="btn bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-md text-sm font-semibold" > 闪烁 </button>
                                                                                                                                                    <label for= "opacity-slider" class= "text-sm font-medium text-gray-300" > 不透明度: </label>
                                                                                                                                                        <input type = "range" id = "opacity-slider" min = "0" max = "1" step = "0.05" value = "0.5" class="w-24" >
                                                                                                                                                            </div>
                                                                                                                                                            <div id = "side-by-side-controls" class="hidden flex items-center gap-2" >
                                                                                                                                                                <label class="flex items-center gap-2 text-sm font-medium text-gray-300 cursor-pointer" >
                                                                                                                                                                    <input type="checkbox" id = "sync-scroll-toggle" checked class="w-4 h-4 rounded text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500" >
                                                                                                                                                                        同步滚动
                                                                                                                                                                            </label>
                                                                                                                                                                            </div>
                                                                                                                                                                            </div>
                                                                                                                                                                            <div id = "compare-viewer-wrapper" class="compare-viewer-wrapper overlay-mode" >
                                                                                                                                                                                <div id="panel-1" class="pdf-panel" > <canvas id="canvas-compare-1" > </canvas></div >
                                                                                                                                                                                    <div id="panel-2" class="pdf-panel" > <canvas id="canvas-compare-2" > </canvas></div >
                                                                                                                                                                                        </div>
                                                                                                                                                                                        </div>
                                                                                                                                                                                            `,

  'ocr-pdf': () => `
                                                                                                                                                                                        <h2 class="text-2xl font-bold text-white mb-4" > OCR PDF </h2>
                                                                                                                                                                                            <p class="mb-6 text-gray-400" > 将扫描的PDF转换为可搜索文档。选择文件中的一种或多种语言以获得最佳效果。</p>

                                                                                                                                                                                                <div class="p-3 bg-gray-900 rounded-lg border border-gray-700 mb-6" >
                                                                                                                                                                                                    <p class="text-sm text-gray-300" > <strong class="text-white" > 工作原理: </strong></p >
                                                                                                                                                                                                        <ul class="list-disc list-inside text-xs text-gray-400 mt-1 space-y-1" >
                                                                                                                                                                                                            <li><strong class="text-white" > 提取文本: </strong> 使用Tesseract OCR从扫描的图像或PDF中识别文本。</li >
                                                                                                                                                                                                                <li><strong class="text-white" > 可搜索输出: </strong> 创建带有不可见文本层的新PDF，使您的文档完全可搜索，同时保留原始外观。</li >
                                                                                                                                                                                                                    <li><strong class="text-white" > 字符过滤: </strong> 使用白名单过滤不需要的字符，提高特定文档类型(发票、表单等)的准确性。</li >
                                                                                                                                                                                                                        <li><strong class="text-white" > 多语言支持: </strong> 为包含混合语言内容的文档选择多种语言。</li >
                                                                                                                                                                                                                            </ul>
                                                                                                                                                                                                                            </div>
    
    ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>

    <div id = "ocr-options" class="hidden mt-6 space-y-4" >
        <div>
        <label class="block mb-2 text-sm font-medium text-gray-300" > 文档中的语言 </label>
            <div class="relative" >
                <input type="text" id = "lang-search" class="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2.5 mb-2" placeholder = "搜索语言..." >
                    <div id="lang-list" class="max-h-48 overflow-y-auto border border-gray-600 rounded-lg p-2 bg-gray-900" >
                        ${Object.entries(tesseractLanguages)
                          .map(
                            ([code, name]) => `
                        <label class="flex items-center gap-2 p-2 rounded-md hover:bg-gray-700 cursor-pointer">
                            <input type="checkbox" value="${code}" class="lang-checkbox w-4 h-4 rounded text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500">
                            ${name}
                        </label>
                    `
                          )
                          .join('')}
</div>
    </div>
    <p class="text-xs text-gray-500 mt-1" > 已选择: <span id="selected-langs-display" class="font-semibold" > 无 < /span></p >
        </div>

        <!--Advanced settings section-- >
            <details class="bg-gray-900 border border-gray-700 rounded-lg p-3" >
                <summary class="text-sm font-medium text-gray-300 cursor-pointer flex items-center justify-between" >
                    <span>高级设置(建议提高准确性) </span>
                        <i data-lucide="chevron-down" class="w-4 h-4 transition-transform details-icon" > </i>
                            </summary>
                            <div class="mt-4 space-y-4" >
                                <!--Resolution Setting-- >
                                    <div>
                                    <label for= "ocr-resolution" class= "block mb-1 text-xs font-medium text-gray-400" > 分辨率 </label>
                                        <select id = "ocr-resolution" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2 text-sm" >
                                            <option value="2.0" > 标准(192 DPI) </option>
                                                <option value = "3.0" selected > 高(288 DPI) </option>
                                                    <option value = "4.0" > 超高(384 DPI) </option>
                                                        </select>
                                                        </div>
                                                        <!--Binarization Toggle-- >
                                                            <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer" >
                                                                <input type="checkbox" id = "ocr-binarize" class="w-4 h-4 rounded text-indigo-600 bg-gray-700 border-gray-600" >
                                                                    二值化图像(增强干净扫描的对比度)
    </label>

        <!--Character Whitelist Presets-- >
            <div>
            <label for= "whitelist-preset" class= "block mb-1 text-xs font-medium text-gray-400" > 字符白名单预设 </label>
                <select id = "whitelist-preset" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2 text-sm mb-2" >
                    <option value="" > 无(所有字符) </option>
                        <option value = "alphanumeric" > 字母数字 + 基本标点 </option>
                            <option value = "numbers-currency" > 数字 + 货币符号 </option>
                                <option value = "letters-only" > 仅字母(A - Z, a - z) </option>
                                    <option value = "numbers-only" > 仅数字(0 - 9) </option>
                                        <option value = "invoice" > 发票/收据(数字, $, ., -, /)</option >
                                            <option value="forms" > 表单(字母数字 + 常用符号) </option>
                                        <option value = "custom" > 自定义...</option>
                                        </select>
                                        <p class= "text-xs text-gray-500 mt-1" > 仅识别这些字符。留空表示所有字符。</p>
                                            </div>

                                            <!--Character Whitelist Input-- >
                                                <div>
                                                <label for= "ocr-whitelist" class= "block mb-1 text-xs font-medium text-gray-400" > 字符白名单(可选) </label>
                                                    <input type = "text" id = "ocr-whitelist" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2 text-sm" placeholder = "例如：abcdefghijklmnopqrstuvwxyz0123456789$.," >
                                                        <p class="text-xs text-gray-500 mt-1" > 仅识别这些字符。留空表示所有字符。</p>
                                                            </div>
                                                            </div>
                                                            </details>

                                                            <button id = "process-btn" class="btn-gradient w-full disabled:opacity-50" disabled > 开始OCR </button>
                                                                </div>

                                                                <div id = "ocr-progress" class="hidden mt-6 p-4 bg-gray-900 border border-gray-700 rounded-lg" >
                                                                    <p id="progress-status" class="text-white mb-2" > 初始化中...</p>
                                                                        <div class="w-full bg-gray-700 rounded-full h-4" >
                                                                            <div id="progress-bar" class="bg-indigo-600 h-4 rounded-full transition-width duration-300" style = "width: 0%" > </div>
                                                                                </div>
                                                                                <pre id = "progress-log" class="mt-4 text-xs text-gray-400 max-h-32 overflow-y-auto bg-black p-2 rounded-md" > </pre>
                                                                                    </div>

                                                                                    <div id = "ocr-results" class="hidden mt-6" >
                                                                                        <h3 class="text-xl font-bold text-white mb-2" > OCR完成 </h3>
                                                                                            <p class="mb-4 text-gray-400" > 您的可搜索PDF已准备好。您还可以复制或下载下面提取的文本。</p>
                                                                                                <div class="relative" >
                                                                                                    <textarea id="ocr-text-output" rows = "10" class="w-full bg-gray-900 border border-gray-600 text-gray-300 rounded-lg p-2.5 font-sans" readonly > </textarea>
                                                                                                        <button id = "copy-text-btn" class="absolute top-2 right-2 btn bg-gray-700 hover:bg-gray-600 p-2 rounded-md" title = "复制到剪贴板" >
                                                                                                            <i data-lucide="clipboard-copy" class="w-4 h-4 text-gray-300" > </i>
                                                                                                                </button>
                                                                                                                </div>
                                                                                                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4" >
                                                                                                                    <button id="download-txt-btn" class="btn w-full bg-gray-700 text-white font-semibold py-3 rounded-lg hover:bg-gray-600" > 下载为 .txt</button >
                                                                                                                        <button id="download-searchable-pdf" class="btn w-full bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700" > 下载可搜索PDF </button>
                                                                                                                            </div>
                                                                                                                            </div>
                                                                                                                                `,

  'word-to-pdf': () => `
                                                                                                                            <h2 class="text-2xl font-bold text-white mb-4" > Word转PDF </h2>
                                                                                                                                <p class="mb-6 text-gray-400" > 上传.docx文件将其转换为高质量的可选择文本的PDF。复杂的布局可能无法完美保留。</p>

                                                                                                                                    <div id = "file-input-wrapper" >
                                                                                                                                        <div class="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer bg-gray-900 hover:bg-gray-700" >
                                                                                                                                            <div class="flex flex-col items-center justify-center pt-5 pb-6" >
                                                                                                                                                <i data-lucide="file-text" class="w-10 h-10 mb-3 text-gray-400" > </i>
                                                                                                                                                    <p class="mb-2 text-sm text-gray-400" > <span class="font-semibold" > 点击选择文件 < /span> 或拖放</p >
                                                                                                                                                        <p class="text-xs text-gray-500" > 单个.docx文件 </p>
                                                                                                                                                            </div>
                                                                                                                                                            <input id = "file-input" type = "file" class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" accept = ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" >
                                                                                                                                                                </div>
                                                                                                                                                                </div>

                                                                                                                                                                <div id = "file-display-area" class="mt-4 space-y-2" > </div>
                                                                                                                                                                    <button id = "process-btn" class="btn-gradient w-full mt-6" disabled > 预览并转换 </button>
                                                                                                                                                                        `,

  'sign-pdf': () => `
                                                                                                                                                                        <h2 class="text-2xl font-bold text-white mb-4" > 签名PDF </h2>
                                                                                                                                                                            <p class="mb-6 text-gray-400" > 上传PDF使用内置PDF.js查看器进行签名。在工具栏中查找<strong > 签名/笔工具 < /strong>添加您的签名。</p >
                                                                                                                                                                                ${createFileInputHTML()}
    <div id = "file-display-area" class="mt-4 space-y-2" > </div>

        <div id = "signature-editor" class="hidden mt-6" >
            <div id="canvas-container-sign" class="relative w-full overflow-auto bg-gray-900 rounded-lg border border-gray-600" style = "height: 85vh;" >
                <!--PDF.js viewer iframe will be loaded here-- >
                    </div>

                    <div class="mt-4 flex items-center gap-2" >
                        <label class="flex items-center gap-2 text-sm font-medium text-gray-300 cursor-pointer" >
                            <input type="checkbox" id = "flatten-signature-toggle" class="w-4 h-4 rounded text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500" >
                                拼合PDF(使用下面的保存按钮)
                                    </label>
                                    </div>

                                    <button id = "process-btn" class="btn-gradient w-full mt-4" style = "display:none;" > 保存并下载签名的PDF </button>
                                        </div>
                                            `,

  'remove-annotations': () => `
                                        <h2 class="text-2xl font-bold text-white mb-4" > 删除注释 </h2>
                                            <p class="mb-6 text-gray-400" > 选择要从所有页面或特定范围删除的注释类型。</p>
    ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>

    <div id = "remove-annotations-options" class="hidden mt-6 space-y-6" >
        <div>
        <h3 class="text-lg font-semibold text-white mb-2" > 1. 选择页面 </h3>
            <div class="flex gap-4 p-2 rounded-lg bg-gray-900" >
                <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer" >
                    <input type="radio" name = "page-scope" value = "all" checked class="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500" >
                        <span class="font-semibold text-white" > 所有页面 </span>
                            </label>
                            <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer" >
                                <input type="radio" name = "page-scope" value = "specific" class="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500" >
                                    <span class="font-semibold text-white" > 指定页面 </span>
                                        </label>
                                        </div>
                                        <div id = "page-range-wrapper" class="hidden mt-2" >
                                            <input type="text" id = "page-range-input" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder = "例如：1-3, 5, 8" >
                                                <p class="text-xs text-gray-400 mt-1" > 总页数: <span id="total-pages" > </span></p >
                                                    </div>
                                                    </div>

                                                    <div >
                                                    <h3 class="text-lg font-semibold text-white mb-2" > 2. 选择要删除的注释类型 </h3>
                                                        <div class="space-y-3 p-4 bg-gray-900 rounded-lg border border-gray-700" >
                                                            <div class="border-b border-gray-700 pb-2" >
                                                                <label class="flex items-center gap-2 font-semibold text-white cursor-pointer" >
                                                                    <input type="checkbox" id = "select-all-annotations" class="w-4 h-4 rounded text-indigo-600 bg-gray-700 border-gray-600" >
                                                                        全选/取消全选
                                                                            </label>
                                                                            </div>
                                                                            <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 pt-2" >
                                                                                <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "Highlight" > 高亮 </label>
                                                                                    <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "StrikeOut" > 删除线 </label>
                                                                                        <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "Underline" > 下划线 </label>
                                                                                            <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "Ink" > 墨迹/绘图 </label>
                                                                                                <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "Polygon" > 多边形 </label>
                                                                                                    <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "Square" > 正方形 </label>
                                                                                                        <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "Circle" > 圆形 </label>
                                                                                                            <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "Line" > 线条/箭头 </label>
                                                                                                                <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "PolyLine" > 折线 </label>
                                                                                                                    <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "Link" > 链接 </label>
                                                                                                                        <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "Text" > 文本(注释) </label>
                                                                                                                            <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "FreeText" > 自由文本 </label>
                                                                                                                                <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "Popup" > 弹出/评论 </label>
                                                                                                                                    <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "Squiggly" > 波浪线 </label>
                                                                                                                                        <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "Stamp" > 印章 </label>
                                                                                                                                            <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "Caret" > 插入符 </label>
                                                                                                                                                <label class="flex items-center gap-2" > <input type="checkbox" class="annot-checkbox" value = "FileAttachment" > 附件 </label>
                                                                                                                                                    </div>
                                                                                                                                                    </div>
                                                                                                                                                    </div>
                                                                                                                                                    </div>
                                                                                                                                                    <button id = "process-btn" class="hidden btn-gradient w-full mt-6" > 删除选中的注释 </button>
                                                                                                                                                        `,

  cropper: () => `
                                                                                                                                                        <h2 class="text-2xl font-bold text-white mb-4" > 裁剪PDF </h2>
                                                                                                                                                            <p class="mb-6 text-gray-400" > 上传PDF以直观地裁剪一个或多个页面。该工具提供实时预览和两种不同的裁剪模式。</p>
    
    ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>

    <div id = "cropper-ui-container" class="hidden mt-6" >

        <div class="p-3 bg-gray-900 rounded-lg border border-gray-700 mb-6" >
            <p class="text-sm text-gray-300" > <strong class="text-white" > 工作原理: </strong></p >
                <ul class="list-disc list-inside text-xs text-gray-400 mt-1 space-y-1" >
                    <li><strong class="text-white" > 实时预览: </strong> 在应用之前实时查看裁剪选择。</li >
                                        <li><strong class="text-white" > 非破坏性模式: </strong> 这是默认模式。它只是通过调整页面边界来“隐藏”裁剪的内容。原始文本和数据在文件中保留。</li >
                            <li><strong class="text-white" > 破坏性模式: </strong> 此选项通过拼合PDF永久删除裁剪的内容。使用此选项可以获得最大的安全性和更小的文件大小，但请注意它将删除可选择的文本。</li >
                                </ul>
                                </div>

                                <div class="flex flex-col sm:flex-row items-center justify-between flex-wrap gap-4 mb-4 p-3 bg-gray-900 rounded-lg border border-gray-700" >
                                    <div class="flex items-center gap-2" >
                                        <button id="prev-page" class="btn p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50" > <i data-lucide="chevron-left" class="w-5 h-5" > </i></button >
                                            <span id="page-info" class="text-white font-medium" > 第0页，共0页 </span>
                                                <button id = "next-page" class="btn p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50" > <i data-lucide="chevron-right" class="w-5 h-5" > </i></button >
                                                    </div>

                                                    <div class="flex flex-col sm:flex-row items-center gap-4 flex-wrap" >
                                                        <label class="flex items-center gap-2 text-sm font-medium text-gray-300" >
                                                            <input type="checkbox" id = "destructive-crop-toggle" class="w-4 h-4 rounded text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500" >
                                                                启用破坏性裁剪
                                                                    </label>
                                                                    <label class="flex items-center gap-2 text-sm font-medium text-gray-300" >
                                                                        <input type="checkbox" id = "apply-to-all-toggle" class="w-4 h-4 rounded text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500" >
                                                                            应用到所有页面
                                                                                </label>
                                                                                </div>
                                                                                </div>

                                                                                <div id = "status" class="text-center italic text-gray-400 mb-4" > 请选择一个PDF文件开始。</div>
                                                                                    <div id = "cropper-container" class="w-full relative overflow-hidden flex items-center justify-center bg-gray-900 rounded-lg border border-gray-600 min-h-[500px]" > </div>

                                                                                        <button id = "crop-button" class="btn-gradient w-full mt-6" disabled > 裁剪并下载 </button>
                                                                                            </div>
                                                                                                `,

  'form-filler': () => `
                                                                                            <h2 class="text-2xl font-bold text-white mb-4" > PDF表单填写 </h2>
                                                                                                <p class="mb-6 text-gray-400" > 上传带有表单字段的PDF。在下面的查看器中直接填写，然后点击按钮保存并下载填写好的表单。也支持XFA表单。</p>

                                                                                                    <div class="mb-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg" >
                                                                                                        <p class="text-sm text-blue-300" >
                                                                                                            <strong>XFA表单注意事项: </strong> XFA (XML表单架构)是一种仅被BentoPDF和Firefox等某些PDF查看器支持的传统格式。
        如果您在其他软件中打开XFA PDF并看到空白页面或没有表单字段，这意味着该查看器不支持XFA。
        要正确查看和填写XFA表单，请使用Firefox或BentoPDF的表单填写工具。
    </p>
    </div>
    
    ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "form-filler-options" class="hidden mt-6" >
        <div id="pdf-viewer-container" class="relative w-full overflow-auto bg-gray-900 rounded-lg border border-gray-600" style = "height: 80vh;" >
            <!--PDF.js viewer iframe will be loaded here-- >
                </div>
                <button id = "process-btn" class="btn-gradient w-full mt-4" > 保存并下载填写好的表单 </button>
                    </div>
                        `,

  posterize: () => `
                    <h2 class="text-2xl font-bold text-white mb-4" > 海报化PDF </h2>
                        <p class="mb-6 text-gray-400" > 将页面拆分为多个较小的工作表以打印为海报。浏览预览并查看根据您的设置更新的网格。</p>
    ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>

    <div id = "posterize-options" class="hidden mt-6 space-y-6" >

        <div class="space-y-2" >
            <label class="block text-sm font-medium text-gray-300" > 页面预览(<span id="current-preview-page" > 1 < /span> / <span id = "total-preview-pages" > 1 < /span>)</label >
                <div id="posterize-preview-container" class= "relative w-full max-w-xl mx-auto bg-gray-900 rounded-lg border-2 border-gray-600 flex items-center justify-center" >
                <button id="prev-preview-page" class= "absolute left-2 top-1/2 transform -translate-y-1/2 text-white bg-gray-800 bg-opacity-50 rounded-full p-2 hover:bg-gray-700 disabled:opacity-50 z-10" > <i data-lucide="chevron-left" > </i></button >
            <canvas id="posterize-preview-canvas" class= "w-full h-auto rounded-md" > </canvas>
            <button id = "next-preview-page" class= "absolute right-2 top-1/2 transform -translate-y-1/2 text-white bg-gray-800 bg-opacity-50 rounded-full p-2 hover:bg-gray-700 disabled:opacity-50 z-10" > <i data-lucide="chevron-right" > </i></button >
            </div>
            </div>

            <div class= "p-4 bg-gray-900 border border-gray-700 rounded-lg" >
            <h3 class="text-lg font-semibold text-white mb-3" > 网格布局 </h3>
            <div class= "grid grid-cols-1 sm:grid-cols-2 gap-4" >
            <div>
            <label for= "posterize-rows" class= "block mb-2 text-sm font-medium text-gray-300" > 行数 </label>
                <input type = "number" id = "posterize-rows" value = "1" min = "1" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                    </div>
                    <div >
                    <label for= "posterize-cols" class= "block mb-2 text-sm font-medium text-gray-300" > 列数 </label>
                        <input type = "number" id = "posterize-cols" value = "2" min = "1" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                            </div>
                            </div>
                            </div>

                            <div class="p-4 bg-gray-900 border border-gray-700 rounded-lg" >
                                <h3 class="text-lg font-semibold text-white mb-3" > 输出页面设置 </h3>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" >
                                        <div>
                                        <label for= "output-page-size" class= "block mb-2 text-sm font-medium text-gray-300" > 页面大小 </label>
                                            <select id = "output-page-size" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                <option value="A4" selected > A4 </option>
                                                    <option value = "Letter" > Letter </option>
                                                        <option value = "Legal" > Legal </option>
                                                            <option value = "A3" > A3 </option>
                                                                <option value = "A5" > A5 </option>
                                                                    </select>
                                                                    </div>
                                                                    <div >
                                                                    <label for= "output-orientation" class= "block mb-2 text-sm font-medium text-gray-300" > 方向 </label>
                                                                        <select id = "output-orientation" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                            <option value="auto" selected > 自动(推荐) </option>
                                                                                <option value = "portrait" > 纵向 </option>
                                                                                    <option value = "landscape" > 横向 </option>
                                                                                        </select>
                                                                                        </div>
                                                                                        </div>
                                                                                        </div>

                                                                                        <div class="p-4 bg-gray-900 border border-gray-700 rounded-lg" >
                                                                                            <h3 class="text-lg font-semibold text-white mb-3" > 高级选项 </h3>
                                                                                                <div class="space-y-4" >
                                                                                                    <div>
                                                                                                    <label class="block mb-2 text-sm font-medium text-gray-300" > 内容缩放 </label>
                                                                                                        <div class="flex gap-4 p-2 rounded-lg bg-gray-800" >
                                                                                                            <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer has-[:checked]:bg-indigo-600" >
                                                                                                                <input type="radio" name = "scaling-mode" value = "fit" checked class="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500" >
                                                                                                                    <div>
                                                                                                                    <span class="font-semibold text-white" > 适应 </span>
                                                                                                                        <p class="text-xs text-gray-400" > 保留所有内容，可能添加边距。</p>
                                                                                                                            </div>
                                                                                                                            </label>
                                                                                                                            <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer has-[:checked]:bg-indigo-600" >
                                                                                                                                <input type="radio" name = "scaling-mode" value = "fill" class="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500" >
                                                                                                                                    <div>
                                                                                                                                    <span class="font-semibold text-white" > 填充(裁剪) </span>
                                                                                                                                        <p class="text-xs text-gray-400" > 填满页面，可能裁剪内容。</p>
                                                                                                                                            </div>
                                                                                                                                            </label>
                                                                                                                                            </div>
                                                                                                                                            </div>
                                                                                                                                            <div >
                                                                                                                                            <label for= "overlap" class= "block mb-2 text-sm font-medium text-gray-300" > 重叠(用于组装)</label>
                                                                                                                                                <div class="flex items-center gap-2" >
                                                                                                                                                    <input type="number" id = "overlap" value = "0" min = "0" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                                                                                                        <select id="overlap-units" class="bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" >
                                                                                                                                                            <option value="pt" > 点 </option>
                                                                                                                                                                <option value = "in" > 英寸 </option>
                                                                                                                                                                    <option value = "mm" > 毫米 </option>
                                                                                                                                                                        </select>
                                                                                                                                                                        </div>
                                                                                                                                                                        </div>
                                                                                                                                                                        <div >
                                                                                                                                                                        <label for= "page-range" class= "block mb-2 text-sm font-medium text-gray-300" > 页面范围(可选) </label>
                                                                                                                                                                            <input type = "text" id = "page-range" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder = "例如：1-3, 5" >
                                                                                                                                                                                <p class="text-xs text-gray-400 mt-1" > 总页数: <span id="total-pages" > 0 < /span></p >
                                                                                                                                                                                    </div>
                                                                                                                                                                                    </div>
                                                                                                                                                                                    </div>

                                                                                                                                                                                    <button id = "process-btn" class="btn-gradient w-full mt-6" disabled > 海报化PDF </button>
                                                                                                                                                                                        </div>
                                                                                                                                                                                            `,

  'remove-blank-pages': () => `
                                                                                                                                                                                        <h2 class="text-2xl font-bold text-white mb-4" > 删除空白页 </h2>
                                                                                                                                                                                            <p class="mb-6 text-gray-400" > 自动检测并从PDF中删除空白或几乎空白的页面。调整敏感度以控制什么被认为“空白”。</p>
    ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>

    <div id = "remove-blank-options" class="hidden mt-6 space-y-4" >
        <div>
        <label for= "sensitivity-slider" class= "block mb-2 text-sm font-medium text-gray-300" >
            敏感度(<span id="sensitivity-value" > 99 </span>%)
            </label>
            <input type = "range" id = "sensitivity-slider" min = "80" max = "100" value = "99" class="w-full" >
                <p class="text-xs text-gray-400 mt-1" > 更高的敏感度要求页面更加“空白”才会被删除。</p>
                    </div>

                    <div id = "analysis-preview" class="hidden p-4 bg-gray-900 border border-gray-700 rounded-lg" >
                        <h3 class="text-lg font-semibold text-white mb-2" > 分析结果 </h3>
                            <p id = "analysis-text" class="text-gray-300" > </p>
                                <div id = "removed-pages-thumbnails" class="mt-4 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2" > </div>
                                    </div>

                                    <button id = "process-btn" class="btn-gradient w-full mt-6" > 删除空白页并下载 </button>
                                        </div>
                                            `,

  'alternate-merge': () => `
                                        <h2 class="text-2xl font-bold text-white mb-4" > 交替混合页面 </h2>
                                            <p class="mb-6 text-gray-400" > 将2个或更多文档的页面组合在一起，在它们之间交替。拖动文件来设置混合顺序（例如：文档A的第1页，文档B的第1页，文档A的第2页，文档B的第2页，等等）。</p>
    ${createFileInputHTML({ multiple: true, accept: 'application/pdf', showControls: true })}

<div id="alternate-merge-options" class="hidden mt-6" >
    <div class="p-3 bg-gray-900 rounded-lg border border-gray-700 mb-3" >
        <p class="text-sm text-gray-300" > <strong class="text-white" > 工作原理： </strong></p >
            <ul class="list-disc list-inside text-xs text-gray-400 mt-1 space-y-1" >
                <li>该工具将按照您在下面指定的顺序从每个文档中提取一页，然后重复此操作，直到使用完所有页面。</li>
                    <li > 如果某个文档的页面用完，它将被跳过，工具将继续与剩余文档交替。</li>
                        </ul>
                        </div>
                        <ul id = "alternate-file-list" class="space-y-2" > </ul>
                            <button id = "process-btn" class="btn-gradient w-full mt-6" disabled > 交替混合PDF </button>
                                </div>
                                    `,

  linearize: () => `
                                <h2 class="text-2xl font-bold text-white mb-4" > 线性化PDF(快速Web查看) </h2>
                                    <p class="mb-6 text-gray-400" > 优化多个PDF以实现更快的Web加载。文件将以ZIP压缩包下载。</p>
    ${createFileInputHTML({ multiple: true, accept: 'application/pdf', showControls: true })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="hidden btn-gradient w-full mt-6" disabled > 线性化PDF并下载ZIP </button>
        `,
  'add-attachments': () => `
        <h2 class="text-2xl font-bold text-white mb-4" > 向PDF添加附件 </h2>
            <p class="mb-6 text-gray-400" > 首先，上传您想要添加文件的PDF文档。</p>
    ${createFileInputHTML({ accept: 'application/pdf' })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>

    <div id = "attachment-options" class="hidden mt-8" >
        <h3 class="text-lg font-semibold text-white mb-3" > 上传要附加的文件 </h3>
            <p class="mb-4 text-gray-400" > 选择一个或多个文件嵌入到PDF中。您可以附加任何文件类型(图像、文档、电子表格等)。</p>

                <label for= "attachment-files-input" class= "w-full flex justify-center items-center px-6 py-10 bg-gray-900 text-gray-400 rounded-lg border-2 border-dashed border-gray-600 hover:bg-gray-800 hover:border-gray-500 cursor-pointer transition-colors" >
                    <div class= "text-center" >
                    <svg class= "mx-auto h-12 w-12" stroke = "currentColor" fill = "none" viewBox = "0 0 48 48" aria - hidden="true" > <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" stroke - width="2" stroke - linecap="round" stroke - linejoin="round" > </path></svg >
                        <span class="mt-2 block text-sm font-medium" > 点击上传文件 </span>
                            <span class="mt-1 block text-xs" > 任何文件类型，允许多个文件 </span>
                                </div>
                                <input id = "attachment-files-input" name = "attachment-files" type = "file" class="sr-only" multiple >
                                    </label>

                                    <div id = "attachment-file-list" class="mt-4 space-y-2" > </div>

                                        <div id = "attachment-level-options" class="hidden mt-6 space-y-4" >
                                            <div>
                                            <h3 class="text-lg font-semibold text-white mb-2" > 附件级别 </h3>
                                                <div class="flex gap-4 p-2 rounded-lg bg-gray-900" >
                                                    <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer" >
                                                        <input type="radio" name = "attachment-level" value = "document" checked class="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500" >
                                                            <div>
                                                            <span class="font-semibold text-white" > 文档级别 </span>
                                                                <p class="text-xs text-gray-400" > 附加到整个文档 </p>
                                                                    </div>
                                                                    </label>
                                                                    <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer" >
                                                                        <input type="radio" name = "attachment-level" value = "page" class="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500" >
                                                                            <div>
                                                                            <span class="font-semibold text-white" > 页面级别 </span>
                                                                                <p class="text-xs text-gray-400" > 附加到特定页面 </p>
                                                                                    </div>
                                                                                    </label>
                                                                                    </div>
                                                                                    </div>

                                                                                    <div id = "page-range-wrapper" class="hidden" >
                                                                                        <label for= "attachment-page-range" class= "block mb-2 text-sm font-medium text-gray-300" > 页面范围 </label>
                                                                                            <input type = "text" id = "attachment-page-range" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder = "例如，1-3, 5, 8" >
                                                                                                <p class="text-xs text-gray-400 mt-1" > 附件将添加到此范围内的每一页。总页数：<span id="attachment-total-pages" > </span></p >
                                                                                                    </div>
                                                                                                    </div>

                                                                                                    <button id = "process-btn" class="hidden btn-gradient w-full mt-6" disabled > 嵌入文件并下载 </button>
                                                                                                        </div>
                                                                                                            `,
  'extract-attachments': () => `
                                                                                                        <h2 class="text-2xl font-bold text-white mb-4" > 提取附件 </h2>
                                                                                                            <p class="mb-6 text-gray-400" > 从一个或多个PDF中提取所有嵌入文件。所有附件将下载到ZIP压缩包中。</p>
    ${createFileInputHTML({ multiple: true, accept: 'application/pdf', showControls: true })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <button id = "process-btn" class="btn-gradient w-full mt-6" > 提取附件 </button>
        `,
  'edit-attachments': () => `
        <h2 class="text-2xl font-bold text-white mb-4" > 编辑附件 </h2>
            <p class="mb-6 text-gray-400" > 查看、删除或替换PDF中的附件。</p>
    ${createFileInputHTML({ accept: 'application/pdf' })}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "edit-attachments-options" class="hidden mt-6" >
        <div id="attachments-list" class="space-y-3 mb-4" > </div>
            <button id = "process-btn" class="btn-gradient w-full mt-6" > 保存更改并下载 </button>
                </div>
                    `,

  'sanitize-pdf': () => `
                <h2 class="text-2xl font-bold text-white mb-4" > 清理PDF </h2>
                    <p class="mb-6 text-gray-400" > 在分享PDF之前，删除可能敏感或不必要的信息。选择您要删除的项目。</p>
    ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>

    <div id = "sanitize-pdf-options" class="hidden mt-6 space-y-4 p-4 bg-gray-900 border border-gray-700 rounded-lg" >
        <h3 class="text-lg font-semibold text-white mb-3" > 清理选项 </h3>
            <div >
            <strong class="font-semibold text-yellow-200" > 注意： </strong>
删除 <code class="bg-gray-700 px-1 rounded text-white" > 嵌入字体 </code> 可能会破坏文本渲染！文本可能无法正确显示或根本不显示。仅在您确定PDF查看器具有替代字体时使用。
    </div>
    <div class="mb-4" >
        <h4 class="text-sm font-semibold text-gray-400 mb-2" > 基本安全 </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" >
                <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer" >
                    <input type="checkbox" id = "flatten-forms" name = "sanitizeOption" value = "flatten-forms" checked class="w-5 h-5 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" >
                        <span class="text-white" > 平面化表单字段 </span>
                            </label>
                            <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer" >
                                <input type="checkbox" id = "remove-metadata" name = "sanitizeOption" value = "metadata" checked class="w-5 h-5 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" >
                                    <span class="text-white" > 删除所有元数据 </span>
                                        </label>
                                        <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer" >
                                            <input type="checkbox" id = "remove-annotations" name = "sanitizeOption" value = "annotations" checked class="w-5 h-5 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" >
                                                <span class="text-white" > 删除注释 </span>
                                                    </label>
                                                    <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer" >
                                                        <input type="checkbox" id = "remove-javascript" name = "sanitizeOption" value = "javascript" checked class="w-5 h-5 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" >
                                                            <span class="text-white" > 删除JavaScript </span>
                                                                </label>
                                                                <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer" >
                                                                    <input type="checkbox" id = "remove-embedded-files" name = "sanitizeOption" value = "embeddedFiles" checked class="w-5 h-5 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" >
                                                                        <span class="text-white" > 删除嵌入文件 </span>
                                                                            </label>
                                                                            <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer" >
                                                                                <input type="checkbox" id = "remove-layers" name = "sanitizeOption" value = "layers" checked class="w-5 h-5 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" >
                                                                                    <span class="text-white" > 删除图层(OCG) </span>
                                                                                        </label>
                                                                                        <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer" >
                                                                                            <input type="checkbox" id = "remove-links" name = "sanitizeOption" value = "links" checked class="w-5 h-5 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" >
                                                                                                <span class="text-white" > 删除外部链接 </span>
                                                                                                    </label>
                                                                                                    </div>
                                                                                                    </div>

                                                                                                    <div >
                                                                                                    <h4 class="text-sm font-semibold text-gray-400 mb-2" > 附加选项 </h4>
                                                                                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" >
                                                                                                            <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer" >
                                                                                                                <input type="checkbox" id = "remove-structure-tree" name = "sanitizeOption" value = "structure" class="w-5 h-5 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" >
                                                                                                                    <span class="text-white" > 删除结构树 </span>
                                                                                                                        </label>
                                                                                                                        <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer" >
                                                                                                                            <input type="checkbox" id = "remove-markinfo" name = "sanitizeOption" value = "markinfo" class="w-5 h-5 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" >
                                                                                                                                <span class="text-white" > 删除标记信息 </span>
                                                                                                                                    </label>
                                                                                                                                    <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer" >
                                                                                                                                        <input type="checkbox" id = "remove-fonts" name = "sanitizeOption" value = "fonts" class="w-5 h-5 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" >
                                                                                                                                            <span class="text-white text-sm" > 删除嵌入字体 </span>
                                                                                                                                                </label>
                                                                                                                                                </div>
                                                                                                                                                </div>

                                                                                                                                                <button id = "process-btn" class="btn-gradient w-full mt-6" > 清理PDF并下载 </button>
                                                                                                                                                    </div>
                                                                                                                                                        `,

  'remove-restrictions': () => `
                                                                                                                                                    <h2 class="text-2xl font-bold text-white mb-4" > 移除PDF限制 </h2>
                                                                                                                                                        <p class="mb-6 text-gray-400" > 移除安全限制并解锁PDF的编辑和打印权限。</p>
  ${createFileInputHTML()}
<div id="file-display-area" class="mt-4 space-y-2" > </div>
    <div id = "remove-restrictions-options" class="hidden space-y-4 mt-6" >
        <div class="p-4 bg-blue-900/20 border border-blue-500/30 text-blue-200 rounded-lg" >
            <h3 class="font-semibold text-base mb-2" > 工作原理 </h3>
                <p class="text-sm text-gray-300 mb-2" > 此操作将： </p>
                    <ul class="text-sm text-gray-300 list-disc list-inside space-y-1 ml-2" >
                        <li>移除所有权限限制(打印、复制、编辑) </li>
                            <li > 即使文件已加密也会移除加密 </li>
                                <li > 移除与数字签名PDF文件相关的安全限制(将使签名无效) </li>
                                    <li > 创建完全可编辑、无限制的PDF </li>
                                        </ul>
                                        </div>

                                        <div >
                                        <label for= "owner-password-remove" class= "block mb-2 text-sm font-medium text-gray-300" > 所有者密码(如需要)</label>
                                            <input type = "password" id = "owner-password-remove" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder = "如果PDF没有密码则留空" >
                                                <p class="text-xs text-gray-500 mt-1" > 如果PDF受密码保护，请输入所有者密码 </p>
                                                    </div>

                                                    <div class="p-4 bg-red-900/20 border border-red-500/30 text-red-200 rounded-lg" >
                                                        <h3 class="font-semibold text-base mb-2" > 注意事项 </h3>
                                                            <p class="text-sm text-gray-300 mb-2" > 此工具仅用于合法目的，例如： </p>
                                                                <ul class="text-sm text-gray-300 list-disc list-inside space-y-1 ml-2" >
                                                                    <li>从您拥有或有权修改的PDF中移除限制 </li>
                                                                        <li > 当您合法忘记密码时恢复对PDF的访问 </li>
                                                                            <li > 访问您合法购买或创建的内容 </li>
                                                                                <li > 为授权的业务目的编辑文档 </li>
                                                                                    <li > 为合法的存档、合规或恢复工作流程打开文档 </li>
                                                                                        <li class="font-semibold" > 限制：此工具只能移除弱保护PDF或未设置所有者密码的PDF的限制。它无法移除或绕过正确应用的AES-256(256位)加密。</li>
                                                                                            </ul>
                                                                                            <p class="text-sm text-gray-300 mt-3 font-semibold" >
                                                                                                使用此工具绕过版权保护、侵犯知识产权或未经授权访问文档在您的司法管辖区可能是非法的。我们对此工具的任何滥用不承担责任——如果您不确定，请在继续之前咨询法律顾问或文档所有者。
                                                                                                    </p>
                                                                                                    </div>
                                                                                                    <button id = "process-btn" class="btn-gradient w-full mt-6" > 移除限制并下载 </button>
                                                                                                        </div>
                                                                                                            `,
};
