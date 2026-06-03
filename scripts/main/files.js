import { updateMessagesBottomHeight, publishMessage } from '/scripts/main/main.js';
import { tokenManager } from "/scripts/token-manager.js";
import { refreshTokenWeb } from "/scripts/api-client.js";

export {
    removeFileFully,
    fileQueueArray,
    addToQueue,
    uploadFiles,
    removeFileDesign,
    clearFileQueueArray
}

const fileInput = document.querySelector('.file-input')
const fileClip = document.querySelector('.file-clip')
const fileQueue = document.querySelector('.file-queue')
let fileQueueArray = [];
let isUploading = false;


const dropZone = document.querySelector('.messenger');
const dropBackground = document.querySelector('.drop-background'); 
const messageInput = document.querySelector('.message-input');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
});

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('drag-over');
        dropBackground.classList.add('drag-over');
    });
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('drag-over');
        dropBackground.classList.remove('drag-over');
    });
});

dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        Array.from(files).forEach(file => addToQueue(file, 'toSend'));
    }
});

messageInput.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    let hasFiles = false;

    for (const item of items) {
        if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
                addToQueue(file, 'toSend');
                hasFiles = true;
            }
        }
    }

    if (hasFiles) {
        e.preventDefault();
    }
});


fileClip.addEventListener('click', () => {
    fileInput.click()
})

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        Array.from(e.target.files).forEach(file => {
            addToQueue(file, 'toSend');
        });
        fileInput.value = '';
    }
});

function clearFileQueueArray() {
    fileQueueArray = []
}

function filesNameData(fileObj) {
    const lastDotIndex = fileObj.name.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === 0) {
        return { name: fileObj.name, ext: '' };
    }
    const name = fileObj.name.substring(0, lastDotIndex);
    const ext = fileObj.name.substring(lastDotIndex + 1);
    return [name, ext]
}

function addToQueue(file, type, messageElement = null) {
    const fileData = filesNameData(file)
    const ext = fileData[1]

    const archives = ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "arj", "z", "iso", "cab"]
    const documents  = ["txt", "doc", "docx", "pages", "pdf", "xls", "xlsx", "numbers", "ppt", "pptx", "key", "odt", "ods", "odp", "rtf", "md", "tex", "csv"]
    const installers = ["exe", "msi", "pkg", "deb", "rpm", "appimage", "sh", "bin", "run"]
    const driveImages = ["iso", "img", "dmg", "bin", "cue", "nrg", "mdf", "mds", "vhd", "vhdx", "vmdk", "vdi", "udf", "ccd", "flp", "raw"]
    const code = ["py", "java", "c", "cpp", "h", "hpp", "cs", "js", "ts", "php", "rb", "go", "rs", "swift", "kt", "pl", "lua", "r", "scala", "groovy", "ini", "json", "css", "html"]
    const audios = ["mp3", "aac", "flac", "wav", "ogg", "m4a", "wma", "aiff", "alac", "opus"]
    const videos = ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm", "m4v", "mpeg", "mpg", "3gp", "ogv", "ts", "vob", "rmvb"]
    const images = ["jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp", "svg", "ico", "heic", "heif", "raw", "jfif", "jpe", "pbm"]

    const isMedia = (file.type.startsWith('image/') && file.type !== 'image/heic');
    let previewSrc = '/imgs/file.svg';

    if (archives.includes(ext))
        previewSrc = '/imgs/archiveFile.svg'
    else if (documents.includes(ext))
        previewSrc = '/imgs/documentFile.svg'
    else if (installers.includes(ext))
        previewSrc = '/imgs/installerFile.svg'
    else if (code.includes(ext))
        previewSrc = '/imgs/codeFile.svg'
    else if (audios.includes(ext))
        previewSrc = '/imgs/audioFile.svg'
    else if (driveImages.includes(ext))
        previewSrc = '/imgs/driveFile.svg'
    else if (videos.includes(ext))
        previewSrc = '/imgs/videoFile.svg'
    else if (images.includes(ext))
        previewSrc = '/imgs/imgFile.svg'

    if (type === 'toSend') {
        if (file.type.startsWith('image/') && file.type !== 'image/heic') {
            previewSrc = URL.createObjectURL(file);
        }
    } else {
        if (file.thumb_key && !file.type.startsWith('video/') && file.type !== 'image/heic' ) {
            previewSrc = filePHP + '?key=' + file.thumb_key.substring(6);
        }
    }

    let id = null
    if (type === 'toSend')
        id = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    else
        id = file.id

    const fileObj = {
        id: id,
        file: file,
        name: file.name,
        type: file.type,
        key: file.key,
        thumb_key: file.thumb_key || null,
        isMedia: isMedia,
        previewSrc: previewSrc,
        status: 'pending',
        progress: 0,
        serverData: null
    };

    if (type === 'toSend') {
        fileQueueArray.push(fileObj);
        renderFileItem(fileObj);
        updateBottom();
        updateMessagesBottomHeight()
    } else {
        messageFileRender(fileObj, messageElement);
    }
}
function messageFileRender(fileObj, messageElement) {
    const item = document.createElement('div');
    item.className = 'message-files-item';
    item.id = fileObj.id;
    item.dataset.isImage = fileObj.type.startsWith('image/') && fileObj.type !== 'image/heic' ? '1' : '0';
    item.dataset.isLoaded = '0';

    const fileData = filesNameData(fileObj)
    const name = fileData[0]
    const ext = fileData[1]

    if (!fileObj.previewSrc.includes('imgs') || fileObj.type === 'image/heic') {
        item.innerHTML = `
                <div class="message-file-preview" style="background: none; border: none;">
                    <div class="message-file-icon" style="width: 100%">
                        <img class="message-file-icon-img" src="${fileObj.previewSrc}" style="border-radius: 10px;">
                    </div>
                </div>
                <div class="message-file-name" title="${name}">${name}</div>
            `;


        item.querySelector('.message-file-icon-img').addEventListener('load', () => {
            item.dataset.isImage = fileObj.type.startsWith('image/') && fileObj.type !== 'image/heic' ? '1' : '0';
            item.dataset.isLoaded = '1';
        });
    } else {
        item.innerHTML = `
                <div class="message-file-preview">
                    <div class="message-file-icon">
                        <img class="message-file-icon-img" src="${fileObj.previewSrc}">
                        <div class="message-file-icon-background">
                            <div class="message-file-icon-extension">${ext}</div> 
                        </div>
                    </div>
                    <div class="message-file-preview-background"></div>
                </div>
                <div class="message-file-name" title="${name}">${name}</div>
            `;
    }

    const el = messageElement.querySelector('.message-files-queue').appendChild(item);
    if (typeof fileObj.key !== 'undefined' && fileObj.key !== 'null')
        el.addEventListener('click', () => downloadFile(fileObj.key, fileObj.name));
}

function renderFileItem(fileObj) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.id = fileObj.id;

    const fileData = filesNameData(fileObj)
    const name = fileData[0]
    const ext = fileData[1]

    if (!fileObj.previewSrc.includes('imgs') || fileObj.type === 'image/heic') {
        item.innerHTML = `
                    <button class="remove-btn">
                        <img height="12" width="12" src="../imgs/cross.svg" style="cursor: pointer">
                    </button>
                    <div class="file-preview" style="background: none; border: none;">
                        <div class="file-icon" style="width: 100%">
                            <img class="file-icon-img" src="${fileObj.previewSrc}" style="border-radius: 10px;">
                        </div>
                    </div>
                    <div class="file-name" title="${name}">${name}</div>
                `;
    } else {
        item.innerHTML = `
                <button class="remove-btn">
                    <img height="12" width="12" src="../imgs/cross.svg" style="cursor: pointer">
                </button>
                <div class="file-preview">
                    <div class="file-icon">
                        <img class="file-icon-img" src="${fileObj.previewSrc}">
                        <div class="file-icon-background">
                            <div class="file-icon-extension">${ext}</div> 
                        </div>
                    </div>
                    <div class="file-preview-background"></div>
                </div>
                <div class="file-name" title="${name}">${name}</div>
            `;
    }
    item.addEventListener('click', () => {
        removeFileFully(fileObj.id)
    })
    item.style.animation = 'fileAppear 0.3s forwards';
    fileQueue.appendChild(item);
}

function removeFileFully(id) {
    if (isUploading) return;

    const index = fileQueueArray.findIndex(f => f.id === id);
    if (index !== -1) {
        const fileObj = fileQueueArray[index];
        if (fileObj.isMedia && fileObj.previewSrc.startsWith('blob:')) {
            URL.revokeObjectURL(fileObj.previewSrc);
        }
        fileQueueArray.splice(index, 1);

        const item = document.getElementById(id);
        if (item) {
            item.style.animation = 'fileExpire 0.3s forwards';
            setTimeout(() => {
                item.remove()
                updateBottom()
            }, 150)
        }
    }
}

function removeFileDesign(id) {
    const index = fileQueueArray.findIndex(f => f.id === id);
    if (index !== -1) {
        const fileObj = fileQueueArray[index];
        const item = document.getElementById(id);
        if (item) {
            item.style.animation = 'fileExpire 0.3s forwards';
            setTimeout(() => {
                updateBottom()
                item.remove()
            }, 150)
        }
    }
}

function updateBottom() {
    const pendingFiles = fileQueueArray.filter(f => f.status === 'pending').length;
    const sendMessage = document.querySelector(".message-send")
    sendMessage.disabled = !(fileQueueArray.length > 0)
    if (pendingFiles === 0) {
        setTimeout(() => {
            updateMessagesBottomHeight()
        }, 150)
    }
}

async function uploadFiles(message, tempId) {
    const pendingFiles = fileQueueArray.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    updateBottom()
    isUploading = true;

    message.files = []

    for (const fileObj of pendingFiles) {
        const result = await uploadFile(fileObj, tempId);
        if (result.success) {
            message.files.push([result.data.file_id, JSON.stringify(result.fileObj)])
        } else {
            isUploading = false;
            return
        }
    }

    isUploading = false;

    publishMessage(message, tempId)
}

function uploadError(temp) {
    const fileItem = temp.querySelector(`.message-files-item`);
    fileItem.dataset.isLoaded = '0'
    const filePreview = temp.querySelector(`.message-file-preview`);
    filePreview.classList.add('loadedError')
}

async function uploadFile(fileObj, tempId) {
    const isNative = window.Capacitor?.isNativePlatform?.() === true;
    if (!isNative) {
        await refreshTokenWeb();
    }
    return new Promise(async (resolve) => {
        const temp = document.querySelector(`[data-message-id="${tempId}"]`);
        const fileItem = temp?.querySelector(`.message-files-item`);
        if (!temp || !fileItem) {
            resolve({ success: false, error: 'Message element not found' });
            return;
        }

        const progressFill = temp.querySelector(`.message-file-preview-background`);
        fileObj.status = 'uploading';
        fileItem.dataset.send = '1';

        const formData = new FormData();
        formData.append('file', fileObj.file);
        formData.append('compress', '0');

        const xhr = new XMLHttpRequest();

        xhr.withCredentials = !isNative;

        let accessToken = null;
        if (isNative) {
            accessToken = await getValidAccessToken();
            if (!accessToken) {
                fileObj.status = 'error';
                console.error('[Upload] No valid access token for Capacitor');
                resolve({ success: false, error: 'No valid access token' });
                return;
            }
        }

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = e.loaded / e.total;
                if (progressFill) {
                    progressFill.style.height = ((percent * 70) + 30) + '%';
                    progressFill.style.background = `rgba(136, 136, 136, ${(1 - (percent * 0.85)) * 0.9})`;
                    progressFill.style.boxShadow = `0px 0px 15.5px 5px rgba(255, 255, 255, ${(1 - (percent * 0.95)) * 0.5})`;
                }
                fileObj.progress = percent;
            }
        });

        xhr.addEventListener('load', async () => {
            const data = JSON.parse(xhr.responseText);
            if (typeof data['authenticated'] === 'undefined') {
                try {
                    if (data.success) {
                        fileItem.dataset.isLoaded = '1';
                        const filePreview = temp.querySelector(`.message-file-preview`);
                        if (filePreview) filePreview.classList.add('loaded');
                        fileObj.key = data.file_key;
                        fileObj.thumb_key = data.thumb_key;
                        fileObj.mime_type = data.mime_type;
                        fileObj.status = 'success';
                        fileObj.serverData = data;
                        setTimeout(() => createLink(data, temp), 500);
                        resolve({ success: true, data: data, fileObj: fileObj });
                    } else {
                        uploadError(temp);
                        fileObj.status = 'error';
                        console.error('[Upload] Server error:', data.error);
                        resolve({ success: false, error: data.error || 'Unknown server error' });
                    }
                } catch (err) {
                    uploadError(temp);
                    fileObj.status = 'error';
                    console.error('[Upload] JSON parse error:', err);
                    resolve({ success: false, error: 'Invalid server response' });
                }
            } else if (data['authenticated'] === false) {
                console.warn('[Upload] 401 Unauthorized, trying to refresh token');
                if (isNative) {
                    try {
                        const { default: apiRequest } = await import('/scripts/api-client.js');
                        await apiRequest(isLoggedPHP, {});
                        const newToken = await tokenManager.getAccessToken();
                        if (newToken) {
                            const retryResult = await retryUpload(fileObj, tempId, newToken);
                            resolve(retryResult);
                            return;
                        }
                    } catch (refreshErr) {
                        console.error('[Upload] Token refresh failed', refreshErr);
                    }
                } else {
                    await refreshTokenWeb();
                    const retryResult = await retryUpload(fileObj, tempId, null);
                    resolve(retryResult);
                    return;
                }
                uploadError(temp);
                fileObj.status = 'error';
                resolve({ success: false, error: 'Authentication failed' });
            } else {
                uploadError(temp);
                fileObj.status = 'error';
                console.error('[Upload] HTTP error:', xhr.status, xhr.statusText);
                resolve({ success: false, error: `HTTP ${xhr.status}: ${xhr.statusText}` });
            }
        });

        xhr.addEventListener('error', () => {
            uploadError(temp);
            fileObj.status = 'error';
            console.error('[Upload] Network error');
            resolve({ success: false, error: 'Network error' });
        });

        xhr.addEventListener('abort', () => {
            fileObj.status = 'error';
            resolve({ success: false, error: 'Aborted' });
        });

        xhr.open('POST', uploadPHP);
        if (isNative && accessToken) {
            xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        }
        xhr.send(formData);
    });
}

async function retryUpload(fileObj, tempId, newToken) {
    return new Promise((resolve) => {
        const temp = document.querySelector(`[data-message-id="${tempId}"]`);
        if (!temp) {
            resolve({ success: false, error: 'Message element lost' });
            return;
        }
        const fileItem = temp.querySelector(`.message-files-item`);
        const progressFill = temp.querySelector(`.message-file-preview-background`);

        const formData = new FormData();
        formData.append('file', fileObj.file);
        formData.append('compress', '0');

        const xhr = new XMLHttpRequest();
        xhr.withCredentials = false;

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && progressFill) {
                const percent = e.loaded / e.total;
                progressFill.style.height = ((percent * 70) + 30) + '%';
                progressFill.style.background = `rgba(136, 136, 136, ${(1 - (percent * 0.85)) * 0.9})`;
                progressFill.style.boxShadow = `0px 0px 15.5px 5px rgba(255, 255, 255, ${(1 - (percent * 0.95)) * 0.5})`;
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (data.success) {
                        if (fileItem) fileItem.dataset.isLoaded = '1';
                        const filePreview = temp.querySelector(`.message-file-preview`);
                        if (filePreview) filePreview.classList.add('loaded');
                        fileObj.key = data.file_key;
                        fileObj.thumb_key = data.thumb_key;
                        fileObj.mime_type = data.mime_type;
                        fileObj.status = 'success';
                        fileObj.serverData = data;
                        setTimeout(() => createLink(data, temp), 500);
                        resolve({ success: true, data: data, fileObj: fileObj });
                    } else {
                        uploadError(temp);
                        resolve({ success: false, error: data.error || 'Upload failed' });
                    }
                } catch (err) {
                    uploadError(temp);
                    resolve({ success: false, error: 'Invalid response' });
                }
            } else {
                uploadError(temp);
                resolve({ success: false, error: `HTTP ${xhr.status}` });
            }
        });

        xhr.addEventListener('error', () => {
            uploadError(temp);
            resolve({ success: false, error: 'Network error' });
        });

        xhr.open('POST', uploadPHP);
        if (newToken) {
            xhr.setRequestHeader('Authorization', `Bearer ${newToken}`);
        }
        xhr.send(formData);
    });
}

async function getValidAccessToken() {
    const isNative = window.Capacitor?.isNativePlatform?.() === true;
    if (!isNative) return null;

    let token = await tokenManager.getAccessToken();
    if (token && token !== 'undefined') return token;

    try {
        const { default: apiRequest } = await import('/scripts/api-client.js');
        await apiRequest(isLoggedPHP, {});
        token = await tokenManager.getAccessToken();
        return token;
    } catch (err) {
        console.error('Failed to refresh token for file upload');
        return null;
    }
}

function createLink(data, temp) {
    const isMedia = data.mime_type.startsWith('image/') && data.mime_type !== 'image/heic';
    const thumbSrc = (data.thumb_key && isMedia) ? `${filePHP}?key=${data.thumb_key}` : '';
    const preview = temp.querySelector('.message-file-preview');

    if (isMedia && preview) {
        const el = document.createElement('img');
        el.src = thumbSrc;
        el.className = 'success-thumb';
        el.dataset.fileKey = data.file_key;
        el.dataset.mime = data.mime_type;

        console.log(temp)
        temp.querySelector('.message-files-item').dataset.isImage = '1';
        preview.addEventListener('click', () => downloadFile(data.file_key, preview.dataset.fileName));
        preview.innerHTML = '';
        preview.appendChild(el);
        preview.classList.add('loaded');
    } else if (preview) {
        // Не медиа-файлы (архивы, документы и т.д.)
        preview.dataset.fileKey = data.file_key;
        preview.dataset.mime = data.mime_type;
        preview.addEventListener('click', () => downloadFile(preview.dataset.fileKey, preview.dataset.fileName));
    }
}

function downloadFile(key, fileName) {
    const downloadUrl = `${filePHP}?key=${key}&download=1`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
