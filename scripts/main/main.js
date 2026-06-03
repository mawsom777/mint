import { apiRequest } from '/scripts/api-client.js';
import { fileQueueArray, addToQueue, uploadFiles, removeFileDesign, clearFileQueueArray } from '/scripts/main/files.js';
import { userOnline } from '/scripts/main/online-heartbeat.js'
import { handleIncomingCall } from '/scripts/main/calling.js'
import { webrtcClient } from "/scripts/main/webrtc-client.js";
import { tokenManager } from '/scripts/token-manager.js';
import { showAuthScreen } from '/scripts/spa-router.js';

export {
    chatsUI,
    messages,
    openedChat,
    escapeHtml,
    linkifyUrls,
    generateAvatar,
    addChat,
    updateMessagesBottomHeight,
    viewObserver,
    publishMessage,
    openChatFromUrl,
    changeOpenedChat,
    MobileNavigation,
    connectSSE,
    performSearch
}

let openedChat = -1
let eventSource = null
let reconnectAttempts = 0
const maxReconnectAttempts = 10
window.currentChatType = 'personal'
let editingMessageId = null;
let originalMessageContent = '';
let editPanel = null;
let editPanelText = null;

const sendMessage = document.querySelector(".message-send")
sendMessage.addEventListener('click', () => {
    send()
})

const inp = document.querySelector(".message-input")
inp.addEventListener('input', () => {
    filled();
    autoResizeTextarea();
})
inp.addEventListener('paste', () => setTimeout(autoResizeTextarea, 0));
inp.addEventListener('keydown', keys)

let messages = []
let dbPackage = []
let newChat = false
let lastDate

let createMenu = null;
let searchInput = null;
let toggleSearchButton = null;
let searchResults = null;
let currentSearchMode = 'name';
let searchDebounceTimer = null;
const SEARCH_DEBOUNCE_DELAY = 300;
let activeSearchRequest = null;

let sseController = null;
let sseRetryTimeout = null;
let sseReconnectAttempts = 0;
const SSE_MAX_RETRIES = 10;

function filled() {
    const hasText = inp.value.trim().length > 0;
    const hasFiles = fileQueueArray.length > 0;
    const isEditing = editingMessageId !== null;
    sendMessage.disabled = !(hasText || hasFiles);
    if (isEditing) {
        sendMessage.disabled = false;
    }
}

function keys(e) {
    if (MobileNavigation.isMobile) {
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            if (!sendMessage.disabled) send();
        }
    } else {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendMessage.disabled) send();
        }
    }
}

function changeOpenedChat(value) {
    openedChat = value
}

function generateAvatar(name) {
    return name[0].toUpperCase()
}

async function markMessageAsViewed(messageId) {
    try {
        const beenRead = await apiRequest(beenReadPHP, {chat_id: openedChat, message_id: messageId})

        if (beenRead['response'].status !== 200)
            console.log('Не смог пометить как прочитанное')

    } catch (error) {
        console.error('Не смог пометить как прочитанное');
    }

    dbPackage.push(messageId)
}

function initCreateMenu() {
    createMenu = document.querySelector('.create-menu');
    searchInput = document.querySelector('.search-input');
    toggleSearchButton = document.querySelector('.toggle-search');
    searchResults = document.querySelector('.search-results');

    if (!createMenu || !searchInput || !toggleSearchButton || !searchResults) {
        console.error('Не удалось найти элементы меню создания чата');
        return;
    }

    toggleSearchButton.addEventListener('click', toggleSearchMode);
    searchInput.addEventListener('input', handleSearchInput);

    document.addEventListener('click', handleClickOutside);
}

function hideCreateMenu() {
    if (!createMenu) return;
    hideSearchResults();
}

function toggleSearchMode() {
    currentSearchMode = currentSearchMode === 'name' ? 'phone' : 'name';
    searchInput.placeholder = currentSearchMode === 'name' ? "Имя пользователя" : "Телефон";
    searchInput.value = '';
    hideSearchResults();
    updateToggleSearchIcon();

    searchInput.focus();
}

function updateToggleSearchIcon() {
    if (!toggleSearchButton) return;

    const icon = toggleSearchButton.querySelector('.switch-img');
    if (icon) {
        icon.alt = currentSearchMode === 'name' ? 'Искать по телефону' : 'Искать по имени';
    }
}

function handleSearchInput(event) {
    const query = event.target.value.trim();

    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }

    if (!query) {
        hideSearchResults();
        return;
    }

    searchDebounceTimer = setTimeout(() => {
        performSearch(query);
    }, SEARCH_DEBOUNCE_DELAY);
}

async function performSearch(query) {
    if (activeSearchRequest) {
        activeSearchRequest.abort();
    }

    try {
        const controller = new AbortController();
        activeSearchRequest = controller;

        const params = new URLSearchParams({
            query: query.replace('@', ''),
            mode: (searchInput.value.includes('@')) ? 'username' : currentSearchMode
        });

        const searchUsers = await apiRequest(`${searchUsersPHP}?${params}`)

        if (!searchUsers['response'].ok) {
            throw new Error(`Проблема с поиском. Статус: ${searchUsers['response']}`);
        }

        const users = searchUsers['data']
        if (users.error) {
            throw new Error(users.error)
        }

        displaySearchResults(users)
        activeSearchRequest = null

    } catch (error) {
        if (error.name === 'AbortError') {
            return;
        }

        console.error('Ошибка при поиске пользователей:', error);
        displaySearchResults([]);
        if (searchResults) {
            searchResults.innerHTML = `<div class="search-result">Ой! Произошла ошибка</div>`;
        }
    }
}

function displaySearchResults(users) {
    if (!searchResults) return;
    const colours = [
        '--avatar-gradient-gray',
        '--avatar-gradient-blue',
        '--avatar-gradient-green',
        '--avatar-gradient-purple',
    ]

    if (users.length === 0) {
        searchResults.innerHTML = '<div class="search-result">Ничего не найдено</div>';
    } else {
        searchResults.innerHTML = users.map(user => `
            <div class="search-result" data-chat-id="${user.chat_id}" data-user-id="${user.id}" data-user-name="${user.name}" data-user-phone="${user.phone || ''}" data-online="${user.is_online || 0}" data-url="${user.avatar_url}" data-type="${user.type}">
                <div class="search-result-row">
                    <div class="search-result-avatar">
                        ${colours.includes(user.avatar_url) ? `<div class="header-avatar-img" style="background: var(${user.avatar_url})"> ${generateAvatar(user.name)} </div>` : `<div class="header-avatar-img" style="background-image: url('${user.avatar_url.replace(/'/g, "\\'")}');"></div>`}
                        ${user.is_online ? `<div class="search-result-online"></div>` : ''}
                    </div>
                    <div class="search-result-name">${user.name}</div>
                </div>
                ${user.phone ? `<div class="search-result-phone">${user.phone}</div>` : ''}
            </div>
        `).join('');

        const resultItems = searchResults.querySelectorAll('.search-result[data-user-id]')
        resultItems.forEach(item => {
            item.addEventListener('click', handleResultClick);
        })
    }

    searchResults.classList.add('show');
}

function hideSearchResults() {
    if (!searchResults) return;

    searchResults.classList.remove('active');

    searchResults.classList.remove('show');
}

function handleResultClick(event) {
    const resultItem = event.currentTarget
    const chatId = typeof resultItem.dataset.chatId === 'undefined' ? -1 : +resultItem.dataset.chatId
    const userId = +resultItem.dataset.userId
    const userName = resultItem.dataset.userName
    const online = +resultItem.dataset.online
    const url = resultItem.dataset.url
    const type = resultItem.dataset.type
    openedChat = chatId !== null ? chatId : -1

    document.querySelector('.messages-bottom').style = "display: flex;"
    document.querySelector('.messages-header').style = "display: flex;"

    creatingMessages({accountId: userId, chatId: chatId, name: userName, online: online, url: url, type: type, newChat: chatId === -1})

    const chat = {accountId: userId, chatId: chatId, name: userName, online: online, url: url, lastMessage: '', sentAt: []}
    chats.push(chat)
    addChat(chat, false)

    if (MobileNavigation.isMobile) {
        MobileNavigation.switchToMessages();
    }

    hideCreateMenu();
}

function handleClickOutside(event) {
    if (!createMenu || createMenu.style.display === 'none') return;

    const target = event.target;
    const isClickInsideMenu = createMenu.contains(target);
    const isClickOnCreateChatButton = target.closest('.chat-item') &&
        target.closest('.chat-item').querySelector('.chat-name')?.textContent === 'Создать чат';

    if (!isClickInsideMenu && !isClickOnCreateChatButton) {
        hideCreateMenu()
    }
}

function autoResizeTextarea() {
    const textarea = document.querySelector('.message-input');
    const maxHeight = 130;

    if (textarea.style.height !== '')
        textarea.style.height = 'auto';
    else
        textarea.style.height = '50px'
    
    const newHeight = Math.min(textarea.scrollHeight - 6, maxHeight);
    textarea.style.height = newHeight + 'px';

    if (textarea.scrollHeight > maxHeight) {
        textarea.style.overflowY = 'auto';
    } else {
        textarea.style.overflowY = 'hidden';
    }

    updateMessagesBottomHeight()
}

function updateMessagesBottomHeight() {
    const textarea = document.querySelector('.message-input');
    const messagesBottom = document.querySelector('.messages-bottom');
    const messagesList = document.getElementById('messagesList');
    const fileQueue = document.querySelector('.file-queue');
    const editPanel = document.querySelector('.edit-message-panel');
    const maxHeight = 140;

    if (!messagesBottom || !messagesList) return;

    let totalHeight = Math.min(textarea.scrollHeight + 10, maxHeight);

    if (fileQueue && fileQueue.children.length > 0) {
        totalHeight += 135;
    }

    if (editPanel && editPanel.style.display === 'flex') {
        totalHeight += editPanel.offsetHeight;
    }

    const minHeight = 70;
    const newHeight = Math.max(minHeight, totalHeight) + document.querySelector('.edit-message-text').scrollHeight;

    messagesBottom.style.minHeight = newHeight + 'px';
    messagesList.style.paddingBottom = (newHeight + 10) + 'px';
    messagesList.scrollTop = messagesList.scrollHeight;
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function linkifyUrls(text) {
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    return text.replace(urlRegex, function(url) {
        const safeUrl = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}

function addingMessage(message, updateChatList = true, animation = true) {
    const dateElement = document.createElement('div');
    const chatCreatedElement = document.createElement('div');
    const messageElement = document.createElement('div');
    const messagesList = document.getElementById('messagesList');
    messageElement.className = message.sender === -1 ? 'message-item self' : 'message-item alien';
    if (message.id.toString().includes('temp_')) {
        messageElement.classList.add('temp');
    }

    messageElement.dataset.messageId = message.id;

    if (lastDate !== message.sentAt[0] && message.sentAt[0] !== '') {
        dateElement.className = 'messages-date';
        dateElement.innerHTML = message.sentAt[0].charAt(0) === '0' ? message.sentAt[0].substring(1, message.sentAt[0].length): message.sentAt[0]
        lastDate = message.sentAt[0]
        messagesList.insertBefore(dateElement, messagesList.firstElementChild)
    }
    if (message.technical) {
        chatCreatedElement.className = 'messages-chat-created';
        chatCreatedElement.innerHTML = message.content
        messagesList.insertBefore(chatCreatedElement, messagesList.firstElementChild)
        return
    }

    let senderBlock = '';
    if (message.sender !== -1 && window.currentChatType && window.currentChatType !== 'personal' && window.currentChatType !== 'channel') {
        const colours = [
            '--avatar-gradient-gray',
            '--avatar-gradient-blue',
            '--avatar-gradient-green',
            '--avatar-gradient-purple',
        ];

        const avatarStyle = colours.includes(message.sender_avatar) ? `background: var(${message.sender_avatar})` : `background-image: url('${message.sender_avatar}')`
        senderBlock = `
            <div class="message-sender-info">
                <div class="message-sender-avatar" style="${avatarStyle}">${colours.includes(message.sender_avatar) ? (message.sender_name || '?')[0].toUpperCase() : ''}</div>
                <span class="message-sender-name">${message.sender_name || 'Участник'}</span>
            </div>`;
    }

    const escapedContent = escapeHtml(message.content).replace(/\n/g, '<br>');
    const linkedContent = linkifyUrls(escapedContent);

    messageElement.innerHTML = `
    ${senderBlock}
    ${message.files === null || message.files.length === 0 ? '' : '<div class="message-files-background"> <div class="message-files-queue"></div> </div>'}
    <div class="message-text-background">
        <div class="message-content">${linkedContent}</div>
        <div class="message-info ${message.sender === -1 ? 'self' : 'alien'}">
            <div class="message-time">${message.sentAt[1]}</div>
            ${message.sender === -1 ? '<div class="is-read-message"></div>' : ''}
        </div>
    </div>
    `

    if (message.files !== null) {
        if (message.files.length !== 0 && message.files[0] !== null) {
            messageElement.querySelector('.message-text-background').style.borderRadius = '0 0 25px 25px'
            message.files.forEach(file => {
                const fileObj = {
                    id: file['id'],
                    name: file['name'],
                    type: file['type'],
                    key: file['key'],
                    thumb_key: file['thumb_key'] || null
                };
                addToQueue(fileObj, 'message', messageElement)
            })

            const filesQueue = messageElement.querySelector('.message-files-queue');
            if (filesQueue) {
                const items = filesQueue.querySelectorAll('.message-files-item');
                const allImages = items.length > 0 && Array.from(items).every(item => item.dataset.isImage === '1');

                if (allImages) {
                    setTimeout(() => {
                        const longTimeout = function() {
                            // const sending = Array.from(items).some(item => item.dataset.send === '1');
                            if (Array.from(items).every(item => item.dataset.isLoaded === '0')) {
                                // pass
                                setTimeout(longTimeout, 700)
                            } else {
                                filesQueue.classList.add('all-images');
                                const bg = filesQueue.closest('.message-files-background');
                                if (bg) bg.classList.add('all-images');

                                const images = filesQueue.querySelectorAll('img');
                                let loadedCount = 0;
                                const setMaxWidthWhenReady = () => {
                                    const width = filesQueue.offsetWidth;
                                    if (width > 0) {
                                        messageElement.style.maxWidth = width + 'px';
                                    } else {
                                        requestAnimationFrame(setMaxWidthWhenReady);
                                    }
                                };

                                const onImageLoad = () => {
                                    loadedCount++;
                                    if (loadedCount === images.length) {
                                        setMaxWidthWhenReady();

                                    }
                                };
                                images.forEach(img => {
                                    if (img.complete) onImageLoad();
                                    else img.addEventListener('load', onImageLoad);
                                });
                            }
                        }
                        longTimeout()
                    }, 100)
                } 
            }
        }
    }

    if (message.id.toString().includes('temp_')) {
        messageElement.querySelector(".is-read-message").classList.add('clock');
    } else {
        if (message.isRead && message.sender === -1) {
            messageElement.querySelector(".is-read-message").classList.add('read');
        } else if (!message.isRead && message.sender === -1) {
            messageElement.querySelector(".is-read-message").classList.add('unread');
        }
    }

    if (message.sender !== -1 && !message.isRead && userOnline) {
        viewObserver.observe(messageElement)
    }

    if ((!document.querySelector(".temp") || message.id.toString().includes('temp_')) && animation) {
        messageElement.classList.add('show')
    } else {
        messageElement.classList.add('noAnim')
    }

    messagesList.insertBefore(messageElement, messagesList.firstElementChild)

    if (updateChatList) {
        updateChatInList(message)
    }
}

function updateChatInList(message, pull = true) {
    let chatElement = document.querySelector('.chats-list')
    if (message.chatId === -1)
        chatElement = chatElement.querySelector(`[data-account-id="${message.accountId}"]`);
    else
        chatElement = chatElement.querySelector(`[data-chat-id="${message.chatId}"]`);

    chatElement.style.display = 'flex'

    if (typeof chatElement !== null) {
        const lastMessageEl = chatElement.querySelector('.chat-last-message');
        if (lastMessageEl) {
            const messageTypes = {
                file: "<i>Файл</i>",
                sticker: "Стикер",
                media: "Медиа",
            };
            lastMessageEl.innerHTML = message.content.trim() !== '' ? linkifyUrls(escapeHtml(message.content).replace(/\n/g, '   ')) : messageTypes['file']
        }

        // Обновляем время
        const dateEl = chatElement.querySelector('.chat-date');
        if (dateEl) {
            dateEl.textContent = message.sentAt[1];
        }

        // Обновляем статус прочтения
        let isReadEl = chatElement.querySelector('.is-read');
        if (isReadEl !== null && message.sender === -1 && message.type) {
            if (message.isRead) {
                isReadEl.classList.remove('unread');
                isReadEl.classList.add('read');
            } else {
                isReadEl.classList.remove('read');
                isReadEl.classList.add('unread');
            }
        } else if (isReadEl !== null && message.sender !== -1) {
            isReadEl.remove()
        }

        const saved = chats.findIndex(item => item.chatId === openedChat)
        if (isReadEl === null && message.sender === -1 && (typeof chats[saved] === 'undefined' || chats[saved].type !== 'saved')) {
            isReadEl = document.createElement('div')
            isReadEl.className = 'is-read'
            chatElement.querySelector('.additional').appendChild(isReadEl)
            isReadEl.classList.add('unread')
        }

        // Обновляем счетчик непрочитанных
        const unreadCountEl = chatElement.querySelector('.unread-count');
        if (message.sender !== -1 && !message.isRead && message.chatId !== openedChat) {
            if (unreadCountEl) {
                let count = parseInt(unreadCountEl.textContent) || 0;
                unreadCountEl.textContent = count + 1;
            } else {
                const unreadDiv = document.createElement('div');
                unreadDiv.className = 'unread-count';
                unreadDiv.textContent = '1';
                chatElement.querySelector('.chat-avatar').appendChild(unreadDiv);
            }
        } else if (message.sender === -1 && unreadCountEl) {
            unreadCountEl.remove();
        }

        if (chats.length > 0 && message.chatId !== chats[0].chatId) {
            let index
            if (message.chatId === -1)
                index = chats.findIndex(item => item.accountId === message.accountId)
            else
                index = chats.findIndex(item => item.chatId === message.chatId)

            if (index === -1 || !pull) {
                // pass
            } else {
                const object = chats[index]
                chats.splice(index, 1)
                chats.unshift(object)

                const list = document.querySelector('.chats-list')
                const chatElements = document.querySelectorAll('.chats-list .chat-item')
                list.insertBefore(chatElements[index], list.firstElementChild)
            }
        }
    }
}

const viewObserver = new IntersectionObserver((entries) => {
    if (userOnline) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const messageId = entry.target.dataset.messageId;

                markMessageAsViewed(messageId);
                const last = messages[messages.findIndex(el => !el['isRead'])]['id']
                const chatElement = document.querySelector(`[data-chat-id="${openedChat}"]`);
                if (messageId >= last) {
                    const unreadCountEl = chatElement.querySelector('.unread-count');
                    if (unreadCountEl) {
                        let count = parseInt(unreadCountEl.textContent)
                        if (count - 1 === 0)
                            unreadCountEl.remove();
                        else
                            unreadCountEl.textContent = count - 1

                    }
                }

                viewObserver.unobserve(entry.target);
            }
        });
    }
}, {
    threshold: 0.5,
    rootMargin: '0px 0px -20px 0px' // Небольшой отступ снизу для лучшего определения
})

async function creatingMessages(data, animation = false) {
    const colours = [
        '--avatar-gradient-gray',
        '--avatar-gradient-blue',
        '--avatar-gradient-green',
        '--avatar-gradient-purple',
    ]

    if (MobileNavigation.isMobile) {
        if (data['accountId'] !== -1)
            document.querySelector(".header-avatar").dataset.accountId = +data['accountId']
        document.querySelector(".header-avatar").innerHTML = `
                    ${colours.includes(data.url) ? `<div class="header-avatar-img" style="background: var(${data.url})"> ${colours.includes(data.url) ? `${generateAvatar(data.name)}` : ``} </div>` : `<div class="header-avatar-img" style="background-image: url('${getAvatarUrl(data.url.replace(/'/g, "\\'"))}');"></div>`}
                    ${(data['online'] === 1 && data['accountId'] !== userId) ? `<div class="header-online"></div>` : ''}
                `
        document.querySelector(".header-name").innerHTML = `${data['name'] === null ? 'Избранное' : data['name']}`
    }
    
    if (!data.newChat) {
        const chatsRaw = await apiRequest(chatPHP, data)

        if (chatsRaw['response'].status === 200) {
            const response = chatsRaw['data']
            messages = response.result ? response.result.reverse() : [];
            openedChat = +data.chatId;
            const participantCount = response.participantCount;

            window.currentChatType = response.chatType || 'personal';

            const countEl = document.querySelector('.header-participant-count');
            if (countEl) {
                if (window.currentChatType !== 'personal' && window.currentChatType !== 'saved' && typeof participantCount !== "undefined") {
                    countEl.textContent = participantCount + ' участник(ов)';
                    countEl.style.display = 'block';
                } else {
                    countEl.style.display = 'none';
                }
            }

            const canSend = response.canSend !== undefined ? response.canSend : true;

            document.getElementById('messagesList').remove()
            const elem = document.createElement('div')
            elem.id = 'messagesList'
            elem.className = 'messages-list'
            elem.style.padding = canSend ? (MobileNavigation.isMobile ? '65px 0' : '80px 0') : '80px 0 0 0'
            document.querySelector(".messages-container").appendChild(elem)

            const messagesBottom = document.querySelector('.messages-bottom');
            if (messagesBottom) {
                messagesBottom.style.display = canSend ? 'flex' : 'none';
            }

            if (messages.length === 0) {
                if (data.type !== 'saved' && data.type !== 'group' && data.type !== 'channel')
                    newChat = true
            } else {
                newChat = false
                messages.forEach(message => {
                    addingMessage(message, false, animation)
                });
            }
        } else {
            console.log('Не отрисовал сообщения. ', chatsRaw)
        }
    } else {
        document.getElementById('messagesList').remove()
        const elem = document.createElement('div')
        elem.id = 'messagesList'
        elem.className = 'messages-list'
        document.querySelector(".messages-container").appendChild(elem)

        const countEl = document.querySelector('.header-participant-count');
        if (countEl) {
            if (data.type !== 'personal' && data.type !== 'saved' && typeof participantCount !== "undefined") {
                countEl.textContent = participantCount + ' участник(ов)';
                countEl.style.display = 'block';
            } else {
                countEl.style.display = 'none';
            }
        }
        messages = []
        openedChat = -1
        newChat = true
    }

    if (!MobileNavigation.isMobile) {
        if (data['accountId'] !== -1)
            document.querySelector(".header-avatar").dataset.accountId = +data['accountId']
        document.querySelector(".header-avatar").innerHTML = `
                    ${colours.includes(data.url) ? `<div class="header-avatar-img" style="background: var(${data.url})"> ${colours.includes(data.url) ? `${generateAvatar(data.name)}` : ``} </div>` : `<div class="header-avatar-img" style="background-image: url('${getAvatarUrl(data.url.replace(/'/g, "\\'"))}');"></div>`}
                    ${(data['online'] === 1 && data['accountId'] !== userId) ? `<div class="header-online"></div>` : ''}
                `
        document.querySelector(".header-name").innerHTML = `${data['name'] === null ? 'Избранное' : data['name']}`
    }

    if (data.type !== 'personal' && data.type !== 'saved') {
        document.querySelector(".header-calls").style.display = 'none';
        document.querySelector(".header-leave-btn").style.display = 'flex'
    } else if (data.type !== 'saved') {
        document.querySelector(".header-calls").style.display = 'flex';
        document.querySelector(".header-leave-btn").style.display = 'none'
    } else {
        document.querySelector(".header-calls").style.display = 'none';
        document.querySelector(".header-leave-btn").style.display = 'none'
    }
}

function chatsUI() {
    const index = chats.findIndex(item => item.type === "saved")
    if (index === -1) {
        chats.push({
            messageId: -1,
            accountId: userId,
            name: "Избранное",
            lastMessage: "",
            sender: userId,
            sentAt: ["", ""],
            type: "saved",
            isRead: false,
            unreadCount: 0,
            url: '../imgs/saved.png',
            online: 0
        })
    } else {
        chats[index] = {
            messageId: chats[index].messageId,
            chatId: chats[index].chatId,
            accountId: userId,
            name: "Избранное",
            lastMessage: chats[index].lastMessage,
            sender: userId,
            sentAt: chats[index].sentAt,
            type: "saved",
            isRead: false,
            unreadCount: 0,
            url: '../imgs/saved.png',
            online: 0
        }
    }

    const chatsList = document.getElementById('chatsList')
    chatsList.innerHTML = '';

    chats.forEach(chat => {
        addChat(chat, true)
    })
}

function getAvatarUrl(url) {
    if (!url) return '';
    if (url.startsWith('--')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (window.Capacitor?.isNativePlatform?.()) {

        return baseUrl + (url.startsWith('/') ? url : '/' + url);
    }
    return url;
}

function addChat(chat, show = true) {
    const messageTypes = {
        file: "<i>Файл</i>",
        sticker: "Стикер",
        media: "Медиа",
    }
    const colours = [
        '--avatar-gradient-gray',
        '--avatar-gradient-blue',
        '--avatar-gradient-green',
        '--avatar-gradient-purple',
    ]

    const chatElement = document.createElement('div');
    chatElement.className = 'chat-item';
    chatElement.dataset.chatId = chat.chatId
    chatElement.dataset.accountId = chat.accountId

    let message
    if (chat.lastMessage !== '')
        message = escapeHtml(chat.lastMessage)
    else
        if (chat.type === 'saved' && chat.sentAt[0] === '')
            message = '<i>Ваше личное пространство</i>'
        else if (chat.type === 'group' && chat.sentAt[0] === '')
            message = '<i>Группа создана</i>'
        else if (chat.type === 'channel' && chat.sentAt[0] === '')
            message = '<i>Канал создан</i>'
        else
            message = messageTypes['file']

    const isRead = !(chat.type === 'saved' && chat.sentAt[0] === '') && (chat.sender === -1 || chat.sender === userId)
    chatElement.innerHTML = `
            <div class="chat-avatar" ${colours.includes(chat.url) ? `style="background: var(${chat.url})"` : `style="background-image: url('${getAvatarUrl(chat.url.replace(/'/g, "\\'"))}');"`}>
                ${colours.includes(chat.url) ? `${generateAvatar(chat.name)}` : `<div class="chat-avatar-img" style="background-image: url('${getAvatarUrl(chat.url.replace(/'/g, "\\'"))}');"></div>`}
                ${chat.unreadCount > 0 ? `<div class="unread-count">${chat.unreadCount}</div>` : ''}
            </div>
            <div class="chat-info">
                <div class="chat-name">${chat.name}</div>
                <div class="chat-last-message">${message}</div>
            </div>
            <div class="additional">
                <div class="chat-date">${chat.sentAt[1]}</div>
                ${isRead ? '<div class="is-read"></div>' : ''}
            </div>
        `
    if (openedChat === chat['chatId']) {
        chatElement.querySelector(".chat-avatar").classList.add('opened')
        chatElement.classList.add('opened')
    }
    if (chat.isRead && isRead)
        chatElement.querySelector(".is-read").classList.add('read')
    else if (!chat.isRead && isRead)
        chatElement.querySelector(".is-read").classList.add('unread')

    chatElement.addEventListener('click', () => {
        document.querySelector('.messages-bottom').style = "display: flex;"
        document.querySelector('.messages-header').style = "display: flex;"

        lastDate = null

        const elems = document.querySelectorAll('.chat-item')
        elems.forEach((elem) => {
            elem.querySelector(".chat-avatar").classList.remove('opened')
            elem.classList.remove('opened')
        })

        if (MobileNavigation.isMobile) {
            document.querySelector('.messages-list').innerHTML = ''
            MobileNavigation.switchToMessages();
        } else {
            chatElement.querySelector(".chat-avatar").classList.add('opened')
            chatElement.classList.add('opened')
        }

        // закрываем уведомления:
        navigator.serviceWorker.ready.then(reg => {
            reg.getNotifications({ tag: `chat_${openedChat}` })
                .then(notifs => notifs.forEach(n => n.close()));
        });

        let chatData = {
            chatId: typeof chat.chatId !== "undefined" ? chat.chatId : null,
            accountId: typeof chat.accountId !== "undefined" ? chat.accountId : -1,
            name: chat.name,
            url: chat.url,
            type: chat.type,
            online: chat.online,
            newChat: typeof chat.chatId === "undefined"
        };
        creatingMessages(chatData);
    })

    if (!show)
        chatElement.style.display = 'none'
    chatsList.appendChild(chatElement)
}

function markUserOnline(userId) {
    const chatElement = document.querySelector(`[data-account-id="${userId}"]`)
    const chatOnline = document.createElement('div')
    chatOnline.className = 'chat-online'
    chatElement.querySelector('.chat-avatar').appendChild(chatOnline)
    chatElement.querySelector('.chat-online').classList.add('show')
    const index = chats.findIndex(item => item.accountId === userId)
    chats[index].online = 1

    if (document.querySelector('.header-info').querySelector(`[data-account-id="${userId}"]`) !== null) {
        const headerElement = document.querySelector('.header-avatar')
        const headerOnline = document.createElement('div');
        headerOnline.className = 'header-online';
        headerElement.appendChild(headerOnline);
        headerElement.querySelector('.header-online').classList.add('show')
    }
}

function markUserOffline(userId) {
    const chatElement = document.querySelector(`[data-account-id="${userId}"]`)
    const headerElement = document.querySelector('.header-avatar')
    const headerOnline = headerElement.querySelector('.header-online')
    chatElement.querySelector('.chat-online').classList.remove('show')
    chatElement.querySelector('.chat-online').classList.add('hide')
    const index = chats.findIndex(item => item.accountId === userId)
    chats[index].online = 0

    if (openedChat !== -1) {
        if (headerOnline !== null) {
            headerOnline.classList.remove('show')
            headerOnline.classList.add('hide')
        }
    }

    setTimeout(() => {
        chatElement.querySelector('.chat-online').remove()
        if (openedChat !== -1)
            if (headerOnline !== null)
                headerOnline.remove()
    }, 300)
}

async function connectSSE() {
    if (sseController) {
        sseController.abort();
        sseController = null;
    }
    if (sseRetryTimeout) {
        clearTimeout(sseRetryTimeout);
        sseRetryTimeout = null;
    }

    let accessToken = null;
    if (window.Capacitor?.isNativePlatform?.()) {
        accessToken = await tokenManager.getAccessToken();
    }

    const controller = new AbortController();
    sseController = controller;

    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
    };
    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let lastId = chats.length > 0 ? chats[0].messageId : 0;
    const url = `${ssePHP}?last_id=${lastId}`;

    let response;
    try {
        response = await fetch(url, {
            method: 'GET',
            headers: headers,
            credentials: 'include',
            signal: controller.signal
        });
    } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('SSE fetch error:', err);
        scheduleReconnect();
        return;
    }
    sseReconnectAttempts = 0;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log('SSE stream ended');
                break;
            }
            buffer += decoder.decode(value, { stream: true });
            let parts = buffer.split('\n\n');
            buffer = parts.pop();
            for (const part of parts) {
                if (part.trim() === '') continue;
                processSSEMessage(part);
            }
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('SSE aborted');
            return;
        }
        console.error('SSE stream error:', err);
    } finally {
        reader.releaseLock();
        if (!controller.signal.aborted) {
            scheduleReconnect();
        }
    }
}

function processSSEMessage(messageText) {
    const lines = messageText.split('\n');
    let eventType = 'message';
    let dataLines = [];
    for (const line of lines) {
        if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
        }
    }
    const dataStr = dataLines.join('\n');
    if (!dataStr) return;

    let data;
    try {
        data = JSON.parse(dataStr);
    } catch (e) {
        console.error('Failed to parse SSE data:', dataStr);
        return;
    }

    if (eventType === 'error' && data.type === 'unauthorized') {
        console.warn('SSE unauthorized, refreshing token...');
        apiRequest(isLoggedPHP, {}).then(() => {
            connectSSE();
        }).catch(() => {
            showAuthScreen();
        });
        return;
    }

    if (data['delete_message']) {
        console.log('делете')
        const deletedId = data['delete_message'];
        const messageElement = document.querySelector(`.message-item[data-message-id="${deletedId}"]`);
        if (messageElement) {
            messageElement.style.transition = 'opacity 0.2s, transform 0.2s';
            messageElement.style.opacity = '0';
            messageElement.style.transform = 'scale(0.8)';
            setTimeout(() => {
                messageElement.remove();
                updateChatAfterDelete(deletedId);
            }, 200);
        }
        return;
    } else if (data['new_messages']) {
        const message = JSON.parse(data['new_messages'])[0];
        if (message.chatId === openedChat) {
            messages.push(message);
            if (message.chatType && !window.currentChatType) window.currentChatType = message.chatType;
            addingMessage(message, false);
            updateChatInList(message);
        } else if (typeof message[0] !== 'undefined') {
            chats.unshift({accountId: message[0].user_id, chatId: +message.chatId, isRead: message.isRead, isReadByOther: message.isRead, lastMessage: message.content, messageId: +message.id, name: message[0].name, online: 0, sender: message.sender, sentAt: message.sentAt, messageType: message.type, type: 'personal', unreadCount: 1, url: message[0].avatar_url})

            const chat = {accountId: message[0].user_id, chatId: +message.chatId, name: message[0].name, online: false, url: message[0].avatar_url, lastMessage: message.content, sentAt: message.sentAt, unreadCount: 1}
            addChat(chat)
            const chatList = document.querySelector('.chats-list')
            const el = chatList.querySelector(`[data-account-id="${message[0].user_id}"]`)
            chatList.insertBefore(el, chatList.firstElementChild)
            chatList.removeChild(chatList.lastElementChild)
        } else {
            updateChatInList(message);
        }
    } else if (data['chats'] && !isUploading) {
        chats = JSON.parse(data['chats'])
        chatsUI()

        if (chats[0]['id'] === openedChat && openedChat !== -1) {
            creatingMessages(chats[0], false)
            chats[0]['content'] = chats[0]['lastMessage']
        }

        if (MobileNavigation.currentMode === 'messages' && openedChat !== -1) {
            MobileNavigation.switchToMessages();
        }
    } else if (data['edit_message']) {
        const editData = data['edit_message'];
        const msgId = editData.message_id;
        const newContent = editData.new_content;
        if (openedChat === editData.chat_id) {
            updateMessageInDOM(msgId, newContent);
        }
        const chatItem = document.querySelector(`.chat-item[data-chat-id="${editData.chat_id}"]`);
        if (chatItem) {
            const lastMsgSpan = chatItem.querySelector('.chat-last-message');
            if (lastMsgSpan && lastMsgSpan.innerText !== newContent) {
                lastMsgSpan.innerHTML = linkifyUrls(escapeHtml(newContent).replace(/\n/g, '   '));
            }
        }
    }

    if (data['seen']) {
        const seen = JSON.parse(data['seen'])
        seen.forEach((el) => {
            const messageId = +el['id']
            const chatId = el['chatId']
            const message = document.querySelector(`[data-message-id="${messageId}"]`);
            if (message !== null) {
                const isRead = message.querySelector('.is-read-message')
                isRead.classList.add('read')
            }
            const chat = document.querySelector(`[data-chat-id="${chatId}"]`);
            if (chat !== null) {
                let isRead = chat.querySelector('.is-read')
                if (isRead !== null) {
                    isRead.classList.remove('unread')
                    isRead.classList.add('read')
                } else {
                    isRead = document.createElement('div')
                    isRead.className = 'is-read'
                    chat.querySelector('.additional').appendChild(isRead)
                    isRead.classList.add('read')
                }
            }
        })
    }

    if (data['call']) {
        const call = data['call']
        if (call['callerId']) {
            handleIncomingCall(call['callerId'], call['type'])
        } else if (call['end']) {
            webrtcClient.endCall()
            callManager.hideCallModal()
        } else {
            if (call['answer'] === 'accept') {
                callManager.showCallModal('active', callManager.requestCallType)
            } else {
                webrtcClient.endCall()
                callManager.hideCallModal()
            }
        }
    }

    if (data['online_gained']) {
        data['online_gained'].forEach(id => {id !== userId && markUserOnline(id)})
    }
    if (data['online_lost']) {
        data['online_lost'].forEach(id => id !== userId && markUserOffline(id));
    }
}

function scheduleReconnect() {
    if (sseRetryTimeout) return;
    sseReconnectAttempts++;
    if (sseReconnectAttempts > SSE_MAX_RETRIES) {
        console.error('Max SSE reconnect attempts reached');
        return;
    }
    const delay = Math.min(1000 * Math.pow(2, sseReconnectAttempts), 30000);
    sseRetryTimeout = setTimeout(() => {
        sseRetryTimeout = null;
        connectSSE();
    }, delay);
}

document.addEventListener('DOMContentLoaded', function() {
    MobileNavigation.init();

    initCreateMenu()
    initEditPanel()

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && editingMessageId) {
            cancelEditing();
        }
    });
})
window.addEventListener('beforeunload', function() {
    if (eventSource) {
        eventSource.close()
    }
})

let resizeTimeout;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        MobileNavigation.isMobile = window.matchMedia('(max-width: 767px)').matches;
        if (!MobileNavigation.isMobile) {
            MobileNavigation.showBothContainers();
        } else {
            if (MobileNavigation.currentMode === 'messages') {
                MobileNavigation.switchToMessages();
            } else {
                MobileNavigation.switchToChats();
            }
        }
    }, 250);
});

async function send() {
    if (editingMessageId) {
        await saveEdit();
        return;
    }
    sendMessage.disabled = true

    const tempId = 'temp_' + Date.now();
    const tempMessage = {
        id: tempId,
        sender: -1,
        chatId: openedChat,
        accountId: +document.querySelector('.header-avatar').dataset.accountId,
        content: inp.value,
        type: 'text',
        sentAt: ["Сегодня", new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})],
        isRead: false,
        files: (fileQueueArray.length > 0) ? fileQueueArray : null
    }
    addingMessage(tempMessage, true, true)

    const originalValue = inp.value;
    inp.value = ''
    inp.focus();
    if (newChat || (messages.length === 0 && +document.querySelector('.header-avatar').dataset.accountId === userId)) {
        if (fileQueueArray.length > 0) {
            await uploadFiles({receiverId: +document.querySelector('.header-avatar').dataset.accountId, content: originalValue, newChat: newChat}, tempId)
            for (const file of fileQueueArray) {
                await removeFileDesign(file.id);
            }
            clearFileQueueArray()
        } else {
            const messageData = {
                receiverId: +document.querySelector('.header-avatar').dataset.accountId,
                content: originalValue,
                newChat: newChat,
                files: fileQueueArray
            };
            publishMessage(messageData, tempId);
        }
    } else {
        if (fileQueueArray.length > 0) {
            await uploadFiles({chatId: openedChat, content: originalValue, newChat: newChat}, tempId)
            fileQueueArray.forEach(file => { removeFileDesign(file.id) })
            setTimeout(() => {
                clearFileQueueArray()
            }, 500)
        } else {
            const messageData = {
                chatId: openedChat,
                content: originalValue,
                newChat: newChat,
                files: fileQueueArray
            };
            publishMessage(messageData, tempId);
        }
    }

    if (window.keyboardAdjuster) {
        inp.style.height = 'auto';
        autoResizeTextarea()
        window.keyboardAdjuster.updateScroll();
    }
}

async function publishMessage(message, tempId) {
    const publishing = await apiRequest(sendMessagePHP, message)
    const temp = document.querySelector(`[data-message-id="${tempId}"]`)
    temp.querySelector('.is-read-message').classList.add('unread')
    temp.querySelector('.is-read-message').classList.remove('clock')

    publishing['response'].onerror = function() {
        temp.style.border = '1px solid red'
        console.error('Ошибка отправки сообщения');
    }

    if (publishing['response'].status === 200) {
        temp.dataset.messageId = publishing['data']['messageId']
        const tempMessage = {
            id: +publishing['data']['messageId'],
            sender: -1,
            chatId: openedChat,
            accountId: +document.querySelector('.header-avatar').dataset.accountId,
            content: message.content,
            type: 'text',
            sentAt: ["Сегодня", new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})],
            isRead: false,
            readAt: null,
            files: message.files
        }
        messages.push(tempMessage)
    }

    let recipientId
    if (typeof message['receiverId'] !== 'undefined') {
        recipientId = +message['receiverId']
    } else {
        const chatElement = document.querySelector(`[data-chat-id="${openedChat}"]`);
        recipientId = +chatElement.dataset.accountId
    }
    if (recipientId === userId)
        return

    const notify = await apiRequest(sendNotificationPHP, {
        recipient_id: recipientId,
        body: message.content === '' ? 'Файл' : message.content,
        data: { source: 'button' }
    })
    if (notify['response'].status !== 200)
        console.log(notify['response'])
}

const MobileNavigation = {
    isMobile: window.matchMedia('(max-width: 767px)').matches,
    currentMode: 'chats', // 'chats' или 'messages'

    init() {
        this.setupBackButton();
        this.setupMediaQueryListener();
        this.applyInitialState();
    },

    setupBackButton() {
        const backButton = document.querySelector('.mobile-back-button');
        if (backButton) {
            backButton.addEventListener('click', () => this.switchToChats());
        }
    },

    setupMediaQueryListener() {
        const mediaQuery = window.matchMedia('(max-width: 767px)');
        mediaQuery.addEventListener('change', (e) => {
            this.isMobile = e.matches;
            if (!e.matches) {
                this.showBothContainers();
            }
        });
    },

    applyInitialState() {
        if (this.isMobile) {
            this.switchToChats();
        } else {
            this.showBothContainers();
        }
    },

    switchToChats() {
        if (!this.isMobile) return;

        this.currentMode = 'chats';
        document.querySelector('.chats-container').classList.remove('hidden');
        document.querySelector('.messages-container').classList.remove('active');

        document.querySelector('.mobile-back-button').style.display = 'none';
    },

    switchToMessages() {
        if (!this.isMobile) return;

        this.currentMode = 'messages';
        document.querySelector('.chats-container').classList.add('hidden');
        document.querySelector('.messages-container').classList.add('active');

        document.querySelector('.mobile-back-button').style.display = 'flex';
    },

    showBothContainers() {
        document.querySelector('.chats-container').classList.remove('hidden');
        document.querySelector('.messages-container').classList.remove('hidden', 'active');
        document.querySelector('.mobile-back-button').style.display = 'none';
    }
};

class KeyboardAdjuster {
    constructor() {
        this.isMobile = window.matchMedia('(max-width: 767px)').matches;
        this.keyboardOpen = false;
        this.initialViewportHeight = window.innerHeight;

        this.init();
    }

    init() {
        if (!this.isMobile) return;

        // Устанавливаем корректную высоту для мобильных устройств
        this.setVhProperty();

        // Слушаем изменения размера окна
        window.addEventListener('resize', this.handleResize.bind(this));

        // Слушаем фокус/блюр на поле ввода
        const messageInput = document.querySelector('.message-input');
        if (messageInput) {
            messageInput.addEventListener('focus', this.handleFocus.bind(this));
            messageInput.addEventListener('blur', this.handleBlur.bind(this));
        }

        // Слушаем изменения видимой области (для iOS)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this.handleVisualViewportResize.bind(this));
        }
    }

    setVhProperty() {
        // Устанавливаем кастомное CSS-свойство для высоты
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    handleResize() {
        this.setVhProperty();

        // Определяем, открыта ли клавиатура
        const currentHeight = window.innerHeight;
        const heightDiff = this.initialViewportHeight - currentHeight;

        // Если разница больше 150px, считаем что клавиатура открыта
        if (heightDiff > 150 && currentHeight < this.initialViewportHeight) {
            this.handleKeyboardOpen();
        } else if (!this.keyboardOpen && heightDiff < 50) {
            this.handleKeyboardClose();
        }
    }

    handleVisualViewportResize(event) {
        const viewport = event.target;
        const keyboardHeight = window.innerHeight - viewport.height;

        if (keyboardHeight > 200) {
            this.handleKeyboardOpen();
        } else if (this.keyboardOpen && keyboardHeight < 50) {
            this.handleKeyboardClose();
        }
    }

    handleFocus() {
        this.handleKeyboardOpen();

        setTimeout(() => {
            this.scrollToBottom();
        }, 300);
    }

    handleBlur() {
        setTimeout(() => {
            if (!document.activeElement.classList.contains('message-input')) {
                this.handleKeyboardClose();
            }
        }, 100);
    }

    handleKeyboardOpen() {
        if (this.keyboardOpen) return;

        this.keyboardOpen = true;
        document.body.classList.add('keyboard-open');

        const messenger = document.querySelector('.messenger');
        const messagesList = document.querySelector('.messages-list');

        if (messenger && messagesList) {
            const scrollPosition = messagesList.scrollHeight - messagesList.scrollTop;
            this.setVhProperty();
            setTimeout(() => {
                messagesList.scrollTop = messagesList.scrollHeight - scrollPosition;
            }, 50);
        }

        this.scrollToBottom();
    }

    handleKeyboardClose() {
        if (!this.keyboardOpen) return;

        this.keyboardOpen = false;
        document.body.classList.remove('keyboard-open');

        this.setVhProperty();

        setTimeout(() => {
            this.scrollToBottom();
        }, 100);
    }

    scrollToBottom() {
        const messagesList = document.querySelector('.messages-list');
        if (messagesList) {
            messagesList.scrollTo({
                top: messagesList.scrollHeight,
                behavior: 'smooth'
            });
        }
    }

    updateScroll() {
        if (this.keyboardOpen) {
            this.scrollToBottom();
        }
    }
}

function openChatFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get('chat_id');
    if (chatId) {
        const targetChat = chats.find(c => c.chatId == chatId);
        if (targetChat) {
            const chatElement = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
            if (chatElement) {
                chatElement.click();
            }
        } else {
            setTimeout(() => {
                const chatElement = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
                if (chatElement) chatElement.click();
            }, 1000);
        }
        window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.keyboardAdjuster = new KeyboardAdjuster();
    autoResizeTextarea()

    if (document.querySelector('.invite-to-group') !== null)
        document.querySelector('.invite-to-group').addEventListener('click', async () => {
            if (openedChat === -1) return;

            try {
                const createLink = (await apiRequest(createInviteLinkPHP, JSON.stringify({ chat_id: openedChat })))['data']

                if (createLink.success) {
                    if (navigator.clipboard) {
                        navigator.clipboard.writeText(createLink.url).then(() => {
                            console.log('Ссылка скопирована в буфер обмена!');
                        });
                    }
                } else {
                    console.error('Ошибка: ' + (createLink.error || 'Не удалось создать приглашение'));
                }
            } catch (error) {
                console.error('Ошибка создания приглашения:', error);
            }
        });
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = KeyboardAdjuster;
}

setInterval(async function() {
    if (dbPackage.length > 0) {
        try {
            const readPackage = await apiRequest(readPackagePHP, dbPackage)

            if (readPackage['response'].status !== 200) {
                console.log(readPackage)
            } else {
                dbPackage = []
            }

        } catch (error) {
            console.error('Error marking message as viewed:', error);
        }
    }
}, 3000)



// ==================== КОНТЕКСТНОЕ МЕНЮ СООБЩЕНИЙ ====================
let activeContextMenu = null;


function initEditPanel() {
    editPanel = document.querySelector('.message-edit-bar');
    editPanelText = editPanel ? editPanel.querySelector('.edit-message-text') : null;
    const editCross = editPanel ? editPanel.querySelector('.message-edit-bar-cross') : null;
    if (editCross) {
        editCross.addEventListener('click', cancelEditing);
    }
    if (editPanelText) {
        editPanelText.addEventListener('click', scrollToEditingMessage);
    }
}

document.addEventListener('contextmenu', (e) => {
    const messageItem = e.target.closest('.message-item');
    const messageId = messageItem.dataset.messageId;
    if (!messageId || messageId.toString().startsWith('temp_')) return;

    e.preventDefault();
    showContextMenu(e, messageItem, messageId);
});

if (MobileNavigation.isMobile && false) {
    document.addEventListener('click', (e) => {
        const messageItem = e.target.closest('.message-item');
        if (!messageItem || messageItem.classList.contains('alien')) return;
        if (messageItem.querySelector('.message-files-queue') !== null) return;
        const messageId = messageItem.dataset.messageId;

        e.preventDefault();
        showContextMenu(e, messageItem, messageId);
    });
}

function showContextMenu(event, messageElement, messageId) {
    if (activeContextMenu) {
        activeContextMenu.remove();
        activeContextMenu = null;
    }

    const menu = document.createElement('div');
    menu.className = 'message-context-menu';

    menu.innerHTML = `
        <div class="message-context-menu-item delete" data-action="delete">
            <img class="context-message-icon" src="/imgs/remove.svg" style="cursor: pointer" alt="Удалить">
            <span style="cursor: pointer">Удалить</span>
        </div>
        ${ messageElement.classList.contains('self') ? `
                <div class="message-context-menu-item edit" data-action="edit">
                    <img class="context-message-icon" src="/imgs/edit.svg" style="cursor: pointer" alt="Изменить">
                        <span style="cursor: pointer">Изменить</span>
                </div>
            ` : ''
        }
        <div class="message-context-menu-item edit" data-action="copy">
            <img class="context-message-icon" src="/imgs/copy.svg" style="cursor: pointer" alt="Скопировать">
            <span style="cursor: pointer">Скопировать</span>
        </div>
    `;

    let x = event.clientX;
    let y = event.clientY;
    const menuWidth = 150;
    const menuHeight = 80;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 5;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 5;
    menu.style.left = x - 75 + 'px';
    menu.style.top = y - 90 + 'px';

    document.body.appendChild(menu);
    activeContextMenu = menu;

    const deleteItem = menu.querySelector('[data-action="delete"]');
    const copyItem = menu.querySelector('[data-action="copy"]');

    const editItem = menu.querySelector('[data-action="edit"]');
    if (editItem !== null) {
        editItem.addEventListener('click', (e) => {
            e.stopPropagation();
            const messageElement = document.querySelector(`.message-item[data-message-id="${messageId}"]`);
            const contentElement = messageElement.querySelector('.message-content');
            const currentContent = contentElement.innerText;
            startEditing(messageId, currentContent, messageElement);
            closeContextMenu();
        });

        editItem.addEventListener('click', (e) => {
            e.stopPropagation();
            closeContextMenu();
            document.removeEventListener('click', closeHandler);
            document.removeEventListener('contextmenu', closeHandler);
        });
    }

    const closeHandler = (e) => {
        if (!menu.contains(e.target)) {
            closeContextMenu();
            document.removeEventListener('click', closeHandler);
            document.removeEventListener('contextmenu', closeHandler);
        }
    };

    deleteItem.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteMessage(messageId, messageElement);
        closeContextMenu();
        document.removeEventListener('click', closeHandler);
        document.removeEventListener('contextmenu', closeHandler);
    });

    copyItem.addEventListener('click', async (e) => {
        e.stopPropagation();
        const messageElement = document.querySelector(`.message-item[data-message-id="${messageId}"]`)
        const contentElement = messageElement.querySelector('.message-content');
        const currentContent = contentElement.innerText;
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(currentContent);
        }
        closeContextMenu();
        document.removeEventListener('click', closeHandler);
        document.removeEventListener('contextmenu', closeHandler);
    });

    setTimeout(() => {
        document.addEventListener('click', closeHandler);
        document.addEventListener('contextmenu', closeHandler);
    }, 0);
}

function closeContextMenu() {
    if (activeContextMenu) {
        activeContextMenu.classList.add('hide');
        setTimeout(() => {
            if (activeContextMenu && activeContextMenu.remove) activeContextMenu.remove();
            activeContextMenu = null;
        }, 150);
    }
}

function startEditing(messageId, currentContent, messageElement) {
    if (editingMessageId) cancelEditing();

    editingMessageId = messageId;
    originalMessageContent = currentContent;

    if (editPanel && editPanelText) {
        const bottom = document.querySelector('.messages-bottom')
        bottom.style.minHeight = '150px'

        setTimeout(() => {
            editPanelText.textContent = currentContent;
            editPanel.style.display = 'flex';
            autoResizeTextarea();
            filled();
        }, 100)
    }

    const input = document.querySelector('.message-input');
    input.value = currentContent;

    const sendBtn = document.querySelector('.message-send');
    sendBtn.querySelector('.send-img').src = '../imgs/check.svg';
    sendBtn.disabled = false;


    messageElement.classList.add('editing-highlight');
    setTimeout(() => messageElement.classList.remove('editing-highlight'), 1000);

    input.focus();
}

function scrollToEditingMessage() {
    if (!editingMessageId) return;
    const messageElement = document.querySelector(`.message-item[data-message-id="${editingMessageId}"]`);
    if (messageElement) {
        messageElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
        messageElement.querySelector('.message-text-background').classList.add('editing-highlight');
        setTimeout(() => messageElement.querySelector('.message-text-background').classList.remove('editing-highlight'), 1500);
    }
}

function cancelEditing() {
    editingMessageId = null;
    originalMessageContent = '';

    if (editPanel) {
        editPanel.style.display = 'none';
        const bottom = document.querySelector('.messages-bottom')
        bottom.classList.remove('editing');
        bottom.style.minHeight = '70px'

        updateMessagesBottomHeight();
    }

    const input = document.querySelector('.message-input');
    input.value = '';
    autoResizeTextarea();
    filled();

    const sendBtn = document.querySelector('.message-send');
    const sendImg = sendBtn.querySelector('.send-img');
    sendImg.src = '../imgs/send.svg';
    sendImg.alt = 'Отправить';
    filled();
}

async function saveEdit() {
    if (!editingMessageId) return;

    const newContent = document.querySelector('.message-input').value.trim();
    if (newContent === '') {
        const messageElement = document.querySelector(`.message-item[data-message-id="${editingMessageId}"]`);
        deleteMessage(editingMessageId, messageElement);
        cancelEditing();
        return;
    }

    try {
        const editMessage = (await apiRequest(editMessagePHP, { message_id: editingMessageId, content: newContent }))['data']
        if (editMessage.success) {
            await updateMessageInDOM(editingMessageId, newContent);
            const messagesList = document.getElementById('messagesList');
            const firstMessage = messagesList.querySelector('.message-item:first-child');
            if (firstMessage && firstMessage.dataset.messageId === editingMessageId) {
                const messageDate = firstMessage.querySelector('.message-time').innerHTML

                const updatedMessage = {
                    id: editingMessageId,
                    content: newContent,
                    chatId: openedChat,
                    sender: -1,
                    sentAt: ["Сегодня", messageDate],
                    isRead: false,
                    type: 'text'
                };
                updateChatInList(updatedMessage, false);
            }
            cancelEditing()
        } else {
            console.log('Ошибка: ' + (result.error || 'Не удалось отредактировать сообщение'));
        }
    } catch (err) {
        console.error('Edit error:', err);
    }
}

function updateMessageInDOM(messageId, newContent) {
    const messageElement = document.querySelector(`.message-item[data-message-id="${messageId}"]`);
    if (!messageElement) return;

    const contentDiv = messageElement.querySelector('.message-content');
    const escapedContent = escapeHtml(newContent).replace(/\n/g, '<br>');
    contentDiv.innerHTML = linkifyUrls(escapedContent);
}

async function deleteMessage(messageId, messageElement) {
    try {
        const deleteMessage = (await apiRequest(deleteMessagePHP, { message_id: messageId }))['data']
        if (deleteMessage.success) {
            messageElement.style.transition = 'opacity 0.2s, transform 0.2s';
            messageElement.style.opacity = '0';
            messageElement.style.transform = 'scale(0.8)';
            setTimeout(() => {
                if (messageElement.parentNode) messageElement.remove();
                updateChatAfterDelete(messageId);
            }, 200);
        } else {
            console.error('Ошибка: ' + (result.error || 'Не удалось удалить сообщение'));
        }
    } catch (err) {
        console.error('Delete error:', err);
    }
}

function updateChatAfterDelete(deletedMessageId) {
    const messagesList = document.getElementById('messagesList');
    if (!messagesList) return;
    const chatId = openedChat;
    const allMessages = Array.from(messagesList.querySelectorAll('.message-item'));
    if (allMessages.length === 0) {
        const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (chatItem) {
            const lastMsgSpan = chatItem.querySelector('.chat-last-message');
            if (lastMsgSpan) lastMsgSpan.innerHTML = '<i>Нет сообщений</i>';
        }
    } else {
        const lastMessage = allMessages[allMessages.length - 1];
        const lastContent = lastMessage.querySelector('.message-content')?.innerText || '<i>Файл</i>';
        const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (chatItem) {
            const lastMsgSpan = chatItem.querySelector('.chat-last-message');
            if (lastMsgSpan) lastMsgSpan.innerHTML = linkifyUrls(escapeHtml(lastContent).replace(/\n/g, '   '));
        }

        let mes = messages[allMessages.length-1]
        mes['chatId'] = chatId
        updateChatInList(mes, false)
        messages.pop()
    }
}

document.querySelector('.messages-list')?.addEventListener('scroll', () => closeContextMenu());
